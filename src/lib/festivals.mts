/**
 * 지역 행사·축제 — 한국관광공사 TourAPI(KorService2) searchFestival2.
 * (문화체육관광부의 별도 서비스가 아니라, TourAPI와 같은 base URL임을 실제 호출로
 * 확인함 — 2026-09 여행앱 프로젝트 기록 참고.) 문서: https://www.data.go.kr/data/15013104/openapi.do
 */
import { callGovApi } from './govApi.mts';
import { mockFestivals } from '../data/mockData.mts';

const TOUR_API_BASE = 'https://apis.data.go.kr/B551011/KorService2';

function todayYYYYMMDD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function toDashedDate(yyyymmdd: string | undefined): string | null {
  if (!yyyymmdd) return null;
  const s = String(yyyymmdd);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function normalize(rawItem: any) {
  return {
    id: String(rawItem.contentid ?? rawItem.id),
    name: rawItem.title,
    place: rawItem.addr1 || rawItem.addr2 || '',
    startDate: toDashedDate(rawItem.eventstartdate),
    endDate: toDashedDate(rawItem.eventenddate),
    organizer: null,
    tel: rawItem.tel || null,
    homepage: null,
    address: rawItem.addr1 || rawItem.addr2 || '',
    mapX: Number(rawItem.mapx),
    mapY: Number(rawItem.mapy),
    overview: null,
    image: rawItem.firstimage || null,
  };
}

export async function fetchFestivals(opts: { areaCode?: string; serviceKey?: string }) {
  if (!opts.serviceKey) {
    return { mock: true, items: mockFestivals };
  }

  const result = await callGovApi(TOUR_API_BASE, 'searchFestival2', opts.serviceKey, {
    areaCode: opts.areaCode,
    eventStartDate: todayYYYYMMDD(),
  });
  return {
    mock: false,
    resultCode: result.resultCode,
    resultMsg: result.resultMsg,
    items: result.items.map(normalize),
  };
}
