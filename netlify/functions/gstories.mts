import type { Context, Config } from '@netlify/functions';
import { accessOf, readShare } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';
import { cleanGolf } from '../../src/lib/golfscore.mts';
import { cleanHike } from '../../src/lib/hikerec.mts';

// "스토리" 탭: 주인과 공유 링크 손님이 함께 쓰는 여행 이야기.
//   GET    /api/gstories          목록 (손님: 내가 쓴 글 + 주인이 쓴 공개 글 · 다른 손님 글은 안 보임)
//   POST   /api/gstories          새 글
//   PUT    /api/gstories/:id      고치기 (쓴 사람 또는 주인) · 주인은 { status } 로 공개/숨김/확인 대기 변경
//   DELETE /api/gstories/:id      지우기 (쓴 사람 또는 주인)
// 손님이 여러 명이어도 공유 링크는 하나라서, 브라우저마다 만든 "작성자 열쇠"(X-Author 머리글)로
// 누가 쓴 글인지 구분한다. 서버에는 열쇠의 해시만 저장한다.
// 글마다 따로 저장(s-<id>)해서 여러 사람이 동시에 써도 서로 덮어쓰지 않는다.
const store = () => getStore({ name: 'gstories', consistency: 'strong' });
const gphotos = () => getStore({ name: 'gphotos', consistency: 'strong' });
const PHOTO_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const MAX_PHOTOS = 5;
const STATUSES = ['ok', 'pending', 'hidden'];

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+$/g, '').trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function clean(input: any) {
  const photoIds: string[] = [];
  for (const id of Array.isArray(input?.photoIds) ? input.photoIds : []) {
    if (typeof id === 'string' && PHOTO_RE.test(id) && !photoIds.includes(id)) photoIds.push(id);
    if (photoIds.length >= MAX_PHOTOS) break;
  }
  const lat = num(input?.lat), lng = num(input?.lng);
  const okLL = lat != null && lng != null && lat > 32 && lat < 39.5 && lng > 124 && lng < 132;
  return {
    nickname: str(input?.nickname, 20),
    title: str(input?.title, 100) || '제목 없음',
    date: /^\d{4}-\d{2}-\d{2}$/.test(input?.date) ? input.date : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
    place: str(input?.place, 100),
    region: str(input?.region, 10),
    memo: str(input?.memo, 5000),
    photoIds,
    lat: okLL ? lat : null,
    lng: okLL ? lng : null,
    golf: cleanGolf(input?.golf),
    hike: cleanHike(input?.hike),
  };
}

// 다른 사람이 올린 사진 번호를 끼워 넣지 못하게: 그 사진을 올린 사람(열쇠 해시)이 같아야 쓴다. 주인은 예외.
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
  const isOwner = a.canEdit; // 암호 설정 전에도 주인
  const share = isOwner ? null : await readShare(req.method !== 'GET'); // 쓰기는 방금 바뀐 설정을 바로 따른다
  if (share && !share.tabs.gstory) {
    if (req.method === 'GET') return jsonResponse({ items: [], count: 0, hidden: true });
    return jsonResponse({ error: 'closed' }, { status: 403 });
  }
  const token = (req.headers.get('x-author') || '').trim();
  const author = /^[A-Za-z0-9_-]{24,100}$/.test(token) ? await sha256('gs|' + token) : '';
  // 손님 계정으로 로그인했으면 계정 기준(어느 기기에서든 내 글), 예전 글은 브라우저 열쇠로도 내 글로 본다
  const acct = a.guest ? await sha256('gs|acct|' + a.guest.id) : '';
  const isMine = (g: any) => (!!author && g.author === author) || (!!acct && g.author === acct);
  const id = context.params?.id;
  const s = store();

  try {
    if (req.method === 'GET') {
      const { blobs } = await s.list({ prefix: 's-' });
      const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean) as any[];
      const items = all
        // 손님이 쓴 글은 쓴 손님(과 주인)만 본다. 주인이 쓴 글은 공개된 것만 모두에게 보인다.
        .filter((g) => isOwner || isMine(g) || (g.owner && g.status === 'ok'))
        .map((g) => {
          const { author: _au, ...rest } = g;
          return { ...rest, mine: isMine(g) };
        })
        .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
      return jsonResponse({ items, count: items.length, approval: !!(share ? share.guestApproval : (await readShare(true)).guestApproval) });
    }

    if (req.method === 'POST' && !id) {
      if (!isOwner && !author && !acct) return jsonResponse({ error: 'author key required' }, { status: 400 });
      const body = clean(await req.json());
      if (a.guest) body.nickname = a.guest.nickname; // 손님은 계정 닉네임으로
      body.photoIds = await ownPhotos(body.photoIds, [author, acct], isOwner);
      if (!body.nickname) return jsonResponse({ error: 'nickname required' }, { status: 400 });
      if (!body.memo && !body.photoIds.length && !body.golf && !body.hike) return jsonResponse({ error: 'empty' }, { status: 400 });
      const now = new Date().toISOString();
      const approval = share ? share.guestApproval : false;
      const item = { id: crypto.randomUUID(), ...body, owner: isOwner, guestId: a.guest ? a.guest.id : null, author: acct || author || 'owner', status: isOwner || !approval ? 'ok' : 'pending', createdAt: now, updatedAt: now };
      await s.setJSON('s-' + item.id, item);
      const { author: _x, ...out } = item;
      return jsonResponse({ item: { ...out, mine: true } }, { status: 201 });
    }

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return jsonResponse({ error: 'not found' }, { status: 404 });
    const cur: any = await s.get('s-' + id, { type: 'json' });
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
        const body = clean(input);
        body.photoIds = await ownPhotos(body.photoIds, [author, acct], isOwner, cur.photoIds || []);
        if (!body.nickname || a.guest) body.nickname = a.guest ? a.guest.nickname : cur.nickname;
        // 확인 후 공개 모드에서 손님이 글을 고치면 다시 확인 대기
        const status = !isOwner && share?.guestApproval && cur.status === 'ok' ? 'pending' : cur.status;
        next = { ...cur, ...body, status, updatedAt: new Date().toISOString() };
        const removed = (cur.photoIds || []).filter((p: string) => !body.photoIds.includes(p));
        await Promise.all(removed.map((p: string) => gphotos().delete(p).catch(() => {})));
      }
      await s.setJSON('s-' + id, next);
      const { author: _x, ...out } = next;
      return jsonResponse({ item: { ...out, mine } });
    }

    if (req.method === 'DELETE') {
      await s.delete('s-' + id);
      await Promise.all((cur.photoIds || []).map((p: string) => gphotos().delete(p).catch(() => {})));
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: ['/api/gstories', '/api/gstories/:id'],
};
