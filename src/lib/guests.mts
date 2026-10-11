import { getStore } from '@netlify/blobs';

// 손님 계정 (공유 링크로 들어온 사람이 처음에 닉네임·비밀번호를 만든다).
//  - 비밀번호는 PBKDF2(소금+10만 번)로 바꾼 값만 저장한다 → 주인도 원래 비밀번호는 볼 수 없다(잊으면 주인이 새로 정해 준다).
//  - 로그인하면 기기마다 "로그인 열쇠"(쿠키 gk = <id>.<열쇠>, 1년)를 준다. 서버에는 열쇠의 해시만 둔다.
//    다음부터는 이 열쇠로 자동 로그인된다(비밀번호를 기기에 저장하지 않는다).
//  - 주인은 목록·차단·비밀번호 새로 정하기·삭제를 할 수 있다.
export interface Guest {
  id: string;
  nickname: string;
  nickKey: string;
  salt: string;
  hash: string;
  tokens: { h: string; at: number; ua: string }[];
  createdAt: number;
  lastSeen: number;
  status: 'active' | 'blocked';
  fails: number;
  lockUntil: number;
  it?: number;
  prefs?: { off: string[]; at: number } | null; // 손님이 고른 "내 메뉴" (끈 분야)
}
const store = () => getStore({ name: 'guests', consistency: 'strong' });
const MAX_TOKENS = 10;
const LOCK_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const SEEN_EVERY_MS = 10 * 60 * 1000;

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
function rand(bytes: number) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return hex(a.buffer); }
async function sha256(t: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))); }
// Cloudflare 무료 요금제는 요청 1번당 계산 시간이 아주 짧아서(10ms) 반복 횟수를 1만 번으로 둔다.
// (예전 Netlify 시절 계정은 10만 번 - g.it 로 구분)
const ITER = 10000;
async function pbkdf2(salt: string, password: string, iterations = ITER) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256);
  return hex(bits);
}
export const nickKeyOf = (n: string) => String(n || '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
export function cleanNick(n: unknown) { return typeof n === 'string' ? n.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 20) : ''; }

async function readGuest(id: string): Promise<Guest | null> {
  if (!/^[0-9a-f]{16}$/.test(id)) return null;
  return (await store().get('u-' + id, { type: 'json' })) as Guest | null;
}
async function writeGuest(g: Guest) { await store().setJSON('u-' + g.id, g); }
export function publicGuest(g: Guest) {
  return { id: g.id, nickname: g.nickname, createdAt: g.createdAt, lastSeen: g.lastSeen, status: g.status, devices: g.tokens.length };
}

