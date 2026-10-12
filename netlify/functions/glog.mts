import type { Context, Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { accessOf } from '../../src/lib/auth.mts';

// 손님 사용 기록 · 오류 기록 (주인이 손님 관리에서 본다)
//  POST /api/glog {usage:{기능:횟수}, errors:[...], device:{...}, session:true}  ← 손님 기기가 보냄 (주인 기기는 보내지 않음)
//  GET  /api/glog                → 주인만: 손님별 기록 전체
//  GET  /api/glog?count=1        → 주인만: 아직 안 본 오류 수
//  POST /api/glog {action:'seen'}          → 주인만: 오류를 모두 봤다고 표시
//  POST /api/glog {action:'clear', id}     → 주인만: 그 손님의 오류 기록 지우기
interface Err { at: number; msg: string; where: string; view: string; dev: string; n: number }
interface Dev { name: string; w: number; h: number; app: boolean; at: number }
// 로그인 전 방문자는 기기마다 따로 센다 (브라우저마다 만든 기기 번호 id)
interface AnonDev { id: string; name: string; w: number; h: number; app: boolean; first: number; last: number; visits: number; errs: number }
interface GLog {
  id: string; nick: string; first: number; last: number; sessions: number;
  usage: Record<string, number>; devices: Dev[]; errors: Err[]; errTotal: number; unread: number;
  anonDevs?: AnonDev[];
}
const store = () => getStore({ name: 'glog', consistency: 'strong' });
const MAX_ERRORS = 40, MAX_DEVICES = 4, MAX_USAGE_KEYS = 120, MAX_ANON_DEVS = 300;
function anonList(g: GLog, skipName = ''): AnonDev[] {
  if (!Array.isArray(g.anonDevs)) {
    // 예전 기록(기기 번호 없이 최근 기기 4개만)은 그대로 옮겨 둔다
    g.anonDevs = (g.devices || []).filter((d) => d.name !== skipName).map((d, i) => ({ id: 'old-' + i, name: d.name, w: d.w, h: d.h, app: d.app, first: d.at, last: d.at, visits: 0, errs: 0 }));
  }
  return g.anonDevs;
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
const str = (v: unknown, n: number) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/[\u0000-\u001f]+/g, ' ').slice(0, n);
const num = (v: unknown, max: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? Math.min(x, max) : 0; };

async function readMeta(): Promise<{ unread: number; lastErrAt: number }> {
  return ((await store().get('meta', { type: 'json' })) as any) || { unread: 0, lastErrAt: 0 };
}

export default async (req: Request, _context: Context) => {
  try {
    const a = await accessOf(req, true);
    const url = new URL(req.url);
    if (req.method === 'GET') {
      if (!a.canEdit) return reply({ error: 'edit not allowed' }, 403);
      if (url.searchParams.get('count')) { const m = await readMeta(); return reply({ ok: true, unread: m.unread || 0, lastErrAt: m.lastErrAt || 0 }); }
      const keys = (await store().list({ prefix: 'u-' })).blobs.map((b: any) => b.key);
      keys.push('anon');
      const logs: GLog[] = [];
      for (const k of keys) { const g = (await store().get(k, { type: 'json' })) as GLog | null; if (g) logs.push(g); }
      logs.sort((x, y) => (y.last || 0) - (x.last || 0));
      const m = await readMeta();
      return reply({ ok: true, logs, unread: m.unread || 0 });
    }
    if (req.method !== 'POST') return reply({ error: 'method not allowed' }, 405);
    let body: any = {};
    try { body = JSON.parse(await req.text()); } catch { body = {}; }

    if (body?.action === 'anondel' || body?.action === 'anonclear') {
      if (!a.canEdit) return reply({ error: 'edit not allowed' }, 403);
      const g = (await store().get('anon', { type: 'json' })) as GLog | null;
      if (g) {
        if (body.action === 'anonclear') await store().delete('anon');
        else {
          const did = String(body.did || '');
          g.anonDevs = anonList(g).filter((d) => d.id !== did);
          g.devices = (g.devices || []).filter((d) => g.anonDevs!.some((x) => x.name === d.name));
          await store().setJSON('anon', g);
        }
      }
      // 아직 안 본 오류 수 다시 세기
      let unread = 0;
      for (const k of (await store().list({ prefix: 'u-' })).blobs.map((b: any) => b.key).concat(['anon'])) { const x = (await store().get(k, { type: 'json' })) as GLog | null; if (x) unread += x.unread || 0; }
      const m = await readMeta(); m.unread = unread; await store().setJSON('meta', m);
      return reply({ ok: true, unread });
    }

    if (body?.action === 'seen' || body?.action === 'clear') {
      if (!a.canEdit) return reply({ error: 'edit not allowed' }, 403);
      const keys = body.action === 'clear' ? [String(body.id || '')] : (await store().list({ prefix: 'u-' })).blobs.map((b: any) => b.key).concat(['anon']);
      for (const k of keys) {
        if (!/^(u-[0-9a-f]{16}|anon)$/.test(k)) continue;
        const g = (await store().get(k, { type: 'json' })) as GLog | null;
        if (!g) continue;
        if (body.action === 'clear') g.errors = [];
        g.unread = 0;
        await store().setJSON(k, g);
      }
      const all = (await store().list({ prefix: 'u-' })).blobs.map((b: any) => b.key).concat(['anon']);
      let unread = 0;
      if (body.action === 'clear') for (const k of all) { const g = (await store().get(k, { type: 'json' })) as GLog | null; if (g) unread += g.unread || 0; }
      const m = await readMeta(); m.unread = unread; await store().setJSON('meta', m);
      return reply({ ok: true, unread });
    }

    // 손님 기기에서 온 기록. 주인 기기는 기록하지 않는다.
    if (a.canEdit) return reply({ ok: true, skip: true });
    if (!a.linkOk || a.blocked) return reply({ error: 'link required' }, 401);
    const key = a.guest ? 'u-' + a.guest.id : 'anon';
    const now = Date.now();
    const g: GLog = ((await store().get(key, { type: 'json' })) as GLog | null) || {
      id: a.guest ? a.guest.id : 'anon', nick: a.guest ? a.guest.nickname : '로그인 전 방문자',
      first: now, last: now, sessions: 0, usage: {}, devices: [], errors: [], errTotal: 0, unread: 0,
    };
    if (a.guest) g.nick = a.guest.nickname;
    g.last = now;
    if (body?.session) g.sessions = (g.sessions || 0) + 1;

    // 기능별 사용 횟수
    const usage = body?.usage && typeof body.usage === 'object' ? body.usage : {};
    for (const [k0, v] of Object.entries(usage).slice(0, 60)) {
      const k = str(k0, 40).trim(); const n = num(v, 500);
      if (!k || !n) continue;
      if (!(k in g.usage) && Object.keys(g.usage).length >= MAX_USAGE_KEYS) continue;
      g.usage[k] = (g.usage[k] || 0) + n;
    }
    // 기기 (이름이 같으면 시각만 고친다)
    const dv = body?.device;
    let devName = '';
    if (dv && typeof dv === 'object') {
      devName = str(dv.name, 80);
      if (devName) {
        const d: Dev = { name: devName, w: num(dv.w, 10000), h: num(dv.h, 10000), app: !!dv.app, at: now };
        g.devices = [d].concat((g.devices || []).filter((x) => x.name !== devName)).slice(0, MAX_DEVICES);
      }
    }
    // 오류 (같은 오류는 횟수만 늘린다)
    const errs = Array.isArray(body?.errors) ? body.errors.slice(0, 10) : [];
    let added = 0;
    for (const e of errs) {
      const msg = str(e?.msg, 300).trim();
      if (!msg) continue;
      const where = str(e?.where, 300), view = str(e?.view, 40), dev = str(e?.dev, 80) || devName;
      const same = g.errors.find((x) => x.msg === msg && x.where === where);
      if (same) { same.n = (same.n || 1) + 1; same.at = now; same.view = view || same.view; same.dev = dev || same.dev; g.errors = [same].concat(g.errors.filter((x) => x !== same)); }
      else g.errors.unshift({ at: now, msg, where, view, dev, n: 1 });
      g.errTotal = (g.errTotal || 0) + 1;
      g.unread = (g.unread || 0) + 1;
      added++;
    }
    g.errors = g.errors.slice(0, MAX_ERRORS);
    if (!a.guest && dv && typeof dv === 'object' && devName) {
      const list = anonList(g, devName);
      const rawId = String(dv.id || '');
      const id = /^[a-z0-9]{8,32}$/.test(rawId) ? rawId : 'nm-' + devName.slice(0, 60);
      let d = list.find((x) => x.id === id);
      if (!d) { d = { id, name: devName, w: 0, h: 0, app: false, first: now, last: now, visits: 0, errs: 0 }; list.unshift(d); }
      d.name = devName; d.w = num(dv.w, 10000); d.h = num(dv.h, 10000); d.app = !!dv.app; d.last = now;
      if (body?.session) d.visits = (d.visits || 0) + 1;
      d.errs = (d.errs || 0) + added;
      g.anonDevs = list.sort((x, y) => y.last - x.last).slice(0, MAX_ANON_DEVS);
    }
    await store().setJSON(key, g);
    if (added) { const m = await readMeta(); m.unread = (m.unread || 0) + added; m.lastErrAt = now; await store().setJSON('meta', m); }
    return reply({ ok: true });
  } catch (e: any) {
    return reply({ error: 'failed' }, 500);
  }
};

export const config: Config = {
  path: '/api/glog',
};
