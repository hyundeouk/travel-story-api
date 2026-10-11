import { getStore } from '@netlify/blobs';
import { guestFromReq, type Guest } from './guests.mts';

// 누가 볼 수 있고 누가 고칠 수 있는지 정하는 곳.
//  - 주인: 편집 암호로 로그인한 기기 (쿠키 ek). 보기 + 고치기 모두 가능.
//  - 손님: 공유 링크(?k=...)로 들어온 기기 (쿠키 vk). 보기만 가능.
//  - 설정을 아직 하지 않았으면(편집 암호 없음) 예전처럼 모두 허용한다. 이때는 사이트를 비공개로 두어야 한다.
// 암호 자체는 저장하지 않고, 소금을 섞은 SHA-256 값만 저장한다.

export interface AuthSettings {
  salt: string;
  editHash: string;
  editToken: string;
  viewKey: string;
}

const KEY = 'auth';
const store = () => getStore({ name: 'settings', consistency: 'strong' });

let cached: { at: number; value: AuthSettings | null } | null = null;
const TTL_MS = 15000;

export async function readSettings(fresh = false): Promise<AuthSettings | null> {
  // "아직 설정 안 함" 상태는 기억해 두지 않는다. 암호를 정한 직후부터 바로 막히게 하기 위해서다.
  if (!fresh && cached && cached.value && Date.now() - cached.at < TTL_MS) return cached.value;
  const v: any = await store().get(KEY, { type: 'json' });
  const value = v && v.editHash && v.editToken && v.viewKey && v.salt ? (v as AuthSettings) : null;
  cached = { at: Date.now(), value };
  return value;
}

export async function writeSettings(value: AuthSettings): Promise<void> {
  await store().setJSON(KEY, value);
  cached = { at: Date.now(), value };
}

export function randomKey(bytes = 18): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(salt: string, password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function cookiesOf(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

// 길이가 같을 때 걸리는 시간이 내용에 따라 달라지지 않게 비교한다.
function same(a: string | undefined, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 손님: 공유 링크 쿠키(vk) + 손님 계정 로그인(gk)이 모두 있어야 볼 수 있다.
export async function accessOf(req: Request, fresh = false) {
  const s = await readSettings(fresh);
  if (!s) return { configured: false, canEdit: true, canView: true, linkOk: true, needGuest: false, blocked: false, guest: null as Guest | null, settings: null as AuthSettings | null };
  const c = cookiesOf(req);
  const canEdit = same(c.ek, s.editToken);
  const linkOk = canEdit || same(c.vk, s.viewKey);
  let guest: Guest | null = null, blocked = false;
  if (linkOk && !canEdit) { const r = await guestFromReq(req); guest = r.guest; blocked = r.blocked; }
  const canView = canEdit || (linkOk && !!guest);
  return { configured: true, canEdit, canView, linkOk, needGuest: linkOk && !canEdit && !guest, blocked, guest, settings: s };
}

export function cookie(name: string, value: string, maxAgeSec: number): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// ---------- 공개 범위 (공유 링크로 들어온 손님에게 무엇을 보여줄지) ----------
export interface ShareSettings {
  // feed(내 여행 기록)·mine(내 장소)은 주인만 보는 화면이라 손님에게는 늘 false
  tabs: { feed: boolean; map: boolean; golf: boolean; weather: boolean; browse: boolean; food: boolean; camp: boolean; gstory: boolean; mine: boolean };
  marks: boolean;         // 내 기록(다녀옴·별점·한 줄 평)
  storyMemo: boolean;     // 스토리 글
  storyLocation: boolean; // 스토리 위치(지도 핀·좌표)
  hiddenStories: string[]; // 공개하지 않을 스토리 id
  guestApproval: boolean; // 손님이 쓴 "스토리" 글을 주인이 확인한 뒤 공개
}
export const DEFAULT_SHARE: ShareSettings = {
  tabs: { feed: false, map: true, golf: true, weather: true, browse: true, food: true, camp: true, gstory: true, mine: false },
  marks: true, storyMemo: true, storyLocation: true, hiddenStories: [], guestApproval: false,
};
export function normalizeShare(v: any): ShareSettings {
  const b = (x: any, d: boolean) => (typeof x === 'boolean' ? x : d);
  const t = v?.tabs || {};
  const ids = Array.isArray(v?.hiddenStories) ? v.hiddenStories.filter((x: any) => typeof x === 'string' && x.length <= 80).slice(0, 5000) : [];
  return {
    // 골프·날씨는 나중에 생긴 탭: 저장된 값이 없으면 예전처럼 골프는 "둘러보기", 날씨는 "지도" 설정을 따른다
    tabs: { feed: false, map: b(t.map, true), golf: b(t.golf, b(t.browse, true)), weather: b(t.weather, b(t.map, true)), browse: b(t.browse, true), food: b(t.food, true), camp: b(t.camp, true), gstory: b(t.gstory, true), mine: false },
    marks: b(v?.marks, true), storyMemo: b(v?.storyMemo, true), storyLocation: b(v?.storyLocation, true),
    hiddenStories: Array.from(new Set(ids)),
    guestApproval: b(v?.guestApproval, false),
  };
}
let shareCache: { at: number; value: ShareSettings } | null = null;
export async function readShare(fresh = false): Promise<ShareSettings> {
  if (!fresh && shareCache && Date.now() - shareCache.at < TTL_MS) return shareCache.value;
  const v = await store().get('share', { type: 'json' });
  const value = normalizeShare(v || {});
  shareCache = { at: Date.now(), value };
  return value;
}
export async function writeShare(v: unknown): Promise<ShareSettings> {
  const value = normalizeShare(v);
  await store().setJSON('share', value);
  shareCache = { at: Date.now(), value };
  return value;
}
/** 공유 링크로 들어온 손님(보기만 가능)이면 공개 범위를, 주인이거나 아직 암호 설정 전이면 null을 돌려준다. */
export async function viewerShare(req: Request): Promise<ShareSettings | null> {
  const a = await accessOf(req);
  if (!a.configured || a.canEdit) return null;
  return readShare();
}

/**
 * 모든 API의 맨 앞에서 부른다. 막아야 하면 Response를, 통과면 null을 돌려준다.
 * 읽기(GET)는 주인·손님 모두, 그 밖의 요청(저장·수정·삭제)은 주인만 허용한다.
 */
export async function guard(req: Request, need?: 'read' | 'edit'): Promise<Response | null> {
  const level = need || (req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'edit');
  const a = await accessOf(req);
  if (!a.configured) return null;
  if (level === 'edit') return a.canEdit ? null : deny(a.canView ? 403 : 401, 'edit not allowed');
  return a.canView ? null : deny(401, a.needGuest ? (a.blocked ? 'guest-blocked' : 'guest-login') : 'link required');
}
