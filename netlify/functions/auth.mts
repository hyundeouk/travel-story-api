import type { Context, Config } from '@netlify/functions';
import { accessOf, cookie, hashPassword, randomKey, readSettings, writeSettings, readShare, writeShare } from '../../src/lib/auth.mts';
import { registerGuest, loginGuest, logoutGuest, listGuests, setGuestStatus, resetGuestPassword, deleteGuest, setGuestPrefs } from '../../src/lib/guests.mts';

// 보기/편집 권한 관리.
//  GET  /api/auth                      → 지금 이 기기가 볼 수 있는지, 고칠 수 있는지
//  POST /api/auth {action:'setup', password}   → 처음 한 번: 편집 암호 정하기 (공유 링크도 함께 만들어진다)
//  POST /api/auth {action:'login', password}   → 주인 로그인 (이 기기에서 고칠 수 있게)
//  POST /api/auth {action:'logout'}            → 이 기기의 주인 로그인 해제
//  POST /api/auth {action:'view', key}         → 공유 링크로 들어온 손님 등록 (보기만)
//  POST /api/auth {action:'newlink'}           → 공유 링크 새로 만들기 (예전 링크는 못 쓰게 됨) — 주인만
//  POST /api/auth {action:'password', password}→ 편집 암호 바꾸기 — 주인만
//  POST /api/auth {action:'gjoin'|'glogin', nickname, password} → 손님 계정 만들기/로그인 (공유 링크로 들어온 기기만)
//  POST /api/auth {action:'glogout'}            → 손님 로그아웃(이 기기)
//  POST /api/auth {action:'glist'|'gstatus'|'greset'|'gdelete', id, status, password} → 손님 관리 — 주인만
const YEAR = 60 * 60 * 24 * 365;
const MIN_LEN = 6;

function reply(body: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async (req: Request, _context: Context) => {
  try {
    if (req.method === 'GET') {
      const a = await accessOf(req, true);
      const share = a.configured ? await readShare(true) : null;
      return reply({ configured: a.configured, canEdit: a.canEdit, canView: a.canView, linkOk: a.linkOk, needGuest: a.needGuest, blocked: a.blocked,
        guest: a.guest ? { id: a.guest.id, nickname: a.guest.nickname, prefs: a.guest.prefs || null } : null,
        shareKey: a.configured && a.canEdit ? a.settings!.viewKey : null, share });
    }
    if (req.method !== 'POST') return reply({ error: 'method not allowed' }, 405);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const action = String(body?.action || '');
    const password = typeof body?.password === 'string' ? body.password : '';
    const settings = await readSettings(true);

    if (action === 'setup') {
      if (settings) return reply({ error: 'already configured' }, 409);
      if (password.length < MIN_LEN) return reply({ error: 'password too short', min: MIN_LEN }, 400);
      const salt = randomKey(12);
      const next = { salt, editHash: await hashPassword(salt, password), editToken: randomKey(24), viewKey: randomKey(12) };
      await writeSettings(next);
      return reply({ ok: true, canEdit: true, canView: true, configured: true, shareKey: next.viewKey }, 200, [cookie('ek', next.editToken, YEAR)]);
    }

    if (!settings) return reply({ error: 'not configured' }, 409);

    if (action === 'login') {
      const ok = (await hashPassword(settings.salt, password)) === settings.editHash;
      if (!ok) { await sleep(800); return reply({ error: 'wrong password' }, 401); }
      return reply({ ok: true, canEdit: true, canView: true, configured: true, shareKey: settings.viewKey }, 200, [cookie('ek', settings.editToken, YEAR)]);
    }
    if (action === 'view') {
      const key = typeof body?.key === 'string' ? body.key : '';
      if (!key || key !== settings.viewKey) { await sleep(400); return reply({ error: 'bad link' }, 401); }
      return reply({ ok: true, canView: true }, 200, [cookie('vk', settings.viewKey, YEAR)]);
    }
    if (action === 'logout') {
      return reply({ ok: true }, 200, [cookie('ek', '', 0)]);
    }
    if (action === 'gjoin' || action === 'glogin') {
      const a0 = await accessOf(req, true);
      if (!a0.linkOk) return reply({ error: 'link required' }, 401);
      const nickname = typeof body?.nickname === 'string' ? body.nickname : '';
      const r: any = action === 'gjoin' ? await registerGuest(nickname, password, req) : await loginGuest(nickname, password, req);
      if (r.error) { if (r.error === 'wrong') await sleep(700); return reply({ error: r.error, until: r.until || null }, r.error === 'nickname taken' ? 409 : /too short/.test(r.error) ? 400 : 401); }
      return reply({ ok: true, guest: { id: r.guest.id, nickname: r.guest.nickname } }, 200, [cookie('gk', r.cookieValue, YEAR)]);
    }
    if (action === 'gprefs') {
      const a1 = await accessOf(req, true);
      if (!a1.guest) return reply({ error: 'guest only' }, 401);
      return reply({ ok: true, prefs: await setGuestPrefs(a1.guest.id, body?.prefs) });
    }
    if (action === 'glogout') {
      await logoutGuest(req);
      return reply({ ok: true }, 200, [cookie('gk', '', 0)]);
    }

    // 아래는 주인만
    const a = await accessOf(req, true);
    if (!a.canEdit) return reply({ error: 'edit not allowed' }, 403);

    if (action === 'glist') return reply({ ok: true, guests: await listGuests() });
    if (action === 'gstatus') { const g = await setGuestStatus(String(body?.id || ''), String(body?.status || '')); return g ? reply({ ok: true, guest: g }) : reply({ error: 'not found' }, 404); }
    if (action === 'greset') {
      if (password.length < 4) return reply({ error: 'password too short', min: 4 }, 400);
      const g = await resetGuestPassword(String(body?.id || ''), password);
      return g ? reply({ ok: true, guest: g }) : reply({ error: 'not found' }, 404);
    }
    if (action === 'gdelete') return (await deleteGuest(String(body?.id || ''))) ? reply({ ok: true }) : reply({ error: 'not found' }, 404);
    if (action === 'share') {
      const share = await writeShare(body?.share);
      return reply({ ok: true, share });
    }
    if (action === 'newlink') {
      const next = { ...settings, viewKey: randomKey(12) };
      await writeSettings(next);
      return reply({ ok: true, shareKey: next.viewKey });
    }
    if (action === 'password') {
      if (password.length < MIN_LEN) return reply({ error: 'password too short', min: MIN_LEN }, 400);
      const salt = randomKey(12);
      const next = { ...settings, salt, editHash: await hashPassword(salt, password), editToken: randomKey(24) };
      await writeSettings(next);
      return reply({ ok: true }, 200, [cookie('ek', next.editToken, YEAR)]);
    }
    return reply({ error: 'unknown action' }, 400);
  } catch (err: any) {
    return reply({ error: err?.message || 'unknown error' }, 500);
  }
};

export const config: Config = {
  path: '/api/auth',
};
