import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 날씨: 기상청 단기예보(3일) + (100대 명산이면) 산림청 산악기상 관측값.
//   /api/weather?lat=38.12&lng=128.46&mt=설악산
// - 단기예보: 위경도를 기상청 격자(nx, ny)로 바꿔 가장 최근 발표분을 받는다. 같은 격자·같은 발표는 저장해 두고 다시 쓴다.
// - 산악기상: 전국 산악기상 관측소의 최신 관측값을 10분 동안 저장해 두고, 산 이름과 같은 관측소를 고른다.
// 공공데이터포털에서 아직 "활용신청"을 하지 않았으면 apply 목록에 신청할 자료를 담아 돌려준다.
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const FCST_API = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const ULTRA_API = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst';
const NOW_API = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';
const MT_API = 'https://apis.data.go.kr/1400377/mtweather/mountListSearch';
const DATASETS = {
  fcst: { name: '기상청_단기예보 조회서비스', page: 'https://www.data.go.kr/data/15084084/openapi.do' },
  mt: { name: '산림청 국립산림과학원_산악기상정보', page: 'https://www.data.go.kr/data/15084696/openapi.do' },
};
const MT_TTL_MS = 10 * 60 * 1000;

class NeedApply extends Error {}
function looksUnregistered(status: number, text: string) {
  return status === 401 || status === 403 || /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|"returnReasonCode"\s*:\s*"(30|20)"|<returnReasonCode>\s*(30|20)\s*</i.test(text);
}
function itemsOf(data: any): any[] {
  const root = data?.response || data || {};
  const code = String(root?.header?.resultCode ?? '');
  if (code === '03') return []; // NO_DATA
  if (code && code !== '0' && code !== '00' && code !== '0000') throw new Error(`${code} ${root?.header?.resultMsg || ''}`.trim());
  let items = root?.body?.items;
  if (items && !Array.isArray(items)) items = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
  return items || [];
}
async function getJson(url: string, ms = 9000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  const text = await res.text();
  if (looksUnregistered(res.status, text)) throw new NeedApply();
  try { return JSON.parse(text); } catch { throw new Error(`not json (${res.status}) ${text.slice(0, 120)}`); }
}

// 기상청 서버는 한참 쉬었다 처음 부르면 느리거나 끊기는 일이 잦다 → 한 번 더 시도하되, 전체 시간(deadline)을 넘기지 않는다
async function getJsonRetry(url: string, deadline: number) {
  let lastErr: any;
  for (let i = 0; i < 2; i++) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    try { return await getJson(url, Math.min(i === 0 ? 6500 : 8000, left)); }
    catch (err) { if (err instanceof NeedApply) throw err; lastErr = err; }
  }
  throw lastErr || new Error('timeout');
}

// 기상청 격자 변환 (Lambert Conformal Conic, 기상청 동네예보 격자 5km)
function toGrid(lat: number, lng: number) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const D = Math.PI / 180.0;
  const re = RE / GRID, slat1 = SLAT1 * D, slat2 = SLAT2 * D, olon = OLON * D, olat = OLAT * D;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * D - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

