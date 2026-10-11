import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 산 주변의 모든 등산로 (산림청 전국 등산로, 브이월드 2D데이터 API 레이어 LT_L_FRSTCLIMB).
//   /api/mtnpaths?name=계방산&s=37.70&w=128.43&n=37.77&e=128.51
// 브이월드 인증키는 Netlify 환경 변수 VWORLD_KEY 에 둔다 (코드에 적지 않는다).
// 키가 없으면 { configured:false } 를 돌려주고 화면은 조용히 건너뛴다.
const API = 'https://api.vworld.kr/req/data';
const DOMAIN = 'travel-story.hongtravel7584.workers.dev'; // 브이월드 인증키에 등록한 사이트 주소 (2026-10-10 새 주소로 바꿈)
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LINES = 400;
const MAX_PTS_PER_LINE = 120;

const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
function thin(line: number[][]) {
  if (line.length <= MAX_PTS_PER_LINE) return line;
  const out: number[][] = [];
  const step = (line.length - 1) / (MAX_PTS_PER_LINE - 1);
  for (let i = 0; i < MAX_PTS_PER_LINE; i++) out.push(line[Math.round(i * step)]);
  return out;
}
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  const key = Netlify.env.get('VWORLD_KEY') || '';
  if (!key) return jsonResponse({ configured: false, lines: [] });

  const q = new URL(req.url).searchParams;
  // 서버(해외)에서 브이월드에 닿지 않을 때 화면(사용자 브라우저)이 직접 부르도록 키를 넘겨준다.
  // 브이월드 키는 등록한 사이트 주소에서만 쓰이게 묶여 있어 화면에서 쓰는 용도로 만들어진 키다.
  if (q.get('key') === '1') return jsonResponse({ configured: true, key, domain: DOMAIN }, { headers: { 'Cache-Control': 'no-store' } });
  const s = num(q.get('s')), w = num(q.get('w')), n = num(q.get('n')), e = num(q.get('e'));
  const debug = q.get('debug') === '1';
  if (s == null || w == null || n == null || e == null || !(s < n && w < e) || n - s > 0.4 || e - w > 0.5 || s < 32 || n > 39 || w < 124 || e > 132.5) {
    return jsonResponse({ error: 'bad box' }, { status: 400 });
  }
  const box = [w, s, e, n].map((v) => v.toFixed(3));
  const cKey = `vwpath-v1-${box.join('_')}`;
  const store = getStore('cache');
  if (!debug) {
    const hit: any = await store.get(cKey, { type: 'json' });
    if (hit && Date.now() - (hit.at || 0) < TTL_MS) return jsonResponse({ ...hit, cached: true });
  }

  try {
    const lines: { c: number[][]; name: string; min: number | null; level: string }[] = [];
    let total = 0;
    let sample: any = null;
    for (let page = 1; page <= 4 && lines.length < MAX_LINES; page++) {
      const url = `${API}?service=data&request=GetFeature&data=LT_L_FRSTCLIMB&format=json&geometry=true&attribute=true&crs=EPSG:4326&size=1000&page=${page}` +
        `&geomFilter=BOX(${box.join(',')})&key=${encodeURIComponent(key)}&domain=${encodeURIComponent(DOMAIN)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Referer: `https://${DOMAIN}/` } });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`vworld not json (${res.status}) ${text.slice(0, 160)}`); }
      const r = data?.response || {};
      if (r.status === 'NOT_FOUND') break;
      if (r.status !== 'OK') {
        const code = r.error?.code || r.status || res.status;
        return jsonResponse({ error: 'vworld', code, message: r.error?.text || '' }, { status: 502 });
      }
      const feats = r.result?.featureCollection?.features || [];
      if (!sample && feats[0]) sample = { properties: feats[0].properties, geometryType: feats[0].geometry?.type };
      total = Number(r.record?.total) || Number(r.page?.total) || total;
      for (const f of feats) {
        const g = f?.geometry || {};
        const parts: any[] = g.type === 'MultiLineString' ? g.coordinates : g.type === 'LineString' ? [g.coordinates] : [];
        const p = f?.properties || {};
        for (const part of parts) {
          if (!Array.isArray(part) || part.length < 2) continue;
          const c = thin(part.map((xy: any) => [r5(Number(xy[1])), r5(Number(xy[0]))]).filter((x: number[]) => x[0] > 32 && x[1] > 124));
          if (c.length >= 2) lines.push({ c, name: String(p.mntn_nm || ''), min: num(p.up_min), level: String(p.cat_nam || '') });
          if (lines.length >= MAX_LINES) break;
        }
      }
      const pages = Number(r.page?.total) || 1;
      if (page >= pages) break;
    }
    const out = { at: Date.now(), configured: true, total, lines };
    if (!debug) await store.setJSON(cKey, out);
    return jsonResponse(debug ? { ...out, sample } : out);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/mtnpaths',
};
