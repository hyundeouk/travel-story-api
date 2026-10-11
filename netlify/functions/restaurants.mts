import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { fetchPlaces } from '../../src/lib/places.mts';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// Netlify 대시보드 환경변수가 반영 안 될 때를 대비한 fallback (data.go.kr 디코딩 키)
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const areaCode = url.searchParams.get('areaCode') || undefined;
    const mapX = url.searchParams.get('mapX');
    const mapY = url.searchParams.get('mapY');
    const radius = url.searchParams.get('radius');

    const result = await fetchPlaces({
      type: 'restaurant',
      areaCode,
      mapX: mapX ? Number(mapX) : undefined,
      mapY: mapY ? Number(mapY) : undefined,
      radius: radius ? Number(radius) : undefined,
      serviceKey: Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY,
    });

    return jsonResponse({ ...result, count: result.items.length });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/restaurants',
};
