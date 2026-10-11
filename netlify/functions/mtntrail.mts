import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 100대 명산 등산로 선.
//   /api/mtntrail?name=가리산&lat=37.87&lng=127.96
// 한국등산트레킹지원센터 「100대명산 숲길노면정보 서비스」(공공데이터포털 15097960)는
// 등산로를 따라 찍힌 점(위도·경도·해발고도)을 경로(crseId)별로 준다. 이것을 경로마다 선으로 묶어 돌려준다.
// 산마다 수천 개의 점이라 한 번 받으면 30일 동안 저장해 두고 다시 쓴다.
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const API = 'https://apis.data.go.kr/B553662/frtrlRdsfInfoService/getFrtrlRdsfInfoList';
const DATASET = { name: '한국등산트레킹지원센터_100대명산 숲길노면정보 서비스', page: 'https://www.data.go.kr/data/15097960/openapi.do' };
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PTS = 400; // 경로 하나당 화면에 그릴 최대 점 수

type Pt = [number, number, number]; // lat, lng, alt

function km(a: Pt, b: Pt) {
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin(((b[0] - a[0]) * t) / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(((b[1] - a[1]) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const pathLen = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + km(pts[i - 1], p) : 0), 0);
const GAP_KM = 0.3; // 이웃한 점이 이보다 멀면 실제로 이어진 길이 아니므로 선을 끊는다
function splitAtGaps(pts: Pt[]): Pt[][] {
  const parts: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of pts) {
    if (cur.length && km(cur[cur.length - 1], p) > GAP_KM) { if (cur.length >= 2) parts.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length >= 2) parts.push(cur);
  return parts;
}

// 점 순서가 뒤섞여 있으면(선이 지그재그) 가장 가까운 점을 차례로 이어 다시 정렬한다.
function orderPoints(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const given = pathLen(pts);
  const rest = pts.slice();
  // 시작점: 다른 점들에서 가장 먼 쪽 끝을 고른다
  let start = 0, far = -1;
  for (let i = 0; i < rest.length; i++) { const d = km(rest[i], rest[0]); if (d > far) { far = d; start = i; } }
  const out: Pt[] = [rest.splice(start, 1)[0]];
  while (rest.length) {
    const last = out[out.length - 1];
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rest.length; i++) { const d = km(last, rest[i]); if (d < bd) { bd = d; bi = i; } }
    out.push(rest.splice(bi, 1)[0]);
  }
  return pathLen(out) * 1.3 < given ? out : pts;
}
function thin(pts: Pt[]): Pt[] {
  if (pts.length <= MAX_PTS) return pts;
  const step = pts.length / MAX_PTS;
  const out: Pt[] = [];
  for (let i = 0; i < MAX_PTS; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
}
const norm = (s: unknown) => String(s ?? '').replace(/\s+|\(.*?\)/g, '');

function looksUnregistered(status: number, text: string) {
  return status === 401 || status === 403 || /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|"returnReasonCode"\s*:\s*"(30|20)"|<returnReasonCode>\s*(30|20)\s*</i.test(text);
}

async function fetchAll(name: string, key: string) {
  const rows: any[] = [];
  let total = Infinity;
  for (let page = 1; rows.length < total && page <= 30; page++) {
    const url = `${API}?serviceKey=${encodeURIComponent(key)}&pageNo=${page}&numOfRows=1000&type=json&srchFrtrlNm=${encodeURIComponent(name)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const text = await res.text();
    if (looksUnregistered(res.status, text)) return { needApply: true as const, rows };
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error(`not json (${res.status}) ${text.slice(0, 160)}`); }
    const root = data?.response || data || {};
    const code = String(root?.header?.resultCode ?? '');
    if (code && code !== '0' && code !== '00' && code !== '0000' && code !== '03') throw new Error(`${code} ${root?.header?.resultMsg || ''}`);
    const body = root.body || {};
    let items = body.items;
    if (items && !Array.isArray(items)) items = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
    items = items || [];
    rows.push(...items);
    total = Number(body.totalCount) || rows.length;
    if (!items.length) break;
  }
  return { needApply: false as const, rows };
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  const q = new URL(req.url).searchParams;
  const name = (q.get('name') || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const lat = Number(q.get('lat')), lng = Number(q.get('lng'));
  const hasLL = Number.isFinite(lat) && Number.isFinite(lng) && lat > 32 && lng > 124;
  const debug = q.get('debug') === '1';
  if (name.length < 2) return jsonResponse({ error: 'bad name' }, { status: 400 });

  const store = getStore('cache');
  const cKey = `mtrail-v2-${norm(name)}`;
  if (!debug) {
    const hit: any = await store.get(cKey, { type: 'json' });
    if (hit && Date.now() - (hit.at || 0) < TTL_MS) return jsonResponse({ ...hit, cached: true });
  }
  try {
    const key = Netlify.env.get('FOREST_API_KEY') || Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
    const r = await fetchAll(name, key);
    if (r.needApply) return jsonResponse({ error: 'need-apply', apply: [DATASET] }, { status: 503 });
    // 이름이 정확히 같은 산의 점만 쓴다 (검색은 부분 일치일 수 있음)
    let rows = r.rows.filter((it: any) => norm(it.frtrlNm) === norm(name));
    if (!rows.length) rows = r.rows;
    const groups = new Map<string, Pt[]>();
    for (const it of rows) {
      const p: Pt = [Number(it.lat), Number(it.lot ?? it.lon ?? it.lng), Number(it.aslAltide) || 0];
      if (!(p[0] > 32 && p[0] < 39 && p[1] > 124 && p[1] < 132)) continue;
      // 산 위치에서 너무 먼 점(이름만 같은 다른 산)은 뺀다
      if (hasLL && km(p, [lat, lng, 0]) > 25) continue;
      const id = String(it.crseId || it.frtrlId || '0');
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id)!.push(p);
    }
    const courses = Array.from(groups.entries())
      .map(([id, pts]) => {
        const ordered = orderPoints(pts);
        const alts = ordered.map((p) => p[2]).filter((a) => a > 0);
        const parts = splitAtGaps(ordered);
        const total = parts.reduce((s, q) => s + pathLen(q), 0);
        const keep = Math.max(2, Math.floor(MAX_PTS / Math.max(1, parts.length)));
        const r5 = (p: Pt) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];
        const thinTo = (q: Pt[]) => (q.length <= keep ? q : Array.from({ length: keep }, (_, i) => q[Math.floor((i * (q.length - 1)) / (keep - 1))]));
        return {
          id,
          km: Math.round(total * 10) / 10,
          minAlt: alts.length ? Math.round(Math.min(...alts)) : null,
          maxAlt: alts.length ? Math.round(Math.max(...alts)) : null,
          points: thin(ordered).map(r5),
          parts: parts.map((q) => thinTo(q).map(r5)),
        };
      })
      .filter((c) => c.points.length >= 2 && c.km >= 0.2)
      .sort((a, b) => b.km - a.km)
      .slice(0, 12);
    const out = { at: Date.now(), name, courses, rawCount: r.rows.length };
    if (!debug && r.rows.length) await store.setJSON(cKey, out);
    return jsonResponse(debug ? { ...out, sample: r.rows.slice(0, 3) } : out);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/mtntrail',
};
