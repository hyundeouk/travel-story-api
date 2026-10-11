import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { callGovApi, jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 스토리에 지도 위치를 붙이기 위한 장소 이름 검색.
// 한국관광공사 관광정보(KorService2) 키워드 검색에서 이름·주소·좌표만 뽑아 돌려준다.
// 같은 검색어는 저장해 두고 다시 묻지 않는다 (하루 호출 한도 절약).
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const TOUR_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const cache = () => getStore('cache');

async function sha1(text: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const okCode = (c?: string) => c === '0000' || c === '00';

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  try {
    const q = (new URL(req.url).searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (q.length < 2) return jsonResponse({ error: 'bad query' }, { status: 400 });
    const cKey = `geo-${await sha1(q)}`;
    const saved: any = await cache().get(cKey, { type: 'json' });
    if (saved) return jsonResponse(saved);

    const key = Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
    const r = await callGovApi(TOUR_BASE, 'searchKeyword2', key, { keyword: q, numOfRows: 20, arrange: 'A' });
    const items = r.items
      .map((it: any) => ({
        name: String(it.title || '').trim(),
        address: [it.addr1, it.addr2].filter(Boolean).join(' ').trim(),
        lat: Number(it.mapy),
        lng: Number(it.mapx),
      }))
      .filter((it: any) => it.name && it.lat > 32 && it.lat < 39.6 && it.lng > 124 && it.lng < 132.5)
      .slice(0, 10);
    const out = { items };
    // 오류 응답(한도 초과 등)은 저장하지 않는다. 다음에 다시 물어볼 수 있게.
    if (okCode(r.resultCode) || items.length) await cache().setJSON(cKey, out);
    return jsonResponse(out);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/placesearch',
};
