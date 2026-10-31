import type { Context, Config } from '@netlify/functions';
import { guard, viewerShare, accessOf } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 스토리 사진 저장소. 파일 종류는 키의 확장자로 기억한다 (예: <uuid>.jpg).
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const TYPE: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const ID_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
const MAX_BYTES = 5 * 1024 * 1024;
const photos = () => getStore({ name: 'photos', consistency: 'strong' });
// 카드 목록용 작은 복사본(긴 변 800px). 원본 키 "<uuid>.jpg" 옆에 "<uuid>.t.jpg"로 따로 둔다. 상세·크게 보기는 원본을 그대로 쓴다.
const MAX_THUMB = 600 * 1024;
const tkey = (id: string) => id.replace(/\.[a-z]+$/, '') + '.t.jpg';

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const id = context.params?.id;

  const url = new URL(req.url);
  const wantThumb = url.searchParams.get('t') === '1';
  try {
    // 작은 복사본 올리기 (운영자만: 쓰기는 guard 가 막는다). 원본이 있어야 한다.
    if (req.method === 'POST' && id && wantThumb) {
      if (!ID_RE.test(id)) return jsonResponse({ error: 'not found' }, { status: 404 });
      if (!(await photos().getMetadata(id))) return jsonResponse({ error: 'not found' }, { status: 404 });
      const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (type !== 'image/jpeg') return jsonResponse({ error: 'unsupported image type' }, { status: 415 });
      const body = await req.arrayBuffer();
      if (!body.byteLength || body.byteLength > MAX_THUMB) return jsonResponse({ error: 'bad thumbnail size' }, { status: 413 });
      await photos().set(tkey(id), body);
      return jsonResponse({ ok: true }, { status: 201 });
    }
    // 작은 복사본이 아직 없는 사진 찾기: /api/photos?need=<id>,<id>,...
    if (req.method === 'GET' && !id && url.searchParams.get('need') != null) {
      if (!(await accessOf(req)).canEdit) return jsonResponse({ error: 'forbidden' }, { status: 403 });
      const ids = url.searchParams.get('need')!.split(',').filter((x) => ID_RE.test(x)).slice(0, 60);
      const need: string[] = [];
      for (const x of ids) { if (!(await photos().getMetadata(tkey(x)))) need.push(x); }
      return jsonResponse({ need }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (req.method === 'POST' && !id) {
      const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const ext = EXT[type];
      if (!ext) return jsonResponse({ error: 'unsupported image type' }, { status: 415 });
      const body = await req.arrayBuffer();
      if (!body.byteLength) return jsonResponse({ error: 'empty body' }, { status: 400 });
      if (body.byteLength > MAX_BYTES) return jsonResponse({ error: 'image too large' }, { status: 413 });
      const newId = `${crypto.randomUUID()}.${ext}`;
      await photos().set(newId, body);
      return jsonResponse({ id: newId }, { status: 201 });
    }

    if (req.method === 'GET' && id) {
      if (!ID_RE.test(id)) return jsonResponse({ error: 'not found' }, { status: 404 });
      // 손님: 공개하지 않은 스토리의 사진은 보내지 않는다
      const share = await viewerShare(req);
      if (share && (share.hiddenStories.length || !share.tabs.feed)) {
        const all: any = await getStore({ name: 'stories', consistency: 'strong' }).get('all', { type: 'json' });
        const owner = (Array.isArray(all) ? all : []).find((s: any) => (Array.isArray(s.photoIds) ? s.photoIds : [s.photoId]).includes(id));
        if (owner && (!share.tabs.feed || share.hiddenStories.includes(String(owner.id)))) {
          return jsonResponse({ error: 'not found' }, { status: 404 });
        }
      }
      if (wantThumb) {
        const th = await photos().get(tkey(id), { type: 'arrayBuffer' });
        if (th) return new Response(th, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable', 'x-thumb': 'yes' } });
        // 작은 복사본이 아직 없으면 원본을 보낸다. 나중에 복사본이 생기면 바뀌어야 하므로 오래 저장해 두지 않는다.
        const orig = await photos().get(id, { type: 'arrayBuffer' });
        if (!orig) return jsonResponse({ error: 'not found' }, { status: 404 });
        return new Response(orig, { headers: { 'content-type': TYPE[id.split('.').pop() as string], 'cache-control': 'private, max-age=600', 'x-thumb': 'no' } });
      }
      const data = await photos().get(id, { type: 'arrayBuffer' });
      if (!data) return jsonResponse({ error: 'not found' }, { status: 404 });
      return new Response(data, {
        headers: {
          'content-type': TYPE[id.split('.').pop() as string],
          'cache-control': 'private, max-age=31536000, immutable',
        },
      });
    }

    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: ['/api/photos', '/api/photos/:id'],
};
