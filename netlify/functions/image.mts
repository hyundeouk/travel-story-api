import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { callGovApi, jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 사진이 없는 장소의 사진을 한국관광공사 공식 자료에서 이름으로 찾는다.
//  1) 관광정보(KorService2) 키워드 검색 — "내 장소"처럼 우리 목록 밖의 장소용 (src=mine 일 때만)
//  2) 관광사진 갤러리(PhotoGalleryService1) 키워드 검색 — 공공데이터포털에서 활용신청이 되어 있어야 함
// 한 번 찾은 결과(없음 포함)는 저장해 두고 다시 묻지 않는다. 하루 호출 한도를 아끼기 위해서다.
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const TOUR_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const GALLERY_BASE = 'https://apis.data.go.kr/B551011/PhotoGalleryService1';
const cache = () => getStore('cache');

async function sha1(text: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const img = (v: unknown) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, 'https://') : null);
const norm = (s: unknown) => String(s || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[\s·,.\-_/]/g, '').toLowerCase();
const okCode = (c?: string) => c === '0000' || c === '00';

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  try {
    const params = new URL(req.url).searchParams;
    const name = (params.get('q') || '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    const mine = params.get('src') === 'mine';
    const debug = params.get('debug') === '1';
    if (name.length < 2) return jsonResponse({ error: 'bad query' }, { status: 400 });
    const key = Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
    const hash = await sha1(name);
    const dbg: any = {};

    // 1) 관광정보 키워드 검색 (내 장소만)
    if (mine) {
      const tKey = `imgT-${hash}`;
      let t: any = debug ? null : await cache().get(tKey, { type: 'json' });
      if (!t) {
        const r = await callGovApi(TOUR_BASE, 'searchKeyword2', key, { keyword: name, numOfRows: 10 });
        dbg.tour = { resultCode: r.resultCode, resultMsg: r.resultMsg, count: r.items.length, first: r.items[0] || null };
        if (okCode(r.resultCode) || r.items.length) {
          const n = norm(name);
          const hit = r.items.find((it: any) => img(it.firstimage) && (norm(it.title).includes(n) || n.includes(norm(it.title))));
          t = { image: hit ? img(hit.firstimage) : null };
          if (!debug) await cache().setJSON(tKey, t);
        }
      }
      if (t?.image) return jsonResponse({ image: t.image, source: '한국관광공사', ...(debug ? { debug: dbg } : {}) });
    }

    // 2) 관광사진 갤러리 키워드 검색
    // imgG2: 사진 제목에 장소 이름이 들어간 것만 쓴다 (검색어 태그만 맞는 엉뚱한 사진 방지 — 예: 희양산 → "희양산 우렁쌀" 태그의 축제 사진)
    const gKey = `imgG2-${hash}`;
    let g: any = debug ? null : await cache().get(gKey, { type: 'json' });
    let galleryOff = false;
    if (!g) {
      const r = await callGovApi(GALLERY_BASE, 'gallerySearchList1', key, { keyword: name, numOfRows: 10, arrange: 'A' });
      dbg.gallery = { resultCode: r.resultCode, resultMsg: r.resultMsg, count: r.items.length, first: r.items[0] || null };
      if (okCode(r.resultCode) || r.items.length) {
        const n = norm(name);
        const hit = r.items.find((it: any) => img(it.galWebImageUrl) && norm(it.galTitle).length >= 2 && (norm(it.galTitle).includes(n) || n.includes(norm(it.galTitle))));
        g = { image: hit ? img(hit.galWebImageUrl) : null, title: hit?.galTitle || '', photographer: hit?.galPhotographer || '' };
        if (!debug) await cache().setJSON(gKey, g);
      } else {
        galleryOff = true; // 활용신청이 안 되어 있거나 일시 오류
      }
    }
    return jsonResponse({
      image: g?.image || null,
      source: g?.image ? '한국관광공사 관광사진' : null,
      title: g?.title || '',
      photographer: g?.photographer || '',
      ...(galleryOff ? { galleryOff: true } : {}),
      ...(debug ? { debug: dbg } : {}),
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/image',
};
