import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';
import { parseStringPromise } from 'xml2js';

// 산 정보 (산림청 「산 정보 조회_GW」, 공공데이터포털 15158978 — 국내 산 3천여 곳: 산 이름·소재지·높이·설명·관리주체)
//   /api/mtninfo?name=청량산&h=870&near=경북 봉화
// 같은 이름의 산이 여러 곳이면 높이(h)와 지역 글자(near)로 가장 비슷한 것을 고른다.
// 한 번 찾은 결과는 30일 동안 저장해 두고 다시 쓴다.
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const API = 'https://apis.data.go.kr/1400000/trailInfoService/getforeststoryservice';
const DATASET = { name: '산림청_산 정보 조회_GW', page: 'https://www.data.go.kr/data/15158978/openapi.do' };
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const ENT: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', ordf: '', ucirc: '', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };
const decode = (t: string) => t.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&([a-z]+);/gi, (_, n) => ENT[n.toLowerCase()] ?? '');
const clean = (v: unknown) => decode(decode(String(v ?? '')))
  .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const norm = (s: unknown) => String(s ?? '').replace(/\s+|\(.*?\)/g, '');
const SIDO: Record<string, string> = { 경북: '경상북도', 경남: '경상남도', 전북: '전북', 전남: '전라남도', 충북: '충청북도', 충남: '충청남도', 강원: '강원', 경기: '경기', 서울: '서울', 부산: '부산', 대구: '대구', 인천: '인천', 광주: '광주', 대전: '대전', 울산: '울산', 제주: '제주' };

// 산림청 응답 칸 (2026-10 확인): mntnid, mntnnm, mntnsbttlinfo(부제), mntninfohght(높이), mntninfopoflc(소재지),
// mntninfomngmemnbdnm(관리), mntninfodtlinfocont(상세), mntninfodscrt(산 이야기), hndfmsmtnslctnrson(100대 명산 선정 이유),
// crcmrsghtnginfoetcdscrt(추천 코스), crcmrsghtnginfodscrt(숙식·문의), pbtrninfodscrt(대중교통)
function pick(it: Record<string, any>, ...keys: string[]) {
  for (const k of keys) { const v = clean(it[k]); if (v && v !== 'null') return v; }
  return '';
}
function lower(it: any) { const o: Record<string, any> = {}; for (const [k, v] of Object.entries(it || {})) o[k.toLowerCase()] = typeof v === 'object' ? '' : v; return o; }

export function shape(raw: any) {
  const it = lower(raw);
  const h = Number(String(pick(it, 'mntninfohght', 'mntnhght')).replace(/[^\d.]/g, ''));
  return {
    id: pick(it, 'mntnid'),
    name: pick(it, 'mntnnm'),
    sub: pick(it, 'mntnsbttlinfo'),
    height: Number.isFinite(h) && h > 0 ? Math.round(h) : null,
    addr: pick(it, 'mntninfopoflc', 'mntnadd'),
    manage: pick(it, 'mntninfomngmemnbdnm'),
    desc: pick(it, 'mntninfodtlinfocont'),
    story: pick(it, 'mntninfodscrt'),
    reason: pick(it, 'hndfmsmtnslctnrson'),
    course: pick(it, 'crcmrsghtnginfoetcdscrt', 'ptmntrcmmncoursdscrt'),
    etc: pick(it, 'crcmrsghtnginfodscrt'),
    transit: pick(it, 'pbtrninfodscrt'),
  };
}

async function search(name: string, key: string) {
  const url = `${API}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=50&mntnNm=${encodeURIComponent(name)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const text = await res.text();
  if (res.status === 401 || res.status === 403 || /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|<returnReasonCode>\s*(30|20)\s*</i.test(text)) return { needApply: true as const, items: [] as any[] };
  let data: any;
  try { data = JSON.parse(text); } catch { data = await parseStringPromise(text, { explicitArray: false, ignoreAttrs: true, trim: true }); }
  const root = data?.response || data || {};
  const code = String(root?.header?.resultCode ?? '');
  if (code && !/^0+$/.test(code) && code !== '03') throw new Error(`${code} ${root?.header?.resultMsg || ''}`);
  let items = root?.body?.items;
  if (items && !Array.isArray(items)) items = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
  return { needApply: false as const, items: (items || []) as any[] };
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const name = (q.get('name') || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const h = Number(q.get('h'));
  const near = (q.get('near') || '').slice(0, 40);
  const debug = q.get('debug') === '1';
  if (name.length < 2) return jsonResponse({ error: 'bad name' }, { status: 400 });

  const store = getStore('cache');
  const cKey = `mtninfo-v2-${norm(name)}`;
  let list: any[] | null = null;
  if (!debug) {
    const hit: any = await store.get(cKey, { type: 'json' });
    if (hit && Date.now() - (hit.at || 0) < TTL_MS) list = hit.list;
  }
  let raw: any[] = [];
  if (!list) {
    try {
      const key = Netlify.env.get('FOREST_API_KEY') || Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
      const r = await search(name, key);
      if (r.needApply) return jsonResponse({ error: 'need-apply', apply: [DATASET] }, { status: 503 });
      raw = r.items;
      list = r.items.map(shape).filter((x) => x.name);
      await store.setJSON(cKey, { at: Date.now(), list });
    } catch (e: any) {
      return jsonResponse({ error: String(e?.message || e).slice(0, 200) }, { status: 502 });
    }
  }
  // 이름이 같은 것 → 높이가 가까운 것 → 지역 글자가 맞는 것 순으로 점수를 매긴다
  const n0 = norm(name);
  const words = near.split(/\s+/).filter((w) => w.length >= 2).map((w) => SIDO[w.slice(0, 2)] && w.length <= 3 ? SIDO[w.slice(0, 2)] : w.replace(/(특별자치도|특별자치시|광역시|특별시|시|군|구)$/, '').slice(0, 2));
  const scored = (list || []).map((x) => {
    let s = 0;
    if (norm(x.name) === n0) s += 100; else if (norm(x.name).includes(n0)) s += 40;
    if (Number.isFinite(h) && h > 0 && x.height) s += Math.max(0, 40 - Math.abs(x.height - h) / 5);
    for (const w of words) if (x.addr.includes(w)) s += 15;
    return { x, s };
  }).sort((a, b) => b.s - a.s);
  const best = scored[0] && scored[0].s >= 40 ? scored[0].x : null;
  return jsonResponse({ found: !!best, item: best, others: scored.length - (best ? 1 : 0), source: DATASET.name, ...(debug ? { raw: raw.slice(0, 3), list } : {}) });
};

export const config: Config = { path: '/api/mtninfo' };
