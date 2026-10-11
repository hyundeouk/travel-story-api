import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 사용자가 장소마다 직접 등록한 사진. { "<종류>:<id>": { photoId } 또는 { url } } 형태의 표 하나로 저장한다.
//  - photoId: /api/photos 로 올린 파일
//  - url: 웹에 있는 이미지 주소(복사하지 않고 주소만 기억)
const KEY = 'all';
const store = () => getStore({ name: 'customimages', consistency: 'strong' });
const photos = () => getStore({ name: 'photos', consistency: 'strong' });
const KEY_RE = /^[a-z]:[A-Za-z0-9_\-.:]{1,100}$/;
const PHOTO_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

async function readAll(): Promise<Record<string, any>> {
  const data = await store().get(KEY, { type: 'json' });
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  try {
    if (req.method === 'GET') {
      const items = await readAll();
      return jsonResponse({ items, count: Object.keys(items).length });
    }

    if (req.method === 'PUT') {
      const body: any = await req.json();
      const key = typeof body?.key === 'string' ? body.key : '';
      if (!KEY_RE.test(key)) return jsonResponse({ error: 'bad key' }, { status: 400 });
      const photoId = typeof body?.photoId === 'string' && PHOTO_RE.test(body.photoId) ? body.photoId : null;
      const url = typeof body?.url === 'string' && /^https:\/\/[^\s"'<>]{4,1000}$/.test(body.url.trim()) ? body.url.trim() : null;
      if (body?.url && !photoId && !url) return jsonResponse({ error: 'bad url' }, { status: 400 });

      const items = await readAll();
      const old = items[key];
      if (photoId) items[key] = { photoId };
      else if (url) items[key] = { url };
      else delete items[key];
      await store().setJSON(KEY, items);
      if (old?.photoId && old.photoId !== photoId) await photos().delete(old.photoId);
      return jsonResponse({ ok: true, item: items[key] || null });
    }

    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/customimages',
};
