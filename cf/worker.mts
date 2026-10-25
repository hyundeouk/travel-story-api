/* 여행 스토리 — Cloudflare Worker 입구.
   원래 Netlify Functions(netlify/functions/*.mts)를 그대로 불러와 주소(config.path)대로 연결한다.
   - 저장소(@netlify/blobs) → D1 (shim-blobs.mts)
   - Netlify.env.get(이름) → Cloudflare 변수/비밀값, 없으면 D1 에 저장해 둔 설정(config/env)
   - /api/_import : 예전 Netlify 사이트에서 자료를 한 번 옮겨 오는 입구(토큰 필요, 끝나면 잠김) */
import { bindDB, getStore } from './shim-blobs.mts';
import { AsyncLocalStorage } from 'node:async_hooks';

/* 브라우저 대신 가져오기(relay): 국가유산청·Overpass(OSM)처럼 Cloudflare 서버에서는 접속이 막히는
   곳은, 서버가 실패하면 "이 주소를 대신 받아 달라"(relayNeed)고 답하고, 화면(브라우저)이 직접 받아
   /api/_relay 로 다시 보내면 그 내용으로 같은 기능을 마저 처리한다(결과는 평소처럼 저장해 둠). */
const RELAY_HOSTS = new Set(['www.khs.go.kr', 'overpass-api.de', 'overpass.kumi.systems']);
const als = new AsyncLocalStorage<{ relay: Record<string, string>; need: any[] }>();
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = async (input: any, init?: any) => {
  const st = als.getStore();
  let url = '';
  try { url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url; } catch {}
  let host = ''; try { host = new URL(url).hostname; } catch {}
  if (!st || !RELAY_HOSTS.has(host)) return realFetch(input, init);
  const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const body = typeof init?.body === 'string' ? init.body : '';
  const key = method + ' ' + url + (body ? ' ' + body : '');
  if (key in st.relay) return new Response(st.relay[key], { status: 200 });
  // 이 곳들은 Cloudflare 서버에서 늘 막혀(기다리다 8초쯤 뒤 실패) 바로 브라우저에 부탁한다.
  st.need.push({ url, method, body });
  throw new Error('relay needed: ' + host);
};
import fn_attractions, { config as cfg_attractions } from '../netlify/functions/attractions.mts';
import fn_auth, { config as cfg_auth } from '../netlify/functions/auth.mts';
import fn_customimages, { config as cfg_customimages } from '../netlify/functions/customimages.mts';
import fn_placephotos, { config as cfg_placephotos } from '../netlify/functions/placephotos.mts';
import fn_debug, { config as cfg_debug } from '../netlify/functions/debug.mts';
import fn_festivals, { config as cfg_festivals } from '../netlify/functions/festivals.mts';
import fn_forest, { config as cfg_forest } from '../netlify/functions/forest.mts';
import fn_golf, { config as cfg_golf } from '../netlify/functions/golf.mts';
import fn_golfosm, { config as cfg_golfosm } from '../netlify/functions/golfosm.mts';
import fn_glog, { config as cfg_glog } from '../netlify/functions/glog.mts';
import fn_gphotos, { config as cfg_gphotos } from '../netlify/functions/gphotos.mts';
import fn_gstories, { config as cfg_gstories } from '../netlify/functions/gstories.mts';
import fn_heritage, { config as cfg_heritage } from '../netlify/functions/heritage.mts';
import fn_image, { config as cfg_image } from '../netlify/functions/image.mts';
import fn_mapconfig, { config as cfg_mapconfig } from '../netlify/functions/mapconfig.mts';
import fn_mapsearch, { config as cfg_mapsearch } from '../netlify/functions/mapsearch.mts';
import fn_marks, { config as cfg_marks } from '../netlify/functions/marks.mts';
import fn_mtnpaths, { config as cfg_mtnpaths } from '../netlify/functions/mtnpaths.mts';
import fn_mtntrail, { config as cfg_mtntrail } from '../netlify/functions/mtntrail.mts';
import fn_mtninfo, { config as cfg_mtninfo } from '../netlify/functions/mtninfo.mts';
import fn_myplaces, { config as cfg_myplaces } from '../netlify/functions/myplaces.mts';
import fn_nearby, { config as cfg_nearby } from '../netlify/functions/nearby.mts';
import fn_photos, { config as cfg_photos } from '../netlify/functions/photos.mts';
import fn_picks, { config as cfg_picks } from '../netlify/functions/picks.mts';
import fn_fixes, { config as cfg_fixes } from '../netlify/functions/fixes.mts';
import fn_camping, { config as cfg_camping } from '../netlify/functions/camping.mts';
import fn_campshops, { config as cfg_campshops } from '../netlify/functions/campshops.mts';
import fn_placedetail, { config as cfg_placedetail } from '../netlify/functions/placedetail.mts';
import fn_placesearch, { config as cfg_placesearch } from '../netlify/functions/placesearch.mts';
import fn_restaurants, { config as cfg_restaurants } from '../netlify/functions/restaurants.mts';
import fn_route, { config as cfg_route } from '../netlify/functions/route.mts';
import fn_stories, { config as cfg_stories } from '../netlify/functions/stories.mts';
import fn_trailroute, { config as cfg_trailroute } from '../netlify/functions/trailroute.mts';
import fn_trails, { config as cfg_trails } from '../netlify/functions/trails.mts';
import fn_weather, { config as cfg_weather } from '../netlify/functions/weather.mts';
import fn_wiki, { config as cfg_wiki } from '../netlify/functions/wiki.mts';

