/**
 * 공공데이터 인증키가 없을 때(또는 키 호출이 실패했을 때) 보여줄 샘플 데이터.
 * 번들러(esbuild)가 JSON 파일을 별도 리소스로 다루는 것에 의존하지 않도록
 * 그냥 TypeScript 객체로 바로 내장해둠.
 */

export const mockAttractions = [
  {
    id: 'mock-attr-1',
    type: 'attraction',
    name: '경복궁',
    address: '서울특별시 종로구 사직로 161',
    areaCode: '1',
    mapX: 126.977,
    mapY: 37.5796,
    image: null,
    tel: '02-3700-3900',
    overview: '조선 왕조의 법궁. 서울 도심 대표 관광지 (샘플 데이터)',
  },
  {
    id: 'mock-attr-2',
    type: 'attraction',
    name: 'N서울타워',
    address: '서울특별시 용산구 남산공원길 105',
    areaCode: '1',
    mapX: 126.9882,
    mapY: 37.5512,
    image: null,
    tel: '02-3455-9277',
    overview: '남산 정상의 전망 타워 (샘플 데이터)',
  },
  {
    id: 'mock-food-1',
    type: 'restaurant',
    name: '광장시장 맛집거리',
    address: '서울특별시 종로구 창경궁로 88',
    areaCode: '1',
    mapX: 126.9996,
    mapY: 37.5701,
    image: null,
    tel: '02-2267-0291',
    overview: '빈대떡, 마약김밥 등 전통시장 먹거리 (샘플 데이터)',
  },
  {
    id: 'mock-food-2',
    type: 'restaurant',
    name: '명동교자',
    address: '서울특별시 중구 명동10길 29',
    areaCode: '1',
    mapX: 126.986,
    mapY: 37.5636,
    image: null,
    tel: '02-776-5348',
    overview: '칼국수/만두 전문점 (샘플 데이터)',
  },
];

export const mockFestivals = [
  {
    id: 'mock-fest-1',
    name: '서울빛초롱축제',
    place: '청계천 일대',
    startDate: '2026-11-01',
    endDate: '2026-11-23',
    organizer: '서울특별시',
    tel: '02-2290-6114',
    homepage: null,
    address: '서울특별시 종로구 청계천로',
    mapX: 126.991,
    mapY: 37.5695,
    overview: '청계천을 따라 펼쳐지는 대형 등불 축제 (샘플 데이터)',
  },
  {
    id: 'mock-fest-2',
    name: '진해 군항제',
    place: '경화역 일원',
    startDate: '2027-03-25',
    endDate: '2027-04-03',
    organizer: '창원시',
    tel: '055-225-3096',
    homepage: null,
    address: '경상남도 창원시 진해구',
    mapX: 128.6811,
    mapY: 35.1462,
    overview: '벚꽃과 함께하는 전국 최대 규모 봄 축제 (샘플 데이터)',
  },
];

export const mockTrails = [
  {
    id: 'mock-trail-1',
    name: '북한산 둘레길 1구간 (소나무숲길)',
    region: '서울 강북구',
    distanceKm: 2.3,
    durationMin: 60,
    difficulty: '쉬움',
    startPoint: '우이령 입구',
    endPoint: '소나무숲길 전망대',
    gpxUrl: null,
    overview: '완만한 소나무 숲길 코스 (샘플 데이터)',
  },
  {
    id: 'mock-trail-2',
    name: '해파랑길 1코스',
    region: '부산 오륙도',
    distanceKm: 16.7,
    durationMin: 300,
    difficulty: '보통',
    startPoint: '오륙도 해맞이공원',
    endPoint: '미포',
    gpxUrl: null,
    overview: '부산에서 강원 고성까지 이어지는 해파랑길의 시작 구간 (샘플 데이터)',
  },
];
