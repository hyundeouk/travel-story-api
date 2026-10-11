/**
 * 한국관광공사 두루누비(Durunubi) courseList — 둘레길/트레킹 코스.
 * 공식 문서: https://www.data.go.kr/data/15101974/openapi.do
 *
 * 2026-09 여행앱 프로젝트에서 실제로 겪은 문제들 반영:
 * - sigun(지역 필터) 파라미터를 빈 문자열로라도 보내면 가끔
 *   INVALID_REQUEST_PARAMETER_ERROR(sigun)로 거부당함 → 값 있을 때만 전달.
 * - 실제 필드명은 crsIdx/crsKorNm/crsDstnc/crsLevel/crsSummary/travelerinfo/
 *   sigun/gpxpath 등이며, 소요시간 필드(crsTotlRqrmHour)는 이름과 달리 "분" 단위.
 * - 출발지/도착지 전용 필드는 없고 travelerinfo 텍스트 안에 "- 시점 : ..." /
 *   "- 종점 : ..."로만 들어있어 정규식으로 추출해야 함.
 */
import { callGovApi } from './govApi.mts';
import { mockTrails } from '../data/mockData.mts';

const DURUNUBI_API_BASE = 'https://apis.data.go.kr/B551011/Durunubi';

function extractPoint(travelerinfo: string | undefined, label: string): string | null {
  if (!travelerinfo) return null;
  const lines = travelerinfo.split(/<br\s*\/?>/i);
  const re = new RegExp(`^[-\\s]*${label}\\s*:\\s*(.+)$`);
  for (const line of lines) {
    const match = line.trim().match(re);
    if (match) return match[1].trim();
  }
  return null;
}

function cleanText(text: string | undefined | null): string | null {
  if (!text) return null;
  return text.replace(/<br\s*\/?>/gi, '\n').trim();
}

function normalize(rawItem: any) {
  return {
    id: String(rawItem.crsIdx ?? rawItem.id),
    name: rawItem.crsKorNm || rawItem.name,
    // 어느 길(해파랑길·남파랑길 등)의 코스인지: 코스 이름에서 번호 앞부분
    route: String(rawItem.crsKorNm || rawItem.name || '').replace(/\s*\d+\s*(-\s*\d+)?\s*코스.*$/, '').trim(),
    routeIdx: rawItem.routeIdx || null,
    region: rawItem.sigun || rawItem.region || '',
    distanceKm: Number(rawItem.crsDstnc) || null,
    durationMin: rawItem.crsTotlRqrmHour ? Number(rawItem.crsTotlRqrmHour) : null,
    difficulty: rawItem.crsLevel || null,
    startPoint: extractPoint(rawItem.travelerinfo, '시점'),
    endPoint: extractPoint(rawItem.travelerinfo, '종점'),
    gpxUrl: rawItem.gpxpath || null,
    overview: cleanText(rawItem.crsSummary),
  };
}

export async function fetchTrails(opts: { region?: string; serviceKey?: string }) {
  if (!opts.serviceKey) {
    return { mock: true, items: mockTrails };
  }

  // 전체 코스가 150개 남짓이라 한 번에 다 받는다 (기본 50개만 오던 것을 고침)
  const params: Record<string, string | undefined> = { numOfRows: '1000' };
  if (opts.region) params.sigun = opts.region;

  const result = await callGovApi(DURUNUBI_API_BASE, 'courseList', opts.serviceKey, params);
  return {
    mock: false,
    resultCode: result.resultCode,
    resultMsg: result.resultMsg,
    items: result.items.map(normalize),
  };
}