type Route = { re: RegExp; keys: string[]; fn: any };
const ROUTES: Route[] = [];
for (const [fn, cfg] of [
  [fn_attractions, cfg_attractions],
  [fn_auth, cfg_auth],
  [fn_customimages, cfg_customimages],
  [fn_placephotos, cfg_placephotos],
  [fn_debug, cfg_debug],
  [fn_festivals, cfg_festivals],
  [fn_forest, cfg_forest],
  [fn_golf, cfg_golf],
  [fn_golfosm, cfg_golfosm],
  [fn_glog, cfg_glog],
  [fn_gphotos, cfg_gphotos],
  [fn_gstories, cfg_gstories],
  [fn_heritage, cfg_heritage],
  [fn_image, cfg_image],
  [fn_mapconfig, cfg_mapconfig],
  [fn_mapsearch, cfg_mapsearch],
  [fn_marks, cfg_marks],
  [fn_mtnpaths, cfg_mtnpaths],
  [fn_mtntrail, cfg_mtntrail],
  [fn_mtninfo, cfg_mtninfo],
  [fn_myplaces, cfg_myplaces],
  [fn_nearby, cfg_nearby],
  [fn_photos, cfg_photos],
  [fn_picks, cfg_picks],
  [fn_fixes, cfg_fixes],
  [fn_camping, cfg_camping],
  [fn_campshops, cfg_campshops],
  [fn_placedetail, cfg_placedetail],
  [fn_placesearch, cfg_placesearch],
  [fn_restaurants, cfg_restaurants],
  [fn_route, cfg_route],
  [fn_stories, cfg_stories],
  [fn_trailroute, cfg_trailroute],
  [fn_trails, cfg_trails],
  [fn_weather, cfg_weather],
  [fn_wiki, cfg_wiki]
] as any[]) {
  const paths = Array.isArray(cfg?.path) ? cfg.path : [cfg?.path];
  for (const p of paths) {
    if (!p) continue;
    const keys: string[] = [];
    const re = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:([A-Za-z0-9_]+)/g, (_: string, k: string) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    ROUTES.push({ re, keys, fn });
  }
}

let cfgCache: { at: number; env: Record<string, string> } | null = null;
async function loadCfgEnv() {
  if (cfgCache && Date.now() - cfgCache.at < 60000) return cfgCache.env;
  let env: Record<string, string> = {};
  try { env = (await getStore('config').get('env', { type: 'json' })) || {}; } catch {}
  cfgCache = { at: Date.now(), env };
  return env;
}

const OLD_ORIGIN = 'https://travel-story-api.netlify.app';
let ALLOWED_ORIGIN = OLD_ORIGIN;
function cors(res: Response, origin: string | null) {
  const h = new Headers(res.headers);
  if (origin === ALLOWED_ORIGIN) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Access-Control-Allow-Headers', 'content-type, x-import-token');
    h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  return new Response(res.body, { status: res.status, headers: h });
}
function b64ToBytes(b64: string) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

async function handleImport(req: Request, env: any) {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
  const json = (o: any, s = 200) => cors(new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } }), origin);
  if (!env.IMPORT_TOKEN || req.headers.get('x-import-token') !== env.IMPORT_TOKEN) return json({ error: 'forbidden' }, 403);
  const cfg = getStore('config');
  if (await cfg.get('importLocked')) return json({ error: 'locked' }, 410);
  const u = new URL(req.url);
  if (u.searchParams.get('raw')) { // 사진 한 장을 그대로(바이너리) 받기 — 무료 CPU 10ms 안에 끝나도록 변환 없이 저장
    const store = u.searchParams.get('store') || '', key = u.searchParams.get('key') || '';
    if (!['photos', 'gphotos'].includes(store) || !/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(key)) return json({ error: 'bad key' }, 400);
    const meta = store === 'gphotos' ? { author: 'imported', at: Date.now() } : {};
    await getStore(store).set(key, new Uint8Array(await req.arrayBuffer()), { metadata: meta });
    return json({ ok: true, n: 1 });
  }
  const body: any = await req.json();
  if (Array.isArray(body.check)) { // 이미 옮긴 사진은 건너뛰기 위해
    const have: string[] = [];
    for (const c of body.check) { if (await getStore(c.store).getMetadata(c.key)) have.push(c.store + '/' + c.key); }
    return json({ ok: true, have });
  }
  let n = 0;
  for (const it of body.items || []) {
    const st = getStore(it.store);
    if (it.b64 != null) await st.set(it.key, b64ToBytes(it.b64), { metadata: it.meta || {} });
    else await st.setJSON(it.key, it.json, { metadata: it.meta || {} });
    n++;
  }
  if (body.env && typeof body.env === 'object') {
    const cur: any = (await cfg.get('env', { type: 'json' })) || {};
    for (const [k, v] of Object.entries(body.env)) if (typeof v === 'string' && v) cur[k] = v;
    await cfg.setJSON('env', cur); cfgCache = null;
  }
  if (body.done) await cfg.set('importLocked', String(Date.now()));
  return json({ ok: true, n });
}

