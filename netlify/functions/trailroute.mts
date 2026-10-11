import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 두루누비가 제공하는 코스 GPX 파일을 받아 지도에 그릴 좌표 목록으로 줄여서 돌려준다.
// 한 번 받은 코스는 저장해 두고 다시 쓴다.
const MAX_POINTS = 300;
const cache = () => getStore('cache');

function parseGpx(xml: string): number[][] {
  const pick = (tag: string) => {
    const out: number[][] = [];
    const re = new RegExp(`<${tag}\\b([^>]*)>`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const lat = /\blat="([-\d.]+)"/.exec(m[1]);
      const lon = /\blon="([-\d.]+)"/.exec(m[1]);
      if (!lat || !lon) continue;
      const la = Number(lat[1]);
      const lo = Number(lon[1]);
      if (Number.isFinite(la) && Number.isFinite(lo) && la !== 0 && lo !== 0) out.push([la, lo]);
    }
    return out;
  };
  let pts = pick('trkpt');
  if (pts.length < 2) pts = pick('rtept');
  if (pts.length <= MAX_POINTS) return pts;
  const step = (pts.length - 1) / (MAX_POINTS - 1);
  const thin: number[][] = [];
  for (let i = 0; i < MAX_POINTS; i++) thin.push(pts[Math.round(i * step)]);
  return thin;
}

async function sha1(text: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  try {
    const raw = new URL(req.url).searchParams.get('url') || '';
    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return jsonResponse({ error: 'bad url' }, { status: 400 });
    }
    // 두루누비의 GPX 파일 주소만 허용
    if (target.protocol !== 'https:' || target.hostname !== 'www.durunubi.kr' || target.pathname !== '/editImgUp.do' || !/\.gpx$/i.test(target.searchParams.get('filePath') || '')) {
      return jsonResponse({ error: 'url not allowed' }, { status: 400 });
    }

    const key = `route-${await sha1(target.toString())}`;
    const hit = await cache().get(key, { type: 'json' });
    if (hit && Array.isArray(hit.points)) return jsonResponse({ points: hit.points, cached: true });

    const res = await fetch(target.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return jsonResponse({ error: `gpx http ${res.status}` }, { status: 502 });
    const points = parseGpx(await res.text()).map((p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
    if (points.length < 2) return jsonResponse({ error: 'no route in gpx' }, { status: 502 });
    await cache().setJSON(key, { points });
    return jsonResponse({ points, cached: false });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/trailroute',
};