function parseCookie(req: Request, name: string) {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

// 같은 함수 인스턴스 안에서는 30초 동안 확인 결과를 다시 쓴다
const cache = new Map<string, { at: number; g: Guest | null }>();
/** 요청의 gk 쿠키로 손님을 찾는다. 없거나 차단됐거나 열쇠가 맞지 않으면 null (blocked면 그 손님 정보와 함께 표시) */
export async function guestFromReq(req: Request): Promise<{ guest: Guest | null; blocked: boolean }> {
  const raw = parseCookie(req, 'gk');
  const m = /^([0-9a-f]{16})\.([0-9a-f]{48})$/.exec(raw);
  if (!m) return { guest: null, blocked: false };
  const hit = cache.get(raw);
  let g: Guest | null;
  if (hit && Date.now() - hit.at < 30000) g = hit.g;
  else {
    g = await readGuest(m[1]);
    const h = await sha256('gk|' + m[2]);
    if (g && !g.tokens.some((t) => t.h === h)) g = null;
    cache.set(raw, { at: Date.now(), g });
  }
  if (!g) return { guest: null, blocked: false };
  if (g.status !== 'active') return { guest: null, blocked: true };
  if (Date.now() - (g.lastSeen || 0) > SEEN_EVERY_MS) {
    g.lastSeen = Date.now();
    // 저장된 최신 내용(예: 메뉴 설정)을 덮어쓰지 않도록 다시 읽어서 시각만 고친다
    readGuest(g.id).then((f) => { if (f) { f.lastSeen = Date.now(); return writeGuest(f); } }).catch(() => {});
  }
  return { guest: g, blocked: false };
}

async function issueToken(g: Guest, req: Request) {
  const token = rand(24);
  g.tokens.unshift({ h: await sha256('gk|' + token), at: Date.now(), ua: (req.headers.get('user-agent') || '').slice(0, 80) });
  g.tokens = g.tokens.slice(0, MAX_TOKENS);
  return `${g.id}.${token}`;
}

export async function registerGuest(nickname: string, password: string, req: Request) {
  const nick = cleanNick(nickname);
  const key = nickKeyOf(nick);
  if (nick.length < 2) return { error: 'nickname too short' as const };
  if (password.length < 4 || password.length > 100) return { error: 'password too short' as const };
  if (await store().get('n-' + key, { type: 'json' })) return { error: 'nickname taken' as const };
  const salt = rand(12);
  const g: Guest = { id: rand(8), nickname: nick, nickKey: key, salt, hash: await pbkdf2(salt, password), it: ITER, tokens: [], createdAt: Date.now(), lastSeen: Date.now(), status: 'active', fails: 0, lockUntil: 0 };
  const cookieValue = await issueToken(g, req);
  await writeGuest(g);
  await store().setJSON('n-' + key, { id: g.id });
  return { guest: g, cookieValue };
}

export async function loginGuest(nickname: string, password: string, req: Request) {
  const idx: any = await store().get('n-' + nickKeyOf(cleanNick(nickname)), { type: 'json' });
  const g = idx ? await readGuest(idx.id) : null;
  if (!g) return { error: 'wrong' as const };
  if (g.status !== 'active') return { error: 'blocked' as const };
  if (g.lockUntil > Date.now()) return { error: 'locked' as const, until: g.lockUntil };
  if ((await pbkdf2(g.salt, password, g.it || 100000)) !== g.hash) {
    g.fails = (g.fails || 0) + 1;
    if (g.fails >= LOCK_FAILS) { g.lockUntil = Date.now() + LOCK_MS; g.fails = 0; }
    await writeGuest(g);
    return { error: 'wrong' as const };
  }
  g.fails = 0; g.lockUntil = 0; g.lastSeen = Date.now();
  const cookieValue = await issueToken(g, req);
  await writeGuest(g);
  return { guest: g, cookieValue };
}

export async function logoutGuest(req: Request) {
  const raw = parseCookie(req, 'gk');
  const m = /^([0-9a-f]{16})\.([0-9a-f]{48})$/.exec(raw);
  if (!m) return;
  const g = await readGuest(m[1]);
  if (!g) return;
  const h = await sha256('gk|' + m[2]);
  g.tokens = g.tokens.filter((t) => t.h !== h);
  await writeGuest(g);
  cache.delete(raw);
}

// ----- 주인용
export async function listGuests() {
  const { blobs } = await store().list({ prefix: 'u-' });
  const all = (await Promise.all(blobs.map((b) => store().get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean) as Guest[];
  return all.map(publicGuest).sort((a, b) => b.lastSeen - a.lastSeen);
}
export async function setGuestStatus(id: string, status: string) {
  const g = await readGuest(id);
  if (!g || (status !== 'active' && status !== 'blocked')) return null;
  g.status = status;
  if (status === 'blocked') g.tokens = []; // 차단하면 모든 기기에서 로그아웃
  await writeGuest(g);
  cache.clear();
  return publicGuest(g);
}
export async function resetGuestPassword(id: string, password: string) {
  const g = await readGuest(id);
  if (!g || password.length < 4) return null;
  g.salt = rand(12);
  g.hash = await pbkdf2(g.salt, password);
  g.it = ITER;
  g.tokens = []; // 새 비밀번호로 다시 로그인하게
  g.fails = 0; g.lockUntil = 0;
  await writeGuest(g);
  cache.clear();
  return publicGuest(g);
}
export async function deleteGuest(id: string) {
  const g = await readGuest(id);
  if (!g) return false;
  await store().delete('u-' + id);
  await store().delete('n-' + g.nickKey);
  cache.clear();
  return true;
}

/** 손님의 "내 메뉴" 설정 저장 (끈 분야 목록) */
export async function setGuestPrefs(id: string, prefs: any) {
  const g = await readGuest(id);
  if (!g) return null;
  const off = Array.isArray(prefs?.off) ? Array.from(new Set(prefs.off.filter((x: unknown) => typeof x === 'string' && /^[a-z]{2,12}$/.test(x as string)))).slice(0, 30) as string[] : [];
  g.prefs = { off, at: Date.now() };
  await writeGuest(g);
  cache.clear();
  return g.prefs;
}
