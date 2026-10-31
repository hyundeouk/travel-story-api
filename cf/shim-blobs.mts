/* @netlify/blobs 대신 Cloudflare D1(SQLite)에 저장하는 같은 모양의 함수.
   표: blobs(store, key, part, data, meta, ctype)
   - D1 한 칸에는 2MB까지만 들어가서, 큰 값(사진 등)은 1MB씩 나눠(part 0,1,2…) 저장한다.
   - ctype: 'json' | 'text' | 'bin' (꺼낼 때 원래 모양으로 돌려주기 위해) */
let MAIN: any = null;
let SHARDS: any[] = [];
// 사진(photos·gphotos)은 D1 한 개 500MB 한도를 넘기 쉬워 따로 만든 사진 저장소 여러 개에 나눠 담는다.
export function bindDB(db: any, shards?: any[]) { MAIN = db; SHARDS = (shards || []).filter(Boolean); }
const PHOTO_STORES = new Set(['photos', 'gphotos']);
function hash(k: string) { let h = 2166136261; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dbFor(store: string, key: string) { return PHOTO_STORES.has(store) && SHARDS.length ? SHARDS[hash(key) % SHARDS.length] : MAIN; }
const CACHE_DAYS = 14;

const PART = 1_000_000;
const te = new TextEncoder();
const td = new TextDecoder();

function toBytes(v: any): { bytes: Uint8Array; ctype: string } {
  if (v instanceof Uint8Array) return { bytes: v, ctype: 'bin' };
  if (v instanceof ArrayBuffer) return { bytes: new Uint8Array(v), ctype: 'bin' };
  if (ArrayBuffer.isView(v)) return { bytes: new Uint8Array(v.buffer, v.byteOffset, v.byteLength), ctype: 'bin' };
  return { bytes: te.encode(String(v)), ctype: 'text' };
}

async function readRows(db: any, store: string, key: string) {
  const r = await db.prepare('SELECT part, data, meta, ctype FROM blobs WHERE store=?1 AND key=?2 ORDER BY part').bind(store, key).all();
  return r.results || [];
}
async function readRaw(store: string, key: string): Promise<{ bytes: Uint8Array; ctype: string; meta: any } | null> {
  const db = dbFor(store, key);
  let rows = await readRows(db, store, key);
  if (!rows.length && db !== MAIN) rows = await readRows(MAIN, store, key); // 나누기 전에 저장된 사진
  if (!rows.length) return null;
  const chunks = rows.map((x: any) => x.data instanceof ArrayBuffer ? new Uint8Array(x.data) : new Uint8Array(x.data));
  const total = chunks.reduce((n: number, c: Uint8Array) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; }
  let meta = {}; try { meta = rows[0].meta ? JSON.parse(rows[0].meta) : {}; } catch {}
  return { bytes, ctype: rows[0].ctype || 'text', meta };
}

async function writeRaw(store: string, key: string, bytes: Uint8Array, ctype: string, meta: any) {
  const DB = dbFor(store, key);
  if (DB !== MAIN) await MAIN.prepare('DELETE FROM blobs WHERE store=?1 AND key=?2').bind(store, key).run();
  const stmts = [DB.prepare('DELETE FROM blobs WHERE store=?1 AND key=?2').bind(store, key)];
  const metaStr = JSON.stringify(meta || {});
  const n = Math.max(1, Math.ceil(bytes.length / PART));
  for (let i = 0; i < n; i++) {
    stmts.push(DB.prepare('INSERT INTO blobs (store, key, part, data, meta, ctype, updated) VALUES (?1,?2,?3,?4,?5,?6,?7)')
      .bind(store, key, i, bytes.slice(i * PART, (i + 1) * PART), metaStr, ctype, Date.now()));
  }
  await DB.batch(stmts);
  // 캐시는 오래된 것을 가끔 지운다 (저장소가 끝없이 커지지 않게)
  if (store === 'cache' && Math.random() < 0.02) {
    try { await MAIN.prepare("DELETE FROM blobs WHERE store='cache' AND updated < ?1").bind(Date.now() - CACHE_DAYS * 86400000).run(); } catch {}
  }
}

function convert(raw: { bytes: Uint8Array; ctype: string }, type?: string) {
  if (type === 'arrayBuffer') return raw.bytes.buffer.slice(raw.bytes.byteOffset, raw.bytes.byteOffset + raw.bytes.byteLength);
  if (type === 'blob') return new Blob([raw.bytes]);
  if (type === 'stream') return new Blob([raw.bytes]).stream();
  const text = td.decode(raw.bytes);
  if (type === 'json') { try { return JSON.parse(text); } catch { return null; } }
  return text;
}

export function getStore(opt: any) {
  const name = typeof opt === 'string' ? opt : opt?.name;
  return {
    async get(key: string, o?: { type?: string }) {
      const raw = await readRaw(name, key);
      return raw ? convert(raw, o?.type) : null;
    },
    async getWithMetadata(key: string, o?: { type?: string }) {
      const raw = await readRaw(name, key);
      return raw ? { data: convert(raw, o?.type), metadata: raw.meta, etag: '' } : null;
    },
    async getMetadata(key: string) {
      const db = dbFor(name, key);
      let r = await db.prepare('SELECT meta FROM blobs WHERE store=?1 AND key=?2 AND part=0').bind(name, key).first();
      if (!r && db !== MAIN) r = await MAIN.prepare('SELECT meta FROM blobs WHERE store=?1 AND key=?2 AND part=0').bind(name, key).first();
      if (!r) return null;
      let metadata = {}; try { metadata = JSON.parse(r.meta || '{}'); } catch {}
      return { metadata, etag: '' };
    },
    async set(key: string, value: any, o?: { metadata?: any }) {
      if (value instanceof Blob) value = new Uint8Array(await value.arrayBuffer());
      const { bytes, ctype } = toBytes(value);
      await writeRaw(name, key, bytes, ctype, o?.metadata);
      return {};
    },
    async setJSON(key: string, value: any, o?: { metadata?: any }) {
      await writeRaw(name, key, te.encode(JSON.stringify(value)), 'json', o?.metadata);
      return {};
    },
    async delete(key: string) {
      // 사진을 지우면 그 사진의 카드용 작은 복사본(<uuid>.t.jpg)도 함께 지운다
      if (PHOTO_STORES.has(name) && /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(key)) {
        const tk = key.replace(/\.[a-z]+$/, '') + '.t.jpg', tdb = dbFor(name, tk);
        try { await tdb.prepare('DELETE FROM blobs WHERE store=?1 AND key=?2').bind(name, tk).run(); if (tdb !== MAIN) await MAIN.prepare('DELETE FROM blobs WHERE store=?1 AND key=?2').bind(name, tk).run(); } catch {}
      }
      const db = dbFor(name, key);
      await db.prepare('DELETE FROM blobs WHERE store=?1 AND key=?2').bind(name, key).run();
      if (db !== MAIN) await MAIN.prepare('DELETE FROM blobs WHERE store=?1 AND key=?2').bind(name, key).run();
    },
    async list(o?: { prefix?: string }) {
      const prefix = o?.prefix || '';
      const r = await MAIN.prepare("SELECT key FROM blobs WHERE store=?1 AND part=0 AND key >= ?2 AND key < ?3 ORDER BY key")
        .bind(name, prefix, prefix + '￿').all();
      return { blobs: (r.results || []).map((x: any) => ({ key: x.key, etag: '' })), directories: [] };
    },
  };
}
export default { getStore };
