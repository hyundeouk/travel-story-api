import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { callGovApi, jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 지도 탭 "내 주변": 내 위치에서 50km 안의 명소·맛집·행사 (한국관광공사 TourAPI).
//   /api/nearby?lat=37.52&lng=126.86
// TourAPI 위치 기반 목록은 반경이 최대 20km라서, 가운데 1곳 + 30km 떨어진 6곳(육각형)을 함께 묻는다.
// 같은 동네(약 5km 칸)는 12시간 동안 저장해 두고 다시 쓴다 (TourAPI 하루 호출 한도 보호).
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const TOUR_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const RADIUS_KM = 50;
const TTL_MS = 12 * 60 * 60 * 1000;

const ATTR_TYPES = new Set(['12', '14', '28']); // 관광지·문화시설·레포츠 → 명소
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
function km(a: [number, number], b: [number, number]) {
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin(((b[0] - a[0]) * t) / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(((b[1] - a[1]) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function today() {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // 한국 날짜
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}
const dashed = (v: unknown) => { const s = String(v ?? ''); return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null; };

function centers(lat: number, lng: number) {
  const out: [number, number][] = [[lat, lng]];
  const dLat = 30 / 111;
  const dLng = 30 / (111 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 * Math.PI) / 180;
    out.push([lat + dLat * Math.cos(a), lng + dLng * Math.sin(a)]);
  }
  return out;
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  const q = new URL(req.url).searchParams;
  const lat = Number(q.get('lat')), lng = Number(q.get('lng'));
  if (!(lat > 32 && lat < 39 && lng > 124 && lng < 132.5)) return jsonResponse({ error: 'bad point' }, { status: 400 });

  // 약 5km 칸으로 묶어 저장
  const cell = [Math.round(lat * 20) / 20, Math.round(lng * 20) / 20] as [number, number];
  const cKey = `nearby-v1-${cell[0].toFixed(2)}_${cell[1].toFixed(2)}-${today()}`;
  const store = getStore('cache');
  const hit: any = await store.get(cKey, { type: 'json' });
  if (hit && Date.now() - (hit.at || 0) < TTL_MS) return jsonResponse({ ...hit, cached: true });

  const key = Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
  const pts = centers(cell[0], cell[1]);
  const calls: Promise<any>[] = [];
  for (const [y, x] of pts) {
    calls.push(callGovApi(TOUR_BASE, 'locationBasedList2', key, { mapX: x.toFixed(6), mapY: y.toFixed(6), radius: 20000, arrange: 'E', contentTypeId: 12, numOfRows: 150 }));
    calls.push(callGovApi(TOUR_BASE, 'locationBasedList2', key, { mapX: x.toFixed(6), mapY: y.toFixed(6), radius: 20000, arrange: 'E', contentTypeId: 14, numOfRows: 40 }));
    calls.push(callGovApi(TOUR_BASE, 'locationBasedList2', key, { mapX: x.toFixed(6), mapY: y.toFixed(6), radius: 20000, arrange: 'E', contentTypeId: 39, numOfRows: 100 }));
  }
  calls.push(callGovApi(TOUR_BASE, 'searchFestival2', key, { eventStartDate: today(), numOfRows: 2000 }));
  const res = await Promise.allSettled(calls);

  const seen = new Set<string>();
  const attractions: any[] = [], restaurants: any[] = [], festivals: any[] = [];
  let failed = 0;
  res.forEach((r) => {
    if (r.status !== 'fulfilled') { failed++; return; }
    for (const it of r.value.items || []) {
      const y = Number(it.mapy), x = Number(it.mapx);
      if (!(y > 32 && x > 124)) continue;
      const d = km([lat, lng], [y, x]);
      if (d > RADIUS_KM) continue;
      const id = String(it.contentid);
      const t = String(it.contenttypeid);
      if (seen.has(id)) continue;
      seen.add(id);
      const base = { id, name: String(it.title || ''), address: it.addr1 || it.addr2 || '', mapX: r5(x), mapY: r5(y), image: it.firstimage || null, tel: it.tel || null, overview: null, dist: Math.round(d * 10) / 10 };
      if (t === '15') festivals.push({ ...base, place: base.address, startDate: dashed(it.eventstartdate), endDate: dashed(it.eventenddate), organizer: null, homepage: null });
      else if (t === '39') restaurants.push({ ...base, type: 'restaurant', areaCode: it.areacode });
      else if (ATTR_TYPES.has(t)) attractions.push({ ...base, type: 'attraction', areaCode: it.areacode, ctype: t });
    }
  });
  const byDist = (a: any, b: any) => a.dist - b.dist;
  attractions.sort(byDist); restaurants.sort(byDist); festivals.sort(byDist);
  const out = { at: Date.now(), lat, lng, radiusKm: RADIUS_KM, attractions, restaurants, festivals, failed };
  if (!failed) await store.setJSON(cKey, out);
  return jsonResponse(out);
};

export const config: Config = {
  path: '/api/nearby',
};
