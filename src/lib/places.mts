/**
 * 한국관광공사 TourAPI(KorService2) 명소·맛집 조회.
 * 공식 문서: https://www.data.go.kr/data/15101578/openapi.do
 */
import { callGovApi } from './govApi.mts';
import { mockAttractions } from '../data/mockData.mts';

const TOUR_API_BASE = 'https://apis.data.go.kr/B551011/KorService2';

// TourAPI contentTypeId: 12=관광지, 39=음식점
const CONTENT_TYPE: Record<string, string> = {
  attraction: '12',
  restaurant: '39',
};

export type PlaceType = 'attraction' | 'restaurant';

function normalize(rawItem: any, type: PlaceType) {
  return {
    id: String(rawItem.contentid ?? rawItem.id),
    type,
    name: rawItem.title,
    address: rawItem.addr1 || rawItem.addr2 || '',
    areaCode: rawItem.areacode,
    mapX: Number(rawItem.mapx),
    mapY: Number(rawItem.mapy),
    image: rawItem.firstimage || null,
    tel: rawItem.tel || null,
    overview: rawItem.overview || null,
  };
}

export async function fetchPlaces(opts: {
  type: PlaceType;
  areaCode?: string;
  mapX?: number;
  mapY?: number;
  radius?: number;
  serviceKey?: string;
}) {
  const type: PlaceType = opts.type === 'restaurant' ? 'restaurant' : 'attraction';

  if (!opts.serviceKey) {
    return {
      mock: true,
      items: mockAttractions.filter((item) => item.type === type),
    };
  }

  const contentTypeId = CONTENT_TYPE[type];
  const operation = opts.mapX && opts.mapY ? 'locationBasedList2' : 'areaBasedList2';
  // 교훈: 값 없는 선택 파라미터는 빈 문자열로라도 보내지 말 것 — callGovApi가
  // undefined 값을 알아서 제외해주므로 그냥 opts.areaCode를 그대로 넘기면 됨.
  const params =
    opts.mapX && opts.mapY
      ? { contentTypeId, mapX: opts.mapX, mapY: opts.mapY, radius: opts.radius || 2000 }
      : { contentTypeId, areaCode: opts.areaCode };

  const result = await callGovApi(TOUR_API_BASE, operation, opts.serviceKey, params);
  return {
    mock: false,
    resultCode: result.resultCode,
    resultMsg: result.resultMsg,
    items: result.items.map((item) => normalize(item, type)),
  };
}
