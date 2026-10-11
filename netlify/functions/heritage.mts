import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { fetchHeritageList, fetchHeritageDetail } from '../../src/lib/heritage.mts';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const debug = q.get('debug') === '1';

    if (url.pathname.endsWith('/detail')) {
      const kdcd = q.get('kdcd') || '';
      const asno = q.get('asno') || '';
      const ctcd = q.get('ctcd') || '';
      if (!/^\d{2}$/.test(kdcd) || !/^\d{1,20}$/.test(asno) || !/^[0-9A-Z]{2}$/.test(ctcd)) {
        return jsonResponse({ error: 'bad request' }, { status: 400 });
      }
      // 상세(사진·설명)는 잘 바뀌지 않으므로 한 번 받은 것은 저장해 두고 다시 쓴다.
      const key = `heritage3-${kdcd}-${asno}-${ctcd}`; // 2: 사진 여러 장·분류·소유자 등을 더한 형식
      if (!debug) {
        const hit = await getStore('cache').get(key, { type: 'json' });
        if (hit && typeof hit === 'object' && hit.name) return jsonResponse({ ...hit, cached: true });
      }
      const detail = await fetchHeritageDetail({ kdcd, asno, ctcd, debug });
      if (!debug && detail.name) await getStore('cache').setJSON(key, detail);
      return jsonResponse(detail);
    }

    // 지도 "내 주변"용: 한 시·도의 한 종목을 전부(좌표 있는 것만) 받아 30일 동안 저장해 두고 쓴다.
    if (q.get('all') === '1') {
      const kind = q.get('kind') || '11';
      const areaCode = q.get('areaCode') || '';
      if (!/^\d{2}$/.test(kind) || !/^\d{1,2}$/.test(areaCode)) return jsonResponse({ error: 'bad request' }, { status: 400 });
      const key = `hlist-v1-${kind}-${areaCode}`;
      const store = getStore('cache');
      const hit: any = await store.get(key, { type: 'json' });
      if (hit && Date.now() - (hit.at || 0) < 30 * 24 * 3600 * 1000) return jsonResponse({ ...hit, cached: true });
      const first = await fetchHeritageList({ kind, areaCode, page: 1 });
      const pages = Math.min(15, Math.ceil((first.total || 0) / first.pageUnit));
      const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fetchHeritageList({ kind, areaCode, page: i + 2 }).catch(() => ({ items: [], failed: true }))));
      const failed = rest.some((r: any) => r.failed);
      const items = first.items.concat(...rest.map((r: any) => r.items)).filter((it: any) => it.lat != null && it.lng != null);
      const out = { at: Date.now(), kind, kindName: first.kindName, areaCode, total: first.total, items };
      if (!failed) await store.setJSON(key, out);
      return jsonResponse(out);
    }

    const result = await fetchHeritageList({
      kind: q.get('kind') || undefined,
      areaCode: q.get('areaCode') || undefined,
      page: Number(q.get('page')) || 1,
      debug,
    });
    return jsonResponse({ ...result, count: result.items.length });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: ['/api/heritage', '/api/heritage/detail'],
};
