import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';
import {
  RECREATION_API, MOUNTAIN_API, FORESTTRAIL_API, DATASETS,
  mapRecreation, dedupeRecreation, mapMountain, groupForestTrails,
} from '../../src/lib/forest.mts';

// 숲나들e 관련 산림청 자료.
//   /api/forest?type=recreation  → 자연휴양림 전체 (전국휴양림표준데이터)
//   /api/forest?type=trails      → 숲길 (100대 명산 + 숲나들e에서 예약하는 숲길)
// 자료가 자주 바뀌지 않으므로 받은 것을 저장해 두고 7일 동안 다시 쓴다.
// 공공데이터포털에서 아직 "활용신청"을 하지 않았으면 error: 'need-apply'와 신청할 자료 이름을 돌려준다.
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cache = () => getStore('cache');

class NeedApply extends Error {
  constructor(public dataset: keyof typeof DATASETS, detail: string) { super('need-apply: ' + detail); }
}

function looksUnregistered(status: number, text: string) {
  return status === 401 || status === 403 ||
    /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|등록되지 않은 인증키|인증키|"code"\s*:\s*-4|<returnReasonCode>\s*(30|20)\s*</i.test(text);
}

async function getText(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  return { status: res.status, text: await res.text() };
}

async function fetchRecreation(key: string, debug: boolean) {
  const rows: any[] = [];
  let total = Infinity;
  let sample: any = null;
  for (let page = 1; rows.length < total && page <= 10; page++) {
    const url = `${RECREATION_API}?serviceKey=${encodeURIComponent(key)}&pageNo=${page}&numOfRows=1000&type=json`;
    const { status, text } = await getText(url);
    if (looksUnregistered(status, text)) throw new NeedApply('recreation', text.slice(0, 200));
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error(`recreation: not json (${status}) ${text.slice(0, 160)}`); }
    const root = data?.response || data || {};
    const header = root.header || {};
    const code = String(header.resultCode ?? data?.resultCode ?? '');
    if (code && code !== '00' && code !== '0000' && code !== '03') {
      if (code === '30' || code === '20') throw new NeedApply('recreation', `${code} ${header.resultMsg || ''}`);
      throw new Error(`recreation: ${code} ${header.resultMsg || data?.resultMsg || ''}`);
    }
    const body = root.body || {};
    let items = body.items;
    if (items && !Array.isArray(items)) items = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
    items = items || [];
    if (!sample && items[0]) sample = items[0];
    rows.push(...items);
    total = Number(body.totalCount) || rows.length;
    if (!items.length) break;
  }
  const list = dedupeRecreation(rows.map(mapRecreation).filter(Boolean) as any);
  return { items: list, rawCount: rows.length, ...(debug ? { sample } : {}) };
}

async function fetchOdcloud(base: string, dataset: keyof typeof DATASETS, key: string) {
  const rows: any[] = [];
  let total = Infinity;
  for (let page = 1; rows.length < total && page <= 10; page++) {
    const url = `${base}?page=${page}&perPage=500&returnType=JSON&serviceKey=${encodeURIComponent(key)}`;
    const { status, text } = await getText(url);
    if (looksUnregistered(status, text)) throw new NeedApply(dataset, text.slice(0, 200));
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error(`${dataset}: not json (${status}) ${text.slice(0, 160)}`); }
    if (!Array.isArray(data?.data)) throw new Error(`${dataset}: ${status} ${text.slice(0, 160)}`);
    rows.push(...data.data);
    total = Number(data.totalCount) || rows.length;
    if (!data.data.length) break;
  }
  return rows;
}

async function fetchTrails(key: string, debug: boolean) {
  const [m, f] = await Promise.allSettled([
    fetchOdcloud(MOUNTAIN_API, 'mountain', key),
    fetchOdcloud(FORESTTRAIL_API, 'foresttrail', key),
  ]);
  const needApply: string[] = [];
  const errors: string[] = [];
  for (const r of [m, f]) {
    if (r.status === 'rejected') {
      if (r.reason instanceof NeedApply) needApply.push(r.reason.dataset); else errors.push(String(r.reason?.message || r.reason));
    }
  }
  const mountains = m.status === 'fulfilled' ? (m.value.map(mapMountain).filter(Boolean) as any[]) : [];
  const trails = f.status === 'fulfilled' ? groupForestTrails(f.value) : [];
  return {
    items: [...trails, ...mountains],
    needApply,
    errors,
    complete: m.status === 'fulfilled' && f.status === 'fulfilled',
    ...(debug ? { sample: { mountain: m.status === 'fulfilled' ? m.value[0] : null, foresttrail: f.status === 'fulfilled' ? f.value[0] : null } } : {}),
  };
}

function applyInfo(names: string[]) {
  return names.map((n) => DATASETS[n as keyof typeof DATASETS]).filter(Boolean);
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  const q = new URL(req.url).searchParams;
  const type = q.get('type') || '';
  const debug = q.get('debug') === '1';
  if (type !== 'recreation' && type !== 'trails') return jsonResponse({ error: 'bad type' }, { status: 400 });
  const cKey = `forest-${type}-v2`;
  const key = Netlify.env.get('FOREST_API_KEY') || Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;

  let saved: any = null;
  try { saved = await cache().get(cKey, { type: 'json' }); } catch { saved = null; }
  if (!debug && saved && Date.now() - (saved.at || 0) < TTL_MS) return jsonResponse({ ...saved, cached: true });

  try {
    if (type === 'recreation') {
      const r = await fetchRecreation(key, debug);
      const out = { at: Date.now(), updatedAt: new Date().toISOString().slice(0, 10), total: r.items.length, items: r.items };
      if (!debug && r.items.length) await cache().setJSON(cKey, out);
      return jsonResponse(debug ? { ...out, rawCount: r.rawCount, sample: (r as any).sample } : out);
    }
    const t = await fetchTrails(key, debug);
    if (!t.items.length) {
      if (saved) return jsonResponse({ ...saved, cached: true, stale: true });
      if (t.needApply.length) return jsonResponse({ error: 'need-apply', apply: applyInfo(t.needApply), errors: t.errors }, { status: 503 });
      return jsonResponse({ error: t.errors.join(' / ') || 'no data' }, { status: 502 });
    }
    const out = { at: Date.now(), updatedAt: new Date().toISOString().slice(0, 10), total: t.items.length, items: t.items, apply: applyInfo(t.needApply) };
    // 둘 중 하나라도 못 받았으면 저장하지 않는다 (신청이 끝나면 바로 다시 받게).
    if (!debug && t.complete) await cache().setJSON(cKey, out);
    return jsonResponse(debug ? { ...out, errors: t.errors, sample: (t as any).sample } : out);
  } catch (err: any) {
    if (saved) return jsonResponse({ ...saved, cached: true, stale: true });
    if (err instanceof NeedApply) return jsonResponse({ error: 'need-apply', apply: applyInfo([err.dataset]) }, { status: 503 });
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/forest',
};
