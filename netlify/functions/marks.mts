import type { Context, Config } from '@netlify/functions';
import { guard, viewerShare } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 장소마다 남기는 내 기록: 다녀왔는지, 다녀온 날짜, 별점(0~5), 한 줄 평.
// { "<종류>:<id>": { visited, date, rating, note, updatedAt } } 표 하나로 저장한다.
const KEY = 'all';
const store = () => getStore({ name: 'marks', consistency: 'strong' });
const KEY_RE = /^[a-z]:[A-Za-z0-9_\-.:]{1,100}$/;

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
      const share = await viewerShare(req);
      if (share && !share.marks) return jsonResponse({ items: {}, count: 0, hidden: true });
      const items = await readAll();
      return jsonResponse({ items, count: Object.keys(items).length });
    }

    if (req.method === 'PUT') {
      const body: any = await req.json();
      const key = typeof body?.key === 'string' ? body.key : '';
      if (!KEY_RE.test(key)) return jsonResponse({ error: 'bad key' }, { status: 400 });
      const visited = body?.visited === true;
      const date = visited && typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
      const r = Math.round(Number(body?.rating));
      const rating = Number.isFinite(r) ? Math.min(5, Math.max(0, r)) : 0;
      const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : '';

      const items = await readAll();
      if (!visited && !rating && !note) delete items[key];
      else items[key] = { visited, date, rating, note, updatedAt: new Date().toISOString() };
      await store().setJSON(KEY, items);
      return jsonResponse({ ok: true, item: items[key] || null });
    }

    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/marks',
};
