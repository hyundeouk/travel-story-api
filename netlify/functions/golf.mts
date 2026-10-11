import type { Context, Config } from '@netlify/functions';
import { guard, viewerShare } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { callGovApi, jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';
import { sidoShort } from '../../src/lib/forest.mts';

// 전국 골프장 (문화체육관광부 「전국 골프장 현황」, 공공데이터포털 15118920 — 파일데이터를 자동 변환한 오픈API).
//   /api/golf
// 자료에는 좌표가 없어서 소재지 주소를 네이버 클라우드 Geocoding으로 좌표로 바꾼다(주소별로 저장해 두고 다시 쓴다).
// 주소로 못 찾으면 한국관광공사 자료에서 이름으로 찾는다.
// 한 번에 다 바꾸지 못하면(시간 제한) 바꾼 만큼만 돌려주고 pending 수를 알려준다 → 화면이 잠시 뒤 다시 부른다.
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const GOLF_API = 'https://api.odcloud.kr/api/15118920/v1/uddi:0e5b12d2-1cc8-4caf-ba96-c2c7d1ef8d83';
const DATASET = { name: '문화체육관광부_전국 골프장 현황', page: 'https://www.data.go.kr/data/15118920/fileData.do' };
const GEOCODE = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';
const TOUR_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const DEFAULT_KEY_ID = '5v6q8ev03k';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TIME_BUDGET_MS = 7000;

async function sha1(text: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

// "경기도 여주시 가남읍 ○○리 산1-1번지 일원 (외 12필지)" → "경기도 여주시 가남읍 ○○리 산1-1"
function cleanAddress(a: string) {
  return String(a || '')
    .split(/[,;\/]|\s외\s|\(/)[0]
    .replace(/일원|일대|번지|외\s*\d+\s*필지/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function geocodeNaver(query: string, keyId: string, secret: string): Promise<[number, number] | null> {
  const res = await fetch(`${GEOCODE}?query=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(5000),
    headers: { 'x-ncp-apigw-api-key-id': keyId, 'x-ncp-apigw-api-key': secret },
  });
  if (!res.ok) throw new Error(`geocode http ${res.status}`);
  const j: any = await res.json();
  const a = j?.addresses?.[0];
  if (!a) return null;
  const lat = Number(a.y), lng = Number(a.x);
  return lat > 32 && lat < 39 && lng > 124 && lng < 132 ? [lat, lng] : null;
}

async function findByName(name: string, sido: string, tourKey: string): Promise<[number, number] | null> {
  const r = await callGovApi(TOUR_BASE, 'searchKeyword2', tourKey, { keyword: name.replace(/\(.*?\)/g, '').trim(), numOfRows: 20 });
  const hit = r.items.find((it: any) => /골프|CC|컨트리|GC/i.test(String(it.title)) && Number(it.mapy) > 32 && (!sido || sidoShort(it.addr1) === sido));
  return hit ? [Number(hit.mapy), Number(hit.mapx)] : null;
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  // 손님에게 골프를 공개하지 않았으면 목록을 보내지 않는다
  const share = await viewerShare(req);
  if (share && !share.tabs.golf) return jsonResponse({ items: [], total: 0, located: 0, pending: 0, hidden: true });

  const store = getStore('cache');
  const full: any = await store.get('golf-v1', { type: 'json' });
  if (full && Date.now() - (full.at || 0) < TTL_MS) return jsonResponse({ ...full, cached: true });

  const key = Netlify.env.get('GOLF_API_KEY') || Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
  const res = await fetch(`${GOLF_API}?page=1&perPage=2000&serviceKey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(10000) });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { return jsonResponse({ error: `not json (${res.status}) ${text.slice(0, 120)}` }, { status: 502 }); }
  // 활용신청 전이면 odcloud가 -401(유효하지 않은 인증키)을 준다
  if (data?.code === -401 || res.status === 401 || res.status === 403) return jsonResponse({ error: 'need-apply', apply: [DATASET] }, { status: 503 });
  const rows: any[] = Array.isArray(data?.data) ? data.data : [];
  if (!rows.length) return jsonResponse({ error: 'empty', detail: text.slice(0, 160) }, { status: 502 });

  const secret = Netlify.env.get('NAVER_MAP_SECRET') || '';
  const keyId = Netlify.env.get('NAVER_MAP_KEY_ID') || DEFAULT_KEY_ID;
  const started = Date.now();
  let pending = 0;
  const items: any[] = [];
  let idx = 0;
  // id: 이름+소재지로 만든 짧은 해시 (자료 순서가 바뀌어도 내 기록·사진이 그대로 붙게)
  const base = (await Promise.all(rows.map(async (r) => {
    const address = String(r['소재지'] || '').trim();
    const region = String(r['지역'] || '').trim();
    return {
      id: (await sha1(String(r['이름'] || '').trim() + '|' + address)).slice(0, 12),
      order: 0,
      name: String(r['이름'] || '').trim(),
      region,
      sido: sidoShort(region) || sidoShort(address) || region.slice(0, 2),
      owner: String(r['사업자'] || '').trim(),
      address,
      area: Number(r['면적(제곱미터)']) || null,
      holes: Number(r['홀']) || null,
      kind: String(r['구분'] || '').trim(),
      lat: null as number | null,
      lng: null as number | null,
    };
  }))).filter((x) => x.name);
  base.forEach((x, i) => { x.order = i; });

  async function worker() {
    while (idx < base.length) {
      const g = base[idx++];
      const q = cleanAddress(g.address);
      const gKey = `geo-v1-${await sha1(g.name + '|' + q)}`;
      let hit: any = await store.get(gKey, { type: 'json' });
      if (!hit) {
        if (Date.now() - started > TIME_BUDGET_MS) { pending++; items.push(g); continue; }
        let ll: [number, number] | null = null;
        try {
          if (secret && q) {
            ll = await geocodeNaver(q, keyId, secret);
            if (!ll) { const shorter = q.split(' ').slice(0, -1).join(' '); if (shorter.split(' ').length >= 3) ll = await geocodeNaver(shorter, keyId, secret); }
          }
          if (!ll) ll = await findByName(g.name, g.sido, key);
          hit = ll ? { lat: r5(ll[0]), lng: r5(ll[1]) } : { none: true };
          await store.setJSON(gKey, hit);
        } catch {
          pending++; items.push(g); continue;
        }
      }
      if (!hit.none) { g.lat = hit.lat; g.lng = hit.lng; }
      items.push(g);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  items.sort((a, b) => a.order - b.order);
  const out = { at: Date.now(), total: items.length, located: items.filter((x) => x.lat != null).length, pending, geocoder: secret ? 'naver' : 'tour-only', items };
  if (!pending) await store.setJSON('golf-v1', out);
  return jsonResponse(out, { headers: { 'Cache-Control': 'no-store' } });
};

export const config: Config = {
  path: '/api/golf',
};
