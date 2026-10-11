import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 골프장 코스 모양(오픈스트리트맵, ODbL) — 골프장 경계선 + (등록된 곳만) 홀 선·번호·파.
//   /api/golfosm?lat=37.5486&lng=126.7932&name=인서울27골프클럽
// 오픈스트리트맵 Overpass API에서 받아 30일 저장한다(찾은 것이 없으면 7일).
// 전국에 홀 번호까지 그려진 골프장은 일부뿐이라, 없으면 경계선만 또는 아무것도 없이 돌려준다.
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const UA = 'TravelStory/1.0 (https://travel-story-api.netlify.app; personal travel diary)';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TTL_NONE_MS = 7 * 24 * 60 * 60 * 1000;

type P = [number, number];
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
const norm = (s: unknown) => String(s ?? '').replace(/\s+|\(.*?\)|골프클럽|골프장|컨트리클럽|cc|gc|golf|club|country/gi, '').toLowerCase();

function km(a: P, b: P) {
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin(((b[0] - a[0]) * t) / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(((b[1] - a[1]) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function inRing(p: P, ring: P[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > p[0]) !== (yj > p[0]) && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function bboxOf(rings: P[][]) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const r of rings) for (const [la, lo] of r) { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); e = Math.max(e, lo); }
  return [s, w, n, e];
}
function thin(pts: P[], max = 300): P[] {
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  const out = pts.filter((_, i) => i % step === 0);
  out.push(pts[pts.length - 1]);
  return out;
}
const geomOf = (g: any[]): P[] => (g || []).filter((x) => x && x.lat != null).map((x) => [r5(x.lat), r5(x.lon)] as P);

async function overpass(q: string) {
  let last = '';
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(12000),
      });
      const text = await res.text();
      if (!res.ok) { last = `http ${res.status}`; continue; }
      return JSON.parse(text);
    } catch (err: any) {
      last = err?.message || String(err);
    }
  }
  throw new Error('overpass: ' + last);
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  const q = new URL(req.url).searchParams;
  const lat = Number(q.get('lat')), lng = Number(q.get('lng'));
  if (!(lat > 32 && lat < 39.5 && lng > 124 && lng < 132)) return jsonResponse({ error: 'bad lat/lng' }, { status: 400 });
  const name = (q.get('name') || '').slice(0, 40);
  const debug = q.get('debug') === '1';

  const store = getStore('cache');
  const cKey = `gosm-v1-${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (!debug) {
    const hit: any = await store.get(cKey, { type: 'json' });
    if (hit && Date.now() - (hit.at || 0) < (hit.none ? TTL_NONE_MS : TTL_MS)) return jsonResponse({ ...hit, cached: true });
  }

  try {
    const query = `[out:json][timeout:20];(way["leisure"="golf_course"](around:2500,${lat},${lng});relation["leisure"="golf_course"](around:2500,${lat},${lng});way["golf"="hole"](around:3500,${lat},${lng}););out geom;`;
    const data = await overpass(query);
    const els: any[] = Array.isArray(data?.elements) ? data.elements : [];
    const me: P = [lat, lng];

    // 1) 골프장 경계: 이 점을 품은 곳 → 이름이 같은 곳 → 가장 가까운 곳(1.5km 안)
    const courses = els.filter((e) => e.tags?.leisure === 'golf_course').map((e) => {
      const rings = e.type === 'way'
        ? [geomOf(e.geometry)]
        : (e.members || []).filter((m: any) => m.type === 'way' && (m.role === 'outer' || m.role === '')).map((m: any) => geomOf(m.geometry));
      const good = rings.filter((r: P[]) => r.length >= 3);
      const bb = bboxOf(good);
      const center: P = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
      const contains = good.some((r: P[]) => r.length >= 4 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] && inRing(me, r))
        || (me[0] >= bb[0] && me[0] <= bb[2] && me[1] >= bb[1] && me[1] <= bb[3] && good.length > 0);
      return { name: String(e.tags?.name || ''), rings: good, bb, center, contains, sameName: !!name && !!e.tags?.name && (norm(e.tags.name).includes(norm(name)) || norm(name).includes(norm(e.tags.name))) };
    }).filter((c) => c.rings.length);
    const pick = courses.find((c) => c.contains && c.sameName) || courses.find((c) => c.sameName && km(me, c.center) < 3)
      || courses.find((c) => c.contains) || courses.filter((c) => km(me, c.center) < 1.5).sort((a, b) => km(me, a.center) - km(me, b.center))[0] || null;

    // 2) 홀: 고른 골프장 경계(조금 넓게) 안에 있는 것만. 경계가 없으면 1.5km 안.
    const inside = (p: P) => pick
      ? p[0] >= pick.bb[0] - 0.002 && p[0] <= pick.bb[2] + 0.002 && p[1] >= pick.bb[1] - 0.002 && p[1] <= pick.bb[3] + 0.002
      : km(me, p) < 1.5;
    const holes = els.filter((e) => e.tags?.golf === 'hole').map((e) => {
      const pts = geomOf(e.geometry);
      return {
        ref: String(e.tags.ref || '').slice(0, 8),
        par: Number(e.tags.par) || null,
        name: String(e.tags.name || '').slice(0, 40),
        hcp: Number(e.tags.handicap) || null,
        pts: thin(pts, 60),
      };
    }).filter((h) => h.pts.length >= 2 && inside(h.pts[Math.floor(h.pts.length / 2)]));
    // "예술 1"·"OUT 코스 3"처럼 이름 끝 숫자를 뺀 코스 이름 → 번호 순
    const group = (h: any) => String(h.name || '').replace(/\s*\d+\s*$/, '');
    holes.sort((a, b) => group(a).localeCompare(group(b)) || (Number(a.ref) || 99) - (Number(b.ref) || 99));

    const out: any = {
      at: Date.now(),
      course: pick ? { name: pick.name, rings: pick.rings.map((r: P[]) => thin(r)), bbox: pick.bb.map(r5) } : null,
      holes,
    };
    if (!out.course && !holes.length) out.none = true;
    if (!debug) await store.setJSON(cKey, out);
    return jsonResponse(out);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/golfosm',
};
