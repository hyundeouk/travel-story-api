import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { callGovApi, jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';
import { searchHeritage } from '../../src/lib/heritage.mts';

// 지도 탭 검색창: 이름으로 문화유산(국가유산청)과 명소·맛집·행사(한국관광공사)를 찾는다.
//   /api/mapsearch?q=불국사
// 100대 명산·휴양림은 화면이 이미 전국 목록을 갖고 있어서 화면에서 직접 찾는다.
// 같은 검색어는 하루 동안 저장해 두고 다시 묻지 않는다.
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const TOUR_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const DAY = 24 * 60 * 60 * 1000;

async function sha1(text: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const dashed = (v: unknown) => { const s = String(v ?? ''); return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null; };
// 관광공사 종류 → 앱의 분류 (12 관광지·14 문화시설·28 레포츠 → 명소, 39 음식점 → 맛집, 15 행사 → 행사)
const CAT: Record<string, string> = { '12': '명소', '14': '명소', '28': '명소', '39': '맛집', '15': '행사' };

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  const q = (new URL(req.url).searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  if (q.length < 2) return jsonResponse({ error: 'bad query' }, { status: 400 });
  const store = getStore('cache');
  const cKey = `msearch-v1-${await sha1(q)}`;
  const hit: any = await store.get(cKey, { type: 'json' });
  if (hit && Date.now() - (hit.at || 0) < DAY) return jsonResponse({ ...hit, cached: true });

  const key = Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
  const [h, t] = await Promise.allSettled([
    searchHeritage(q, 30),
    callGovApi(TOUR_BASE, 'searchKeyword2', key, { keyword: q, numOfRows: 40, arrange: 'A' }),
  ]);
  const heritage = h.status === 'fulfilled' ? h.value.filter((it: any) => it.lat != null && it.lng != null) : [];
  const tour = t.status === 'fulfilled'
    ? t.value.items
        .filter((it: any) => CAT[String(it.contenttypeid)] && Number(it.mapy) > 32 && Number(it.mapx) > 124)
        .map((it: any) => {
          const cat = CAT[String(it.contenttypeid)];
          const address = it.addr1 || it.addr2 || '';
          const base = { id: String(it.contentid), ctype: String(it.contenttypeid), name: String(it.title || ''), address, mapX: Number(it.mapx), mapY: Number(it.mapy), image: it.firstimage || null, tel: it.tel || null, overview: null };
          return { cat, item: cat === '행사' ? { ...base, place: address, startDate: dashed(it.eventstartdate), endDate: dashed(it.eventenddate) } : { ...base, type: cat === '맛집' ? 'restaurant' : 'attraction' } };
        })
    : [];
  const out = { at: Date.now(), q, heritage, tour, errors: [h, t].filter((r) => r.status === 'rejected').length };
  if (!out.errors) await store.setJSON(cKey, out);
  return jsonResponse(out);
};

export const config: Config = {
  path: '/api/mapsearch',
};