/* 골프장 좌표: 네이버 비밀키 없이도 지도에 나오도록, 주인 화면(카카오 지도)이 주소로 찾은 좌표를 받아 저장해 두고
   /api/golf 응답에 채워 넣는다. */
const GOLF_LL_KEY = 'golf-ll';
async function readGolfLL(): Promise<Record<string, [number, number]>> {
  try { return (await getStore('settings').get(GOLF_LL_KEY, { type: 'json' })) || {}; } catch { return {}; }
}
async function mergeGolfLL(res: Response) {
  let j: any; try { j = await res.clone().json(); } catch { return res; }
  if (!j || !Array.isArray(j.items)) return res;
  const ll = await readGolfLL();
  let n = 0;
  for (const it of j.items) { if (it && it.lat == null && ll[it.id]) { it.lat = ll[it.id][0]; it.lng = ll[it.id][1]; n++; } }
  if (!n) return res;
  j.located = j.items.filter((x: any) => x && x.lat != null).length;
  const h = new Headers(res.headers); h.delete('content-length');
  return new Response(JSON.stringify(j), { status: res.status, headers: h });
}
async function saveGolfLL(req: Request, url: URL, ctx: any) {
  const out = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  const h = new Headers(); const ck = req.headers.get('cookie'); if (ck) h.set('cookie', ck);
  let auth: any = null;
  try { auth = await (await route(new Request(url.origin + '/api/auth', { headers: h }), ctx)).json(); } catch {}
  if (!auth || !auth.canEdit) return out({ error: 'forbidden' }, 403);
  const b: any = await req.json().catch(() => null);
  const add = b && b.ll && typeof b.ll === 'object' ? b.ll : {};
  const cur = await readGolfLL();
  let n = 0;
  for (const [id, v] of Object.entries(add)) {
    const a = v as any;
    if (!/^[0-9a-f]{6,40}$/.test(id) || !Array.isArray(a)) continue;
    const lat = Number(a[0]), lng = Number(a[1]);
    if (!(lat > 32 && lat < 39.5 && lng > 124 && lng < 132)) continue;
    cur[id] = [Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6]; n++;
  }
  if (n) await getStore('settings').setJSON(GOLF_LL_KEY, cur);
  return out({ ok: true, n, total: Object.keys(cur).length });
}

export default {
  async fetch(req: Request, env: any, ctx: any) {
    bindDB(env.DB, [env.PH1, env.PH2, env.PH3]);
    ALLOWED_ORIGIN = env.OLD_ORIGIN || OLD_ORIGIN;
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (url.pathname === '/api/_import') return handleImport(req, env);
    const cfgEnv = await loadCfgEnv();
    (globalThis as any).Netlify = { env: { get: (k: string) => (env[k] ?? cfgEnv[k] ?? undefined) } };
    if (url.pathname === '/api/_golfll' && req.method === 'POST') return saveGolfLL(req, url, ctx);
    let target = req, relay: Record<string, string> = {};
    if (url.pathname === '/api/_relay' && req.method === 'POST') {
      const b: any = await req.json().catch(() => null);
      const p = String(b?.path || '');
      if (!p.startsWith('/api/') || p.startsWith('/api/_')) return new Response(JSON.stringify({ error: 'bad path' }), { status: 400, headers: { 'content-type': 'application/json' } });
      relay = b?.relay && typeof b.relay === 'object' ? b.relay : {};
      const h = new Headers(); for (const k of ['cookie', 'x-author', 'user-agent', 'cf-connecting-ip']) { const v = req.headers.get(k); if (v) h.set(k, v); }
      target = new Request(url.origin + p, { method: 'GET', headers: h });
    }
    const st = { relay, need: [] as any[] };
    const res = await als.run(st, () => route(target, ctx));
    if (st.need.length && res.status >= 500) {
      const seen = new Set<string>();
      const relayNeed = st.need.filter((n) => { const k = n.method + ' ' + n.url + ' ' + n.body; if (seen.has(k)) return false; seen.add(k); return true; });
      let err = ''; try { err = (await res.clone().json()).error; } catch {}
      return new Response(JSON.stringify({ error: err || 'upstream', relayNeed }), { status: 502, headers: { 'content-type': 'application/json' } });
    }
    if (new URL(target.url).pathname === '/api/golf' && res.ok) return mergeGolfLL(res);
    return res;
  },
};

async function route(req: Request, ctx: any): Promise<Response> {
    const url = new URL(req.url);
    {
    for (const r of ROUTES) {
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      try {
        return await r.fn(req, { params, waitUntil: (p: Promise<any>) => ctx.waitUntil(p), ip: req.headers.get('cf-connecting-ip') || '' });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
    }
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
}
