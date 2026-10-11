import type { Context, Config } from '@netlify/functions';
import { guard, viewerShare } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 네이버 지도 등에서 가져온 "내 장소" 목록. PUT으로 전체를 교체한다.
const KEY = 'all';
const store = () => getStore({ name: 'myplaces', consistency: 'strong' });
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  try {
    if (req.method === 'GET') {
      const share = await viewerShare(req);
      if (share && !share.tabs.mine) return jsonResponse({ items: [], count: 0, updatedAt: null, hidden: true });
      const data = await store().get(KEY, { type: 'json' });
      const items = Array.isArray(data?.items) ? data.items : [];
      return jsonResponse({ items, count: items.length, updatedAt: data?.updatedAt || null });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      if (!Array.isArray(body?.items)) return jsonResponse({ error: 'items must be an array' }, { status: 400 });
      const items = body.items.slice(0, 5000).map((p: any, i: number) => ({
        id: str(p?.id, 100) || `p${i + 1}`,
        name: str(p?.name, 200),
        address: str(p?.address, 300),
        list: str(p?.list, 100),
        category: str(p?.category, 60),
        memo: str(p?.memo, 2000),
        url: str(p?.url, 500),
        lat: num(p?.lat),
        lng: num(p?.lng),
      })).filter((p: any) => p.name);
      const updatedAt = new Date().toISOString().slice(0, 10);
      await store().setJSON(KEY, { items, updatedAt });
      return jsonResponse({ ok: true, count: items.length, updatedAt });
    }

    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/myplaces',
};
