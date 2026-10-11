import type { Context, Config } from '@netlify/functions';
import { guard, viewerShare } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 캠핑 탭 → 🛒 캠핑용품점: 운영자가 앱에서 "전국 캠핑용품점 모으기"를 눌러 카카오 장소 검색으로 모은 목록을 저장해 두고 모두가 본다.
//   GET /api/campshops     저장된 전국 목록 (보는 사람 모두)
//   PUT /api/campshops     {items:[...]} 운영자만 (목록 전체를 바꾼다)
const store = () => getStore({ name: 'campshops', consistency: 'strong' });
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 1e5) / 1e5 : null; };

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    if (req.method === 'GET') {
      const share = await viewerShare(req);
      if (share && share.tabs && (share.tabs as any).camp === false) return jsonResponse({ items: [], hidden: true });
      const d: any = await store().get('all', { type: 'json' });
      return jsonResponse({ items: (d && d.items) || [], at: (d && d.at) || null });
    }
    if (req.method === 'PUT') {
      const body: any = await req.json().catch(() => ({}));
      if (!Array.isArray(body?.items)) return jsonResponse({ error: 'items must be an array' }, { status: 400 });
      const seen = new Set<string>();
      const items = body.items.slice(0, 6000).map((s: any) => {
        const y = num(s?.y), x = num(s?.x);
        const u = str(s?.u, 120).replace(/^http:/, 'https:');
        return {
          id: /^\d{1,15}$/.test(String(s?.id || '')) ? String(s.id) : '',
          n: str(s?.n, 60), cat: str(s?.cat, 80), a: str(s?.a, 120), p: str(s?.p, 20).replace(/[^0-9-]/g, ''),
          y, x, u: /^https:\/\/place\.map\.kakao\.com\/\d{1,15}$/.test(u) ? u : '',
        };
      }).filter((s: any) => {
        if (!s.id || !s.n || s.y == null || s.x == null || seen.has(s.id)) return false;
        if (!(s.y > 32 && s.y < 39.5 && s.x > 124 && s.x < 132)) return false;
        seen.add(s.id); return true;
      });
      const at = new Date().toISOString();
      await store().setJSON('all', { items, at });
      return jsonResponse({ ok: true, count: items.length, at });
    }
    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/campshops',
};
