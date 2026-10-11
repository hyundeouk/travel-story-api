import type { Context, Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { accessOf } from '../../src/lib/auth.mts';
import { listGuests } from '../../src/lib/guests.mts';
import { jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 운영자가 항목을 숨기거나(지우기) 정보를 고치고, 게스트가 정보 오류를 알리는 곳.
//   GET  /api/fixes                 숨긴 항목 번호 · 고친 정보 (보는 사람 모두)
//   GET  /api/fixes?reports=1       운영자: 게스트가 보낸 정보 오류 목록
//   GET  /api/fixes?count=1         운영자: 아직 확인하지 않은 오류 수
//   POST {action:'hide'|'unhide', key, title, cat}          운영자
//   POST {action:'edit', key, title, cat, fix:{title,addr,tel,hours,note}}  운영자 (fix 가 비면 원래대로)
//   POST {action:'report', key, title, cat, text, lat, lng} 게스트(또는 운영자)
//   POST {action:'rstatus', id, status:'done'|'dismiss'|'new'} · {action:'rdel', id}  운영자
// 원래 자료(공공데이터 등)는 그대로 두고, 앱에서 보여 줄 때만 숨기거나 고친 내용을 덮어 쓴다.
const store = () => getStore({ name: 'fixes', consistency: 'strong' });
const MAX_REPORTS = 300;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0009\u000b-\u001f]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '');
const keyOk = (k: string) => k.length >= 3 && k.length <= 200;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 1e5) / 1e5 : null; };

interface All { hidden: Record<string, any>; edits: Record<string, any> }
async function readAll(): Promise<All> {
  const d: any = await store().get('all', { type: 'json' }).catch(() => null);
  return { hidden: (d && d.hidden) || {}, edits: (d && d.edits) || {} };
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const a = await accessOf(req);
  if (!a.canView) return jsonResponse({ error: a.needGuest ? 'guest-login' : 'link required' }, { status: 401 });
  const isOwner = a.canEdit;
  const s = store();
  try {
    if (req.method === 'GET') {
      const q = new URL(req.url).searchParams;
      if (q.get('count') || q.get('reports')) {
        if (!isOwner) return jsonResponse({ error: 'edit not allowed' }, { status: 403 });
        const { blobs } = await s.list({ prefix: 'r-' });
        const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean) as any[];
        if (q.get('count')) return jsonResponse({ ok: true, unread: all.filter((r) => r.status === 'new').length });
        const names: Record<string, string> = {};
        try { (await listGuests()).forEach((g: any) => { if (g.realName) names[g.id] = g.realName; }); } catch { /* 이름은 없어도 된다 */ }
        all.forEach((r) => { if (r.guestId && names[r.guestId]) r.realName = names[r.guestId]; });
        all.sort((x, y) => (x.status === 'new' ? 0 : 1) - (y.status === 'new' ? 0 : 1) || String(y.at).localeCompare(String(x.at)));
        return jsonResponse({ ok: true, items: all });
      }
      const d = await readAll();
      // 게스트에게는 누가 언제 지웠는지 같은 관리 정보는 보내지 않는다
      return jsonResponse({ ok: true, hidden: isOwner ? d.hidden : Object.fromEntries(Object.keys(d.hidden).map((k) => [k, 1])), edits: d.edits });
    }
    if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, { status: 405 });
    const body: any = await req.json().catch(() => ({}));
    const act = String(body?.action || '');
    const key = str(body?.key, 200);
    const now = new Date().toISOString();

    if (act === 'report') {
      if (!keyOk(key)) return jsonResponse({ error: 'bad key' }, { status: 400 });
      const t = text(body?.text, 500);
      if (t.length < 2) return jsonResponse({ error: 'text required' }, { status: 400 });
      const { blobs } = await s.list({ prefix: 'r-' });
      if (blobs.length >= MAX_REPORTS) return jsonResponse({ error: 'too many' }, { status: 429 });
      const item = {
        id: crypto.randomUUID(), key, title: str(body?.title, 80), cat: str(body?.cat, 20), text: t,
        lat: num(body?.lat), lng: num(body?.lng),
        by: isOwner ? '운영자' : a.guest ? a.guest.nickname : '게스트', guestId: a.guest ? a.guest.id : null,
        status: 'new', at: now,
      };
      await s.setJSON('r-' + item.id, item);
      return jsonResponse({ ok: true }, { status: 201 });
    }

    if (!isOwner) return jsonResponse({ error: 'edit not allowed' }, { status: 403 });

    if (act === 'rstatus' || act === 'rdel') {
      const id = String(body?.id || '');
      if (!/^[0-9a-f-]{36}$/.test(id)) return jsonResponse({ error: 'not found' }, { status: 404 });
      if (act === 'rdel') { await s.delete('r-' + id); return jsonResponse({ ok: true }); }
      const cur: any = await s.get('r-' + id, { type: 'json' });
      if (!cur) return jsonResponse({ error: 'not found' }, { status: 404 });
      const st = ['new', 'done', 'dismiss'].includes(body?.status) ? body.status : 'done';
      await s.setJSON('r-' + id, { ...cur, status: st, doneAt: now });
      return jsonResponse({ ok: true });
    }

    if (!keyOk(key)) return jsonResponse({ error: 'bad key' }, { status: 400 });
    const d = await readAll();
    if (act === 'hide') d.hidden[key] = { title: str(body?.title, 80), cat: str(body?.cat, 20), at: now };
    else if (act === 'unhide') delete d.hidden[key];
    else if (act === 'edit') {
      const f = body?.fix || {};
      const fix: any = { title: str(f.title, 80), addr: str(f.addr, 150), tel: str(f.tel, 30), hours: text(f.hours, 200), note: text(f.note, 500) };
      Object.keys(fix).forEach((k) => { if (!fix[k]) delete fix[k]; });
      if (Object.keys(fix).length) d.edits[key] = { ...fix, orig: str(body?.title, 80), cat: str(body?.cat, 20), at: now };
      else delete d.edits[key];
    } else return jsonResponse({ error: 'bad action' }, { status: 400 });
    await s.setJSON('all', d);
    return jsonResponse({ ok: true, hidden: d.hidden, edits: d.edits });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/fixes',
};
