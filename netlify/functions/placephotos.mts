import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 장소(산 등)마다 사진을 여러 장 직접 더하고, 마음에 안 드는 공식 사진은 빼 두는 기록.
//   { "<종류>:<id>": { add: [{ photoId } | { url }], hide: ["<빼 둔 사진 주소>", ...] } }
//  - add : 내가 올린 파일(photoId, /api/photos) 또는 웹 이미지 주소(url) — 순서대로 맨 앞에 보인다
//  - hide: 산림청·관광공사 등에서 온 사진 중 보이지 않게 뺀 것의 주소 (원본은 그대로 두고 화면에서만 뺀다)
const KEY = 'all';
const MAX_ADD = 30, MAX_HIDE = 80;
const store = () => getStore({ name: 'placephotos', consistency: 'strong' });
const photos = () => getStore({ name: 'photos', consistency: 'strong' });
const KEY_RE = /^[a-z]:[A-Za-z0-9_\-.:]{1,100}$/;
const PHOTO_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
const URL_RE = /^https:\/\/[^\s"'<>]{4,1000}$/;

async function readAll(): Promise<Record<string, { add: any[]; hide: string[] }>> {
  const data = await store().get(KEY, { type: 'json' });
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as any) : {};
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
      const action = String(body?.action || '');
      const items = await readAll();
      const cur = items[key] || { add: [], hide: [] };
      cur.add = Array.isArray(cur.add) ? cur.add : [];
      cur.hide = Array.isArray(cur.hide) ? cur.hide : [];
      let dropFile = '';

      if (action === 'add') {
        const photoId = typeof body.photoId === 'string' && PHOTO_RE.test(body.photoId) ? body.photoId : null;
        const url = typeof body.url === 'string' && URL_RE.test(body.url.trim()) ? body.url.trim() : null;
        if (!photoId && !url) return jsonResponse({ error: 'bad photo' }, { status: 400 });
        if (cur.add.length >= MAX_ADD) return jsonResponse({ error: 'too many photos' }, { status: 409 });
        const entry: any = photoId ? { photoId } : { url };
        if (typeof body.desc === 'string' && body.desc.trim()) entry.desc = body.desc.trim().slice(0, 80);
        if (!cur.add.some((x: any) => (photoId && x.photoId === photoId) || (url && x.url === url))) cur.add.push(entry);
        if (url) cur.hide = cur.hide.filter((h) => h !== url);   // 빼 뒀던 주소를 다시 더하면 다시 보이게
      } else if (action === 'remove') {
        // 내가 더한 사진 빼기 (올린 파일이면 파일도 지운다)
        const photoId = typeof body.photoId === 'string' ? body.photoId : '';
        const url = typeof body.url === 'string' ? body.url : '';
        const before = cur.add.length;
        cur.add = cur.add.filter((x: any) => !((photoId && x.photoId === photoId) || (url && x.url === url)));
        if (photoId && cur.add.length !== before && PHOTO_RE.test(photoId)) dropFile = photoId;
      } else if (action === 'hide') {
        const url = typeof body.url === 'string' ? body.url.trim() : '';
        if (!/^(https:\/\/|\/img\/|\/api\/gphotos\/)[^\s"'<>]{2,1000}$/.test(url)) return jsonResponse({ error: 'bad url' }, { status: 400 });
        if (!cur.hide.includes(url)) cur.hide.push(url);
        if (cur.hide.length > MAX_HIDE) cur.hide = cur.hide.slice(-MAX_HIDE);
      } else if (action === 'unhide') {
        cur.hide = [];                                  // 빼 둔 사진을 모두 다시 보이게
      } else if (action === 'makefirst') {
        const photoId = typeof body.photoId === 'string' ? body.photoId : '';
        const url = typeof body.url === 'string' ? body.url : '';
        const i = cur.add.findIndex((x: any) => (photoId && x.photoId === photoId) || (url && x.url === url));
        if (i > 0) cur.add.unshift(cur.add.splice(i, 1)[0]);
      } else {
        return jsonResponse({ error: 'bad action' }, { status: 400 });
      }

      if (!cur.add.length && !cur.hide.length) delete items[key]; else items[key] = cur;
      await store().setJSON(KEY, items);
      if (dropFile) await photos().delete(dropFile);
      return jsonResponse({ ok: true, item: items[key] || null });
    }
    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/placephotos',
};
