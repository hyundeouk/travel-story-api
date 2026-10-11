import type { Context, Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { accessOf, readShare } from '../../src/lib/auth.mts';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 추천 맛집: 운영자(주인)·게스트(손님)가 카카오 장소 검색으로 골라 등록하는 맛집 (먹방 유튜버가 소개한 곳 포함).
//   GET    /api/picks            목록 (손님: 공개된 곳 + 내가 올린 곳 · 주인: 전부)
//   GET    /api/picks?count=1    주인만: 확인 대기 수
//   POST   /api/picks            등록 (주인 → 바로 공개, 손님 → 확인 대기)
//   PUT    /api/picks/:id        고치기 (주인 또는 올린 손님) · 주인은 { status } 로 공개/숨김/확인 대기
//   DELETE /api/picks/:id        지우기 (주인 또는 올린 손님)
//   GET    /api/picks?hold=1     주인만: 유튜버 맛집 기본 목록 중 '나중에 확인' · '뺀 곳' 표시
//   POST   /api/picks {action:'hold', seeds:[{seed, st:'hold'|'drop'|''}]}  주인만: 위 표시 바꾸기
// 유튜버 정보는 "어느 영상에 나왔다"는 사실과 원래 영상 주소만 둔다(영상·썸네일·글을 복사하지 않는다).
const store = () => getStore({ name: 'picks', consistency: 'strong' });
const gphotos = () => getStore({ name: 'gphotos', consistency: 'strong' });
const PHOTO_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const MAX_PHOTOS = 5;
const STATUSES = ['ok', 'pending', 'hidden'];
const YT_RE = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=[\w-]{6,20}([&#][\w=&%-]*)?|shorts\/[\w-]{6,20}|live\/[\w-]{6,20}|@[\w.-]{2,40})|youtu\.be\/[\w-]{6,20}(\?[\w=&%-]*)?)$/; // 영상 또는 채널
const SRC_RE = /^https:\/\/[\w.-]+\.[a-z]{2,}(\/[^\s<>"']*)?$/i; // 방문·소개 출처(기사 등)

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v: unknown) => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN; return Number.isFinite(n) ? n : null; };
async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const SIDO: Record<string, string> = { 서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남', 전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주' };
const sidoOf = (addr: string) => { const t = (addr || '').trim().split(/\s+/)[0] || ''; return SIDO[t] || t.slice(0, 2); };

function clean(input: any) {
  const lat = num(input?.lat), lng = num(input?.lng);
  const okLL = lat != null && lng != null && lat > 32 && lat < 39.5 && lng > 124 && lng < 132;
  const video = str(input?.video, 200);
  const kurl = str(input?.kurl, 120);
  const address = str(input?.address, 120), road = str(input?.road, 120);
  const photoIds: string[] = [];
  for (const id of Array.isArray(input?.photoIds) ? input.photoIds : []) {
    if (typeof id === 'string' && PHOTO_RE.test(id) && !photoIds.includes(id)) photoIds.push(id);
    if (photoIds.length >= MAX_PHOTOS) break;
  }
  return {
    name: str(input?.name, 60),
    kakaoId: /^\d{1,15}$/.test(String(input?.kakaoId || '')) ? String(input.kakaoId) : '',
    kurl: /^https?:\/\/place\.map\.kakao\.com\/\d{1,15}$/.test(kurl) ? kurl.replace(/^http:/, 'https:') : '',
    address, road,
    sido: sidoOf(road || address),
    phone: str(input?.phone, 20).replace(/[^0-9-]/g, ''),
    cat: str(input?.cat, 40),
    lat: okLL ? Math.round((lat as number) * 1e6) / 1e6 : null,
    lng: okLL ? Math.round((lng as number) * 1e6) / 1e6 : null,
    menu: str(input?.menu, 100),
    review: str(input?.review, 300),
    video: YT_RE.test(video) ? video : '',
    youtuber: str(input?.youtuber, 30),
    show: str(input?.show, 30), // 채널·코너 이름 (예: 먹을텐데)
    src: SRC_RE.test(str(input?.src, 300)) ? str(input?.src, 300) : '',
    seed: /^[a-z0-9-]{1,20}$/.test(String(input?.seed || '')) ? String(input.seed) : '',
    photoIds,
  };
}

// 다른 사람이 올린 사진 번호를 끼워 넣지 못하게: 그 사진을 올린 사람이 같아야 쓴다. 주인은 예외.
async function ownPhotos(ids: string[], authors: string[], isOwner: boolean, keep: string[] = []) {
  const ok: string[] = [];
  for (const p of ids) {
    if (keep.includes(p)) { ok.push(p); continue; }
    const m: any = await gphotos().getMetadata(p).catch(() => null);
    if (!m) continue;
    if (isOwner || authors.some((x) => x && m.metadata?.author === x)) ok.push(p);
  }
  return ok;
}

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const a = await accessOf(req);
  if (!a.canView) return jsonResponse({ error: a.needGuest ? 'guest-login' : 'link required' }, { status: 401 });
  const isOwner = a.canEdit;
  // 운영자가 공개 범위에서 맛집 탭을 닫았으면 게스트에게는 보이지 않는다
  if (!isOwner) {
    const share = await readShare(req.method !== 'GET');
    if (share && share.tabs && share.tabs.food === false) {
      if (req.method === 'GET') return jsonResponse({ items: [], count: 0, hidden: true });
      return jsonResponse({ error: 'closed' }, { status: 403 });
    }
  }
  const token = (req.headers.get('x-author') || '').trim();
  const author = /^[A-Za-z0-9_-]{24,100}$/.test(token) ? await sha256('gs|' + token) : '';
  const acct = a.guest ? await sha256('gs|acct|' + a.guest.id) : '';
  const isMine = (p: any) => (!!acct && p.author === acct) || (!!author && p.author === author);
  const id = context.params?.id;
  const s = store();
  const strip = (p: any) => { const { author: _a, ...rest } = p; return { ...rest, mine: isMine(p) }; };

  try {
    if (req.method === 'GET' && new URL(req.url).searchParams.get('hold')) {
      if (!isOwner) return jsonResponse({ error: 'edit not allowed' }, { status: 403 });
      return jsonResponse({ ok: true, hold: ((await s.get('seedhold', { type: 'json' }).catch(() => null)) as any) || {} });
    }

    if (req.method === 'GET') {
      const { blobs } = await s.list({ prefix: 'p-' });
      const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean) as any[];
      if (new URL(req.url).searchParams.get('count')) {
        if (!isOwner) return jsonResponse({ error: 'edit not allowed' }, { status: 403 });
        return jsonResponse({ ok: true, pending: all.filter((p) => p.status === 'pending').length });
      }
      const items = all.filter((p) => isOwner || p.status === 'ok' || isMine(p)).map(strip)
        .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
      return jsonResponse({ items, count: items.length });
    }

    if (req.method === 'POST' && !id) {
      const input: any = await req.json();
      // 운영자: 기본 목록에서 지도에서 못 찾았거나 고르지 않은 곳을 '나중에 확인'으로 남기기
      if (input?.action === 'hold') {
        if (!isOwner) return jsonResponse({ error: 'edit not allowed' }, { status: 403 });
        const hold: Record<string, any> = ((await s.get('seedhold', { type: 'json' }).catch(() => null)) as any) || {};
        const now = new Date().toISOString();
        for (const x of Array.isArray(input.seeds) ? input.seeds.slice(0, 400) : []) {
          const seed = String(x?.seed || '');
          if (!/^[a-z0-9-]{1,20}$/.test(seed)) continue;
          if (x.st === 'hold' || x.st === 'drop') hold[seed] = { st: x.st, why: str(x.why, 20), at: now };
          else delete hold[seed];
        }
        await s.setJSON('seedhold', hold);
        return jsonResponse({ ok: true, hold });
      }
      if (!isOwner && !acct && !author) return jsonResponse({ error: 'author key required' }, { status: 400 });
      const body = clean(input);
      if (!body.name || body.lat == null || !body.kakaoId) return jsonResponse({ error: 'pick a place' }, { status: 400 });
      // 같은 가게(카카오 장소 번호)가 이미 있으면 새로 만들지 않는다
      const { blobs } = await s.list({ prefix: 'p-' });
      for (const b of blobs) {
        const p: any = await s.get(b.key, { type: 'json' }).catch(() => null);
        if (p && p.kakaoId === body.kakaoId) return jsonResponse({ error: 'exists', item: (isOwner || p.status === 'ok' || isMine(p)) ? strip(p) : null }, { status: 409 });
      }
      body.photoIds = await ownPhotos(body.photoIds, [acct, author], isOwner);
      const now = new Date().toISOString();
      const item = {
        id: crypto.randomUUID(), ...body,
        by: isOwner ? '운영자' : a.guest ? a.guest.nickname : '게스트', byOwner: isOwner, guestId: a.guest ? a.guest.id : null,
        author: isOwner ? 'owner' : acct || author,
        status: isOwner ? 'ok' : 'pending', createdAt: now, updatedAt: now,
      };
      await s.setJSON('p-' + item.id, item);
      return jsonResponse({ item: strip(item) }, { status: 201 });
    }

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return jsonResponse({ error: 'not found' }, { status: 404 });
    const cur: any = await s.get('p-' + id, { type: 'json' });
    if (!cur) return jsonResponse({ error: 'not found' }, { status: 404 });
    const mine = isMine(cur);
    if (!isOwner && !mine) return jsonResponse({ error: 'not yours' }, { status: 403 });

    if (req.method === 'PUT') {
      const input: any = await req.json();
      let next: any;
      if (isOwner && typeof input?.status === 'string' && Object.keys(input).length === 1) {
        if (!STATUSES.includes(input.status)) return jsonResponse({ error: 'bad status' }, { status: 400 });
        next = { ...cur, status: input.status, updatedAt: new Date().toISOString() };
      } else {
        const body = clean({ ...cur, ...input });
        if (!body.name || body.lat == null) return jsonResponse({ error: 'pick a place' }, { status: 400 });
        body.photoIds = await ownPhotos(body.photoIds, [acct, author], isOwner, cur.photoIds || []);
        // 손님이 고치면 다시 주인 확인을 받는다
        next = { ...cur, ...body, status: isOwner ? cur.status : 'pending', updatedAt: new Date().toISOString() };
        const removed = (cur.photoIds || []).filter((p: string) => !body.photoIds.includes(p));
        await Promise.all(removed.map((p: string) => gphotos().delete(p).catch(() => {})));
      }
      await s.setJSON('p-' + id, next);
      return jsonResponse({ item: strip(next) });
    }

    if (req.method === 'DELETE') {
      await s.delete('p-' + id);
      await Promise.all((cur.photoIds || []).map((p: string) => gphotos().delete(p).catch(() => {})));
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: ['/api/picks', '/api/picks/:id'],
};
