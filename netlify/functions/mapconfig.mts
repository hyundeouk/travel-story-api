import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 화면이 쓸 지도 설정.
//   카카오 지도 JavaScript 키는 Netlify 환경 변수 KAKAO_JS_KEY 에 둔다.
//   (JavaScript 키는 원래 웹 페이지에 넣어 쓰는 키이고, 카카오 개발자 콘솔에 등록한 사이트 주소에서만 동작한다.)
//   키가 없으면 지금처럼 네이버 지도를 쓴다.
export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  // 환경 변수 이름은 대소문자를 구분한다. 소문자로 넣은 경우(kakao_js_key)도 받아 준다.
  const kakaoKey = (Netlify.env.get('KAKAO_JS_KEY') || Netlify.env.get('kakao_js_key') || '').trim();
  return jsonResponse({ provider: kakaoKey ? 'kakao' : 'naver', kakaoKey: kakaoKey || null }, { headers: { 'Cache-Control': 'no-store' } });
};

export const config: Config = {
  path: '/api/mapconfig',
};
