import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 자동차 길찾기 (네이버 클라우드 Maps · Directions 5).
//   /api/route?start=126.97,37.55&goal=128.46,37.73
// Client ID 는 지도와 같은 값을 쓰고, Client Secret 은 Netlify 환경 변수 NAVER_MAP_SECRET 에 둔다 (코드에 적지 않는다).
// 콘솔의 Application 설정에서 Directions 5 가 선택되어 있어야 한다 (없으면 429/401).
const API = 'https://maps.apigw.ntruss.com/map-direction/v1/driving';
const DEFAULT_KEY_ID = '5v6q8ev03k';
const MAX_PTS = 900;

function parseLL(v: string | null) {
  const m = String(v || '').split(',').map(Number);
  if (m.length !== 2 || !m.every(Number.isFinite)) return null;
  const [lng, lat] = m;
  return lat > 32 && lat < 39 && lng > 124 && lng < 132.5 ? [lng, lat] : null;
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  const secret = Netlify.env.get('NAVER_MAP_SECRET') || '';
  const keyId = Netlify.env.get('NAVER_MAP_KEY_ID') || DEFAULT_KEY_ID;
  if (!secret) return jsonResponse({ configured: false });

  const q = new URL(req.url).searchParams;
  const start = parseLL(q.get('start'));
  const goal = parseLL(q.get('goal'));
  if (!start || !goal) return jsonResponse({ error: 'bad points' }, { status: 400 });
  const option = /^(trafast|tracomfort|traoptimal|traavoidtoll)$/.test(q.get('option') || '') ? q.get('option')! : 'trafast';

  try {
    const url = `${API}?start=${start.join(',')}&goal=${goal.join(',')}&option=${option}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'x-ncp-apigw-api-key-id': keyId, 'x-ncp-apigw-api-key': secret },
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { return jsonResponse({ error: 'naver', status: res.status, message: text.slice(0, 160) }, { status: 502 }); }
    if (!res.ok) {
      // 401: 키가 틀림 / 429: Directions 5 가 선택되지 않았거나 한도 초과
      return jsonResponse({ error: 'naver', status: res.status, message: data?.error?.message || data?.message || '' }, { status: 502 });
    }
    if (data.code !== 0) return jsonResponse({ error: 'noroute', code: data.code, message: data.message || '' });
    const r = data.route?.[option]?.[0];
    if (!r) return jsonResponse({ error: 'noroute', message: 'no route' });
    const s = r.summary || {};
    let path: number[][] = Array.isArray(r.path) ? r.path : [];
    if (path.length > MAX_PTS) {
      const step = (path.length - 1) / (MAX_PTS - 1);
      path = Array.from({ length: MAX_PTS }, (_, i) => path[Math.round(i * step)]);
    }
    return jsonResponse({
      configured: true,
      distance: Number(s.distance) || 0,      // m
      duration: Number(s.duration) || 0,      // ms
      toll: Number(s.tollFare) || 0,
      taxi: Number(s.taxiFare) || 0,
      fuel: Number(s.fuelPrice) || 0,
      path: path.map((p) => [Math.round(p[1] * 1e5) / 1e5, Math.round(p[0] * 1e5) / 1e5]), // [lat, lng]
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/route',
};
