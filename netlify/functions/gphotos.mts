import type { Context, Config } from '@netlify/functions';
import { accessOf, readShare } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// "스토리" 탭 사진 (주인·손님 모두 올릴 수 있음). 내 여행 기록 사진(/api/photos)과는 따로 둔다.
//   POST /api/gphotos (본문: 그림 파일, 머리글 X-Author)  → { id }
//   GET  /api/gphotos/:id
// 올린 사람의 열쇠 해시를 메타데이터로 남겨, 그 사람 글에만 붙일 수 있게 한다.
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const TYPE: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const ID_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const MAX_BYTES = 3 * 1024 * 1024;
const store = () => getStore({ name: 'gphotos', consistency: 'strong' });
// 카드 목록용 작은 복사본(긴 변 800px): "<uuid>.t.jpg". 상세·크게 보기는 원본을 그대로 쓴다.
const MAX_THUMB = 600 * 1024;
const tkey = (id: string) => id.replace(/\.[a-z]+$/, '') + '.t.jpg';
async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const a = await accessOf(req);
  if (!a.canView) return jsonResponse({ error: a.needGuest ? 'guest-login' : 'link required' }, { status: 401 });
  // 스토리를 닫아 두어도 로그인한 손님은 추천 맛집 사진을 올리고 볼 수 있어야 한다
  if (!a.canEdit && !a.guest) {
    const share = await readShare(req.method !== 'GET');
    if (!share.tabs.gstory) return jsonResponse({ error: 'not found' }, { status: 404 });
  }
  const id = context.params?.id;
  const url = new URL(req.url);
  const wantThumb = url.searchParams.get('t') === '1';
  try {
    // 작은 복사본 올리기: 운영자이거나, 그 사진을 올린 바로 그 사람만
    if (req.method === 'POST' && id && wantThumb) {
      if (!ID_RE.test(id)) return jsonResponse({ error: 'not found' }, { status: 404 });
      const meta: any = await store().getMetadata(id);
      if (!meta) return jsonResponse({ error: 'not found' }, { status: 404 });
      if (!a.canEdit) {
        const token = (req.headers.get('x-author') || '').trim();
        const author = a.guest ? await sha256('gs|acct|' + a.guest.id) : /^[A-Za-z0-9_-]{24,100}$/.test(token) ? await sha256('gs|' + token) : '';
        if (!author || meta.metadata?.author !== author) return jsonResponse({ error: 'not yours' }, { status: 403 });
      }
      const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (type !== 'image/jpeg') return jsonResponse({ error: 'unsupported image type' }, { status: 415 });
      const body = await req.arrayBuffer();
      if (!body.byteLength || body.byteLength > MAX_THUMB) return jsonResponse({ error: 'bad thumbnail size' }, { status: 413 });
      await store().set(tkey(id), body, { metadata: meta.metadata || {} });
      return jsonResponse({ ok: true }, { status: 201 });
    }
    // 운영자: 작은 복사본이 아직 없는 사진 찾기
    if (req.method === 'GET' && !id && url.searchParams.get('need') != null) {
      if (!a.canEdit) return jsonResponse({ error: 'forbidden' }, { status: 403 });
      const ids = url.searchParams.get('need')!.split(',').filter((x) => ID_RE.test(x)).slice(0, 60);
      const need: string[] = [];
      for (const x of ids) { if (!(await store().getMetadata(tkey(x)))) need.push(x); }
      return jsonResponse({ need }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (req.method === 'POST' && !id) {
      const token = (req.headers.get('x-author') || '').trim();
      if (!a.canEdit && !a.guest && !/^[A-Za-z0-9_-]{24,100}$/.test(token)) return jsonResponse({ error: 'author key required' }, { status: 400 });
      const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const ext = EXT[type];
      if (!ext) return jsonResponse({ error: 'unsupported image type' }, { status: 415 });
      const body = await req.arrayBuffer();
      if (!body.byteLength) return jsonResponse({ error: 'empty body' }, { status: 400 });
      if (body.byteLength > MAX_BYTES) return jsonResponse({ error: 'image too large' }, { status: 413 });
      const newId = `${crypto.randomUUID()}.${ext}`;
      const author = a.guest ? await sha256('gs|acct|' + a.guest.id) : token ? await sha256('gs|' + token) : 'owner';
      await store().set(newId, body, { metadata: { author, at: Date.now() } });
      return jsonResponse({ id: newId }, { status: 201 });
    }
    if (req.method === 'GET' && id) {
      if (!ID_RE.test(id)) return jsonResponse({ error: 'not found' }, { status: 404 });
      if (wantThumb) {
        const th = await store().get(tkey(id), { type: 'arrayBuffer' });
        if (th) return new Response(th, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable', 'x-thumb': 'yes' } });
        const orig = await store().get(id, { type: 'arrayBuffer' });
        if (!orig) return jsonResponse({ error: 'not found' }, { status: 404 });
        return new Response(orig, { headers: { 'content-type': TYPE[id.split('.').pop() as string], 'cache-control': 'private, max-age=600', 'x-thumb': 'no' } });
      }
      const data = await store().get(id, { type: 'arrayBuffer' });
      if (!data) return jsonResponse({ error: 'not found' }, { status: 404 });
      return new Response(data, { headers: { 'content-type': TYPE[id.split('.').pop() as string], 'cache-control': 'private, max-age=31536000, immutable' } });
    }
    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: ['/api/gphotos', '/api/gphotos/:id'],
};
