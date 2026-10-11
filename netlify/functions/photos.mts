import type { Context, Config } from '@netlify/functions';
import { guard, viewerShare } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 스토리 사진 저장소. 파일 종류는 키의 확장자로 기억한다 (예: <uuid>.jpg).
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const TYPE: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const ID_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
const MAX_BYTES = 5 * 1024 * 1024;
const photos = () => getStore({ name: 'photos', consistency: 'strong' });

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const id = context.params?.id;

  try {
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
