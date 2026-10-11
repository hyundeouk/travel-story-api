import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 위키백과(한국어) 요약 + 위키미디어 공용 사진.
//   /api/wiki?q=주왕산&lat=36.39&lng=129.17&addr=경상북도 청송군
// 공식 API(MediaWiki·Wikidata)로 받고, 사진은 위키미디어 공용(자유 라이선스)에 있는 것만 쓴다
// (위키백과에만 올라간 비자유 사진은 쓰지 않는다). 사진마다 촬영자·라이선스를 함께 돌려준다.
// 이름만 같은 다른 곳을 막으려고 좌표(15km 안) 또는 주소의 시·군 이름으로 확인한다.
// 같은 곳은 30일 동안 저장해 두고 다시 쓴다.
const KO = 'https://ko.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const UA = 'TravelStory/1.0 (https://travel-story-api.netlify.app; personal travel diary)';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_IMAGES = 6;

async function sha1(text: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function mw(base: string, params: Record<string, string>) {
  const url = new URL(base);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`wiki http ${res.status}`);
  return res.json();
}
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * t) / 2) ** 2 + Math.cos(aLat * t) * Math.cos(bLat * t) * Math.sin(((bLng - aLng) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const norm = (s: unknown) => String(s ?? '').replace(/\(.*?\)|\s+/g, '').toLowerCase();
const strip = (s: unknown) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// "경상북도 문경시 가은읍" → ["문경시"] (시·군·구 이름)
function placeTokens(addr: string) {
  return String(addr || '').split(/[\s,ㆍ·]+/).filter((w) => /[시군구]$/.test(w) && w.length >= 3 && !/(특별|광역)/.test(w)).slice(0, 4);
}
const BAD_FILE = /(map|지도|위치도|locator|location|logo|로고|flag|seal|emblem|coat_of_arms|\.svg$|\.gif$|\.tif|\.pdf$|\.webm$|\.ogv$)/i;
const OK_LICENSE = /^(cc[ -]?by|cc0|public domain|pd|gfdl|attribution|no restrictions)/i;

type Page = { title: string; pageid?: number; missing?: boolean; extract?: string; pageimage?: string; coordinates?: { lat: number; lon: number }[]; pageprops?: any; fullurl?: string };

async function pagesByTitle(titles: string[]): Promise<Page[]> {
  const j: any = await mw(KO, {
    action: 'query', prop: 'extracts|pageimages|pageprops|coordinates|info', exintro: '1', explaintext: '1', exchars: '900',
    piprop: 'name', inprop: 'url', redirects: '1', titles: titles.join('|'),
  });
  return (j?.query?.pages || []).filter((p: Page) => !p.missing && p.pageid);
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  const q = new URL(req.url).searchParams;
  const name = (q.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const base = name.replace(/\(.*?\)/g, '').trim();
  const lat = Number(q.get('lat')), lng = Number(q.get('lng'));
  const hasLL = Number.isFinite(lat) && Number.isFinite(lng) && lat > 32 && lng > 124;
  const addr = (q.get('addr') || '').slice(0, 60);
  const debug = q.get('debug') === '1';
  if (base.length < 2) return jsonResponse({ error: 'bad query' }, { status: 400 });

  const store = getStore('cache');
  const cKey = `wiki-v1-${await sha1(name + '|' + (hasLL ? lat.toFixed(2) + ',' + lng.toFixed(2) : '') + '|' + addr)}`;
  if (!debug) {
    const hit: any = await store.get(cKey, { type: 'json' });
    if (hit && Date.now() - (hit.at || 0) < TTL_MS) return jsonResponse({ ...hit, cached: true });
  }

  try {
    const tokens = placeTokens(addr);
    const words = tokens.map((w) => w.replace(/[시군구]$/, '')).filter((w) => w.length >= 2); // "문경" — 요약 글 확인용
    // 같은 곳인지 확인: 좌표가 있으면 15km 안, 없으면 요약 글에 주소의 시·군 이름이 들어 있어야 한다
    const sure = (p: Page) => {
      if (p.pageprops && 'disambiguation' in p.pageprops) return false;
      const c = p.coordinates && p.coordinates[0];
      if (hasLL && c) return km(lat, lng, c.lat, c.lon) <= 15;
      if (words.length) return words.some((w) => String(p.extract || '').includes(w));
      return !hasLL; // 좌표도 주소도 없으면 이름만으로
    };
    // 1) 이름으로 찾기: "주왕산", "백운산 (광양시)" 같은 꼴도 함께 본다
    // 위키백과 제목 꼴: "백운산 (광양)", "백운산 (광양시)", "경주 남산" 등
    const paren = (name.match(/\((.*?)\)/) || [])[1] || '';
    const tries = Array.from(new Set([name, base, ...(paren ? [`${base} (${paren})`, `${paren} ${base}`] : []),
      ...tokens.map((w) => `${base} (${w})`), ...words.map((w) => `${base} (${w})`), ...words.map((w) => `${w} ${base}`)])).slice(0, 12);
    let page: Page | null = null;
    for (const p of await pagesByTitle(tries)) { if (sure(p)) { page = p; break; } }
    // 2) 좌표 주변(10km)의 문서 중 이름이 같은 것
    if (!page && hasLL) {
      const g: any = await mw(KO, { action: 'query', list: 'geosearch', gscoord: `${lat}|${lng}`, gsradius: '10000', gslimit: '50' });
      const cand = (g?.query?.geosearch || []).filter((x: any) => norm(x.title).startsWith(norm(base)));
      if (cand.length) {
        const ps = await pagesByTitle(cand.slice(0, 5).map((x: any) => x.title));
        page = ps.find(sure) || null;
      }
    }
    if (!page) {
      const out = { at: Date.now(), none: true, images: [] as any[] };
      if (!debug) await store.setJSON(cKey, out);
      return jsonResponse(out);
    }

    // 3) 사진 후보: 문서 대표 사진, 위키데이터 대표 사진(P18), 공용 분류(P373)의 사진들
    const files: string[] = [];
    if (page.pageimage) files.push('File:' + page.pageimage);
    const qid = page.pageprops?.wikibase_item;
    let category = '';
    if (qid) {
      const wd: any = await mw(WIKIDATA, { action: 'wbgetentities', ids: qid, props: 'claims' }).catch(() => null);
      const cl = wd?.entities?.[qid]?.claims || {};
      for (const c of cl.P18 || []) { const v = c?.mainsnak?.datavalue?.value; if (v) files.push('File:' + v); }
      category = cl.P373?.[0]?.mainsnak?.datavalue?.value || '';
    }
    if (category) {
      const cm: any = await mw(COMMONS, { action: 'query', list: 'categorymembers', cmtitle: 'Category:' + category, cmtype: 'file', cmlimit: '20' }).catch(() => null);
      for (const m of cm?.query?.categorymembers || []) files.push(m.title);
    }
    const uniq = Array.from(new Set(files.map((f) => f.replace(/_/g, ' ')))).filter((f) => !BAD_FILE.test(f)).slice(0, 20);
    let images: any[] = [];
    if (uniq.length) {
      // 위키미디어 공용에 있는 파일만 (위키백과에만 있는 비자유 파일은 여기서 걸러진다)
      const ii: any = await mw(COMMONS, {
        action: 'query', prop: 'imageinfo', titles: uniq.join('|'), iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280',
        iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|ImageDescription|Credit',
      });
      const byTitle: Record<string, any> = {};
      for (const p of ii?.query?.pages || []) if (p.imageinfo?.[0] && !p.missing) byTitle[p.title] = p.imageinfo[0];
      for (const t of uniq) {
        const info = byTitle[t];
        if (!info || !/^image\/(jpeg|png)$/.test(info.mime || '')) continue;
        if ((info.width || 0) < 800 || (info.height || 0) < 450) continue;
        const md = info.extmetadata || {};
        const license = strip(md.LicenseShortName?.value);
        if (!OK_LICENSE.test(license)) continue;
        images.push({
          url: info.thumburl || info.url,
          thumb: (info.thumburl || info.url || '').replace(/\/1280px-/, '/640px-'),
          wide: info.width / info.height >= 1.1,
          desc: strip(md.ImageDescription?.value).slice(0, 80),
          artist: strip(md.Artist?.value).slice(0, 40),
          license,
          licenseUrl: strip(md.LicenseUrl?.value) || null,
          page: info.descriptionurl || null,
        });
      }
      // 가로 사진(전체가 보이는 풍경)을 앞으로
      images.sort((a, b) => Number(b.wide) - Number(a.wide));
      images = images.slice(0, MAX_IMAGES);
    }
    const out = {
      at: Date.now(),
      title: page.title,
      url: page.fullurl || `https://ko.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      extract: String(page.extract || '').trim(),
      textLicense: 'CC BY-SA 4.0',
      images,
    };
    if (!debug) await store.setJSON(cKey, out);
    return jsonResponse(out);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/wiki',
};