// 한국 시각 → 'YYYYMMDD', 'HHmm'
function kstParts(ms: number) {
  const d = new Date(ms + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`, hour: d.getUTCHours(), min: d.getUTCMinutes(), hm: `${p(d.getUTCHours())}${p(d.getUTCMinutes())}` };
}
// 단기예보 발표: 02·05·08·11·14·17·20·23시 (발표 뒤 10분쯤부터 받을 수 있다 → 15분 여유)
function latestBase(now = Date.now()) {
  const k = kstParts(now - 15 * 60 * 1000);
  const hours = [2, 5, 8, 11, 14, 17, 20, 23];
  const h = hours.filter((x) => x <= k.hour).pop();
  if (h == null) return { date: kstParts(now - 15 * 60 * 1000 - 24 * 3600 * 1000).date, time: '2300' };
  return { date: k.date, time: String(h).padStart(2, '0') + '00' };
}
function prevBase(b: { date: string; time: string }) {
  const y = +b.date.slice(0, 4), m = +b.date.slice(4, 6) - 1, d = +b.date.slice(6, 8), h = +b.time.slice(0, 2);
  const ms = Date.UTC(y, m, d, h - 9) - 3 * 3600 * 1000 + 20 * 60 * 1000;
  return latestBase(ms);
}

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function forecastFresh(lat: number, lng: number, key: string, store: any, deadline: number) {
  const { nx, ny } = toGrid(lat, lng);
  let base = latestBase();
  for (let attempt = 0; attempt < 2; attempt++) {
    const cKey = `wx-v1-${nx}-${ny}-${base.date}${base.time}`;
    const hit: any = await store.get(cKey, { type: 'json' });
    if (hit) return { ...hit, cached: true };
    const url = `${FCST_API}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${base.date}&base_time=${base.time}&nx=${nx}&ny=${ny}`;
    const items = itemsOf(await getJsonRetry(url, deadline));
    if (!items.length) { base = prevBase(base); continue; } // 아직 발표 전이면 한 번 앞의 발표분
    const byTime = new Map<string, any>();
    const days = new Map<string, any>();
    for (const it of items) {
      const k = `${it.fcstDate}${it.fcstTime}`;
      if (!byTime.has(k)) byTime.set(k, { d: String(it.fcstDate), t: String(it.fcstTime) });
      const h = byTime.get(k);
      const v = it.fcstValue;
      switch (it.category) {
        case 'TMP': h.tmp = num(v); break;
        case 'SKY': h.sky = num(v); break;
        case 'PTY': h.pty = num(v); break;
        case 'POP': h.pop = num(v); break;
        case 'WSD': h.wsd = num(v); break;
        case 'VEC': h.vec = num(v); break;
        case 'REH': h.reh = num(v); break;
        case 'PCP': h.pcp = String(v); break;
        case 'SNO': h.sno = String(v); break;
        case 'TMN': case 'TMX': {
          const d = String(it.fcstDate);
          if (!days.has(d)) days.set(d, { d });
          days.get(d)[it.category === 'TMN' ? 'tmn' : 'tmx'] = num(v);
          break;
        }
      }
    }
    const hours = Array.from(byTime.values()).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
    // 날마다: 최저·최고(발표가 없으면 시간별 기온으로), 가장 높은 강수확률, 오전·오후 대표 하늘
    for (const h of hours) { if (!days.has(h.d)) days.set(h.d, { d: h.d }); }
    const pick = (list: any[]) => {
      if (!list.length) return null;
      const rain = list.filter((x) => x.pty > 0);
      if (rain.length) return { pty: rain[Math.floor(rain.length / 2)].pty, sky: null };
      const sky = list.map((x) => x.sky).filter((x) => x != null).sort((a, b) => a - b);
      return { pty: 0, sky: sky[Math.floor(sky.length / 2)] ?? null };
    };
    const dayList = Array.from(days.values()).sort((a, b) => a.d.localeCompare(b.d)).map((d) => {
      const hs = hours.filter((h) => h.d === d.d);
      const temps = hs.map((h) => h.tmp).filter((x) => x != null);
      return {
        d: d.d,
        tmn: d.tmn ?? (temps.length ? Math.min(...temps) : null),
        tmx: d.tmx ?? (temps.length ? Math.max(...temps) : null),
        pop: hs.reduce((m, h) => Math.max(m, h.pop ?? 0), 0),
        wsdMax: hs.reduce((m, h) => Math.max(m, h.wsd ?? 0), 0),
        am: pick(hs.filter((h) => +h.t < 1200 && +h.t >= 600)),
        pm: pick(hs.filter((h) => +h.t >= 1200 && +h.t <= 1800)),
      };
    }).slice(0, 4);
    const out = { at: Date.now(), nx, ny, base: base.date + base.time, days: dayList, hours: hours.slice(0, 48) };
    await store.setJSON(cKey, out);
    return out;
  }
  return { nx, ny, none: true, days: [], hours: [] };
}

// 기상청이 느리거나 끊겨도 "마지막으로 받은 예보"를 대신 보여 준다 (격자마다 따로 저장)
async function forecast(lat: number, lng: number, key: string, store: any, deadline: number) {
  const { nx, ny } = toGrid(lat, lng);
  const lastKey = `wx-last-v1-${nx}-${ny}`;
  const stale = async () => {
    const last: any = await store.get(lastKey, { type: 'json' }).catch(() => null);
    return last && last.days?.length && Date.now() - (last.at || 0) < 30 * 3600 * 1000 ? { ...last, cached: true, stale: true } : null;
  };
  try {
    const f: any = await forecastFresh(lat, lng, key, store, deadline);
    if (f?.days?.length) { if (!f.cached) await store.setJSON(lastKey, f).catch(() => {}); return f; }
    return (await stale()) || f;
  } catch (err) {
    if (err instanceof NeedApply) throw err;
    const s = await stale();
    if (s) return s;
    throw err;
  }
}

// 초단기실황(지금 관측값): 매시 정각 자료가 40분쯤 나온다 → 45분 전 시각의 정각 자료, 없으면 한 시간 앞
async function nowcast(lat: number, lng: number, key: string, store: any, deadline: number) {
  const { nx, ny } = toGrid(lat, lng);
  for (const back of [45, 105]) {
    const k = kstParts(Date.now() - back * 60 * 1000);
    const base = { date: k.date, time: String(k.hour).padStart(2, '0') + '00' };
    const cKey = `wxn-v1-${nx}-${ny}-${base.date}${base.time}`;
    const hit: any = await store.get(cKey, { type: 'json' });
    if (hit) return hit;
    const url = `${NOW_API}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=20&dataType=JSON&base_date=${base.date}&base_time=${base.time}&nx=${nx}&ny=${ny}`;
    let items: any[];
    try { items = itemsOf(await getJsonRetry(url, deadline)); }
    catch (err) { if (err instanceof NeedApply) throw err; continue; }   // 이 시각 자료를 못 받으면 한 시간 앞 자료로
    if (!items.length) continue;
    const o: any = { base: base.date + base.time };
    for (const it of items) {
      const v = num(it.obsrValue);
      switch (it.category) {
        case 'T1H': o.tmp = v; break;
        case 'REH': o.reh = v; break;
        case 'WSD': o.wsd = v; break;
        case 'VEC': o.vec = v; break;
        case 'PTY': o.pty = v; break;
        case 'RN1': o.rn1 = v; break;
      }
    }
    if (o.tmp == null) continue;
    await store.setJSON(cKey, o);
    return o;
  }
  return null;
}

// 초단기예보(앞으로 6시간): 매시 30분 자료가 45분쯤 나온다. 실황은 한 시간쯤 늦어서 지금 비가 와도 "비 없음"으로 나올 수 있어, 지금 하늘·비는 이 자료로 보충한다
async function ultra(lat: number, lng: number, key: string, store: any, deadline: number) {
  const { nx, ny } = toGrid(lat, lng);
  const k = kstParts(Date.now() - 45 * 60 * 1000);
  const base = k.min >= 30 ? { date: k.date, time: String(k.hour).padStart(2, '0') + '30' } : (() => {
    const q = kstParts(Date.now() - 45 * 60 * 1000 - 60 * 60 * 1000);
    return { date: q.date, time: String(q.hour).padStart(2, '0') + '30' };
  })();
  const cKey = `wxu-v1-${nx}-${ny}-${base.date}${base.time}`;
  const hit: any = await store.get(cKey, { type: 'json' });
  if (hit) return hit;
  const url = `${ULTRA_API}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=100&dataType=JSON&base_date=${base.date}&base_time=${base.time}&nx=${nx}&ny=${ny}`;
  const items = itemsOf(await getJsonRetry(url, deadline));
  if (!items.length) return null;
  const byTime = new Map<string, any>();
  for (const it of items) {
    const kk = `${it.fcstDate}${it.fcstTime}`;
    if (!byTime.has(kk)) byTime.set(kk, { d: String(it.fcstDate), t: String(it.fcstTime) });
    const h = byTime.get(kk);
    const v = it.fcstValue;
    if (it.category === 'SKY') h.sky = num(v);
    else if (it.category === 'PTY') h.pty = num(v);
    else if (it.category === 'T1H') h.tmp = num(v);
    else if (it.category === 'RN1') h.rn1 = String(v);
  }
  const out = { at: Date.now(), base: base.date + base.time, hours: Array.from(byTime.values()).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t)) };
  await store.setJSON(cKey, out);
  return out;
}

const norm = (s: unknown) => String(s ?? '').replace(/\s+|\(.*?\)/g, '');
async function mountainObs(name: string, key: string, store: any) {
  let all: any = await store.get('mtwx-v1-all', { type: 'json' });
  if (!all || Date.now() - (all.at || 0) > MT_TTL_MS) {
    const baseUrl = `${MT_API}?ServiceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=1000&_type=json`;
    let rows = itemsOf(await getJson(baseUrl));
    // 관측 시각을 주지 않으면 비어 오는 경우를 대비해 몇 분 전 시각으로 다시 한 번
    if (!rows.length) {
      for (const back of [3, 10, 20]) {
        const k = kstParts(Date.now() - back * 60 * 1000);
        rows = itemsOf(await getJson(`${baseUrl}&tm=${k.date}${k.hm}`));
        if (rows.length) break;
      }
    }
    all = {
      at: Date.now(),
      rows: rows.map((r: any) => ({
        id: String(r.obsid ?? ''), name: String(r.obsname ?? '').trim(), area: String(r.localarea ?? ''), tm: String(r.tm ?? ''),
        t2: num(r.tm2m), t10: num(r.tm10m), h2: num(r.hm2m), ws2: num(r.ws2m), ws10: num(r.ws10m),
        wd: String(r.wd10mstr || r.wd2mstr || ''), rn: num(r.rn ?? r.cprn), pa: num(r.pa),
      })),
    };
    if (all.rows.length) await store.setJSON('mtwx-v1-all', all);
  }
  // "백운산(광양)"처럼 같은 이름이 여럿인 산은 관측소 이름에 괄호 속 지명이 있어야 고른다
  const base = norm(name);
  const paren = (name.match(/\((.*?)\)/) || [])[1] || '';
  const found = all.rows.filter((r: any) => {
    const n = norm(r.name);
    if (!n.startsWith(base)) return false;
    return !paren || r.name.includes(paren.replace(/[시군]$/, ''));
  });
  const seen = new Set<string>();
  return found.filter((r: any) => (seen.has(r.id) ? false : (seen.add(r.id), true))).slice(0, 3);
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  const q = new URL(req.url).searchParams;
  const lat = Number(q.get('lat')), lng = Number(q.get('lng'));
  if (!(lat > 32 && lat < 39.5 && lng > 124 && lng < 132)) return jsonResponse({ error: 'bad lat/lng' }, { status: 400 });
  const mt = (q.get('mt') || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const key = Netlify.env.get('WEATHER_API_KEY') || Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
  const store = getStore('cache');
  const apply: any[] = [];
  const out: any = { apply };

  const deadline = Date.now() + 20000;
  const jobs: Promise<void>[] = [
    forecast(lat, lng, key, store, deadline).then((f) => { out.fcst = f; }).catch((err) => {
      if (err instanceof NeedApply) apply.push(DATASETS.fcst); else out.fcstError = String(err?.message || err).slice(0, 160);
    }),
  ];
  jobs.push(nowcast(lat, lng, key, store, deadline).then((n) => { if (n) out.now = n; }).catch(() => { /* 실황이 없어도 예보는 보여준다 */ }));
  jobs.push(ultra(lat, lng, key, store, deadline).then((u) => { if (u) out.ultra = u; }).catch(() => { /* 없어도 다른 자료로 보여준다 */ }));
  if (mt.length >= 2) {
    jobs.push(mountainObs(mt, key, store).then((m) => { out.mt = m; }).catch((err) => {
      if (err instanceof NeedApply) apply.push(DATASETS.mt); else out.mtError = String(err?.message || err).slice(0, 160);
    }));
  }
  await Promise.all(jobs);
  return jsonResponse(out, { headers: { 'Cache-Control': 'no-store' } });
};

export const config: Config = {
  path: '/api/weather',
};
