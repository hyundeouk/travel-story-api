import type { Context, Config } from '@netlify/functions';
import { guard, viewerShare } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';
import { cleanGolf } from '../../src/lib/golfscore.mts';
import { cleanHike } from '../../src/lib/hikerec.mts';

// 여행 스토리 저장소. 혼자 쓰는 페이지라 전체 목록을 한 덩어리(JSON 배열)로 보관한다.
const KEY = 'all';
const stories = () => getStore({ name: 'stories', consistency: 'strong' });
const photos = () => getStore({ name: 'photos', consistency: 'strong' });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const PHOTO_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
const MAX_PHOTOS = 40;

// 사진은 여러 장(photoIds). 예전 형식(photoId 한 장)도 받아서 같은 모양으로 맞춘다.
function photoList(input: any): string[] {
  const raw = Array.isArray(input?.photoIds) ? input.photoIds : input?.photoId ? [input.photoId] : [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id === 'string' && PHOTO_RE.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_PHOTOS) break;
  }
  return out;
}

function clean(input: any) {
  const photoIds = photoList(input);
  return {
    title: str(input?.title, 200) || '제목 없음',
    date: /^\d{4}-\d{2}-\d{2}$/.test(input?.date) ? input.date : new Date().toISOString().slice(0, 10),
    category: str(input?.category, 20) || '기타',
    place: str(input?.place, 300),
    region: str(input?.region, 20),
    memo: str(input?.memo, 20000),
    photoIds,
    photoId: photoIds[0] || null, // 첫 장 (예전 화면과의 호환용)
    lat: num(input?.lat),
    lng: num(input?.lng),
    golf: cleanGolf(input?.golf),
    hike: cleanHike(input?.hike),
  };
}

async function readAll(): Promise<any[]> {
  const data = await stories().get(KEY, { type: 'json' });
  return Array.isArray(data) ? data : [];
}

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const id = context.params?.id;

  try {
    if (req.method === 'GET') {
      let items = (await readAll()).map((s) => ({ ...s, photoIds: photoList(s) }));
      // 공유 링크 손님에게는 공개 범위에 맞춰 줄여서 보낸다
      const share = await viewerShare(req);
      if (share) {
        const hidden = new Set(share.hiddenStories);
        items = !share.tabs.feed ? [] : items
          .filter((s) => !hidden.has(String(s.id)))
          .map((s) => ({ ...s, memo: share.storyMemo ? s.memo : '', ...(share.storyLocation ? {} : { lat: null, lng: null, place: '' }) }));
      }
      items.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
      return jsonResponse({ items, count: items.length });
    }

    if (req.method === 'POST' && !id) {
      const now = new Date().toISOString();
      const item = { id: crypto.randomUUID(), ...clean(await req.json()), createdAt: now, updatedAt: now };
      const items = await readAll();
      items.push(item);
      await stories().setJSON(KEY, items);
      return jsonResponse({ item }, { status: 201 });
    }

    if (req.method === 'PUT' && id) {
      const items = await readAll();
      const idx = items.findIndex((s) => s.id === id);
      if (idx < 0) return jsonResponse({ error: 'not found' }, { status: 404 });
      const oldPhotos = photoList(items[idx]);
      items[idx] = { ...items[idx], ...clean(await req.json()), updatedAt: new Date().toISOString() };
      await stories().setJSON(KEY, items);
      // 빠진 사진만 저장소에서 지운다
      for (const id of oldPhotos) if (!items[idx].photoIds.includes(id)) await photos().delete(id);
      return jsonResponse({ item: items[idx] });
    }

    if (req.method === 'DELETE' && id) {
      const items = await readAll();
      const target = items.find((s) => s.id === id);
      if (!target) return jsonResponse({ ok: true });
      await stories().setJSON(KEY, items.filter((s) => s.id !== id));
      for (const id of photoList(target)) await photos().delete(id);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: ['/api/stories', '/api/stories/:id'],
};
