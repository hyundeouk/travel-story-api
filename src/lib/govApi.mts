/**
 * 공공데이터포털(data.go.kr) 계열 API 공통 호출 헬퍼.
 *
 * 여행앱 프로젝트(원래의 Express 백엔드)에서 겪었던 문제들을 그대로 반영함:
 * 1) `_type=json`을 보내도 XML로 응답하는 경우가 있음 → JSON.parse 실패하면
 *    xml2js로 폴백 파싱.
 * 2) 에러 응답은 `{response:{header:{resultCode,...}}}` 모양이 아니라
 *    `{responseTime, resultCode, resultMsg}` 같은 완전히 다른 최상위 구조로 옴.
 * 3) 선택 파라미터를 빈 문자열("")로라도 보내면 일부 오퍼레이션(특히 두루누비
 *    courseList의 sigun)이 INVALID_REQUEST_PARAMETER_ERROR로 거부하는 경우가
 *    있었음 → 값이 없는 파라미터는 아예 키 자체를 넣지 않는다.
 */
import { parseStringPromise } from 'xml2js';

export type GovApiParams = Record<string, string | number | undefined | null>;

export interface GovApiResult {
  ok: boolean;
  resultCode?: string;
  resultMsg?: string;
  items: any[];
  raw?: any;
}

async function parseMaybeXml(text: string): Promise<any> {
  try {
    return JSON.parse(text);
  } catch {
    return parseStringPromise(text, { explicitArray: false, ignoreAttrs: true, trim: true });
  }
}

function extractItems(data: any): any[] {
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function extractResultCode(data: any): { resultCode?: string; resultMsg?: string } {
  // 정상/에러 두 가지 최상위 모양을 모두 대응
  return {
    resultCode: data?.response?.header?.resultCode ?? data?.resultCode,
    resultMsg: data?.response?.header?.resultMsg ?? data?.resultMsg,
  };
}

/**
 * @param baseUrl 예: https://apis.data.go.kr/B551011/KorService2
 * @param operation 예: areaBasedList2, courseList, searchFestival2
 * @param serviceKey 공공데이터포털 인증키 (Decoding/원본 값)
 * @param params 추가 파라미터 — 값이 undefined/null/''인 키는 자동으로 제외됨
 */
export async function callGovApi(
  baseUrl: string,
  operation: string,
  serviceKey: string,
  params: GovApiParams
): Promise<GovApiResult> {
  const url = new URL(`${baseUrl}/${operation}`);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', 'TravelStoryApp');
  url.searchParams.set('_type', 'json');
  url.searchParams.set('numOfRows', '50');
  url.searchParams.set('pageNo', '1');
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  const data = await parseMaybeXml(text);
  const { resultCode, resultMsg } = extractResultCode(data);
  const items = extractItems(data);

  return {
    ok: resultCode === '0000' || resultCode === '00' || (items.length > 0 && !resultCode),
    resultCode,
    resultMsg,
    items,
    raw: data,
  };
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // 이 API는 claude.ai 아티팩트(다른 오리진)에서 fetch로 직접 호출하는 용도이므로
      // CORS를 명시적으로 열어줘야 함(사용자가 이 아키텍처를 명시적으로 요청함).
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...(init?.headers || {}),
    },
  });
}

export function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
