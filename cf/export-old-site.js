/* 예전 Netlify 여행 스토리(주인으로 로그인된 화면)에서 실행: 자료를 모두 읽어 새 Cloudflare 주소로 보낸다.
   사용: await IRIN_MIGRATE('https://travel-story.XXXX.workers.dev', '가져오기 토큰') */
window.IRIN_MIGRATE = async function (NEW, TOKEN, opts) {
  opts = opts || {};
  const log = (...a) => { console.log('[migrate]', ...a); (window.__migLog = window.__migLog || []).push(a.join(' ')); };
  const get = async (p) => { const r = await fetch(p, { credentials: 'include', cache: 'no-store' }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };
  const post = async (body) => {
    const r = await fetch(NEW + '/api/_import', { method: 'POST', headers: { 'content-type': 'application/json', 'x-import-token': TOKEN }, body: JSON.stringify(body) });
    const t = await r.text(); if (!r.ok) throw new Error('import ' + r.status + ' ' + t); return JSON.parse(t);
  };
  const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

  const auth = await get('/api/auth');
  if (!auth.canEdit) throw new Error('주인으로 로그인되어 있지 않아요');
  const items = [];
  const report = {};
  // 1) 스토리(내 여행 기록)
  const st = await get('/api/stories');
  const stories = (st.items || []).map((s) => s);
  items.push({ store: 'stories', key: 'all', json: stories }); report.stories = stories.length;
  // 2) 장소별 사진 표, 3) 표시(마크), 4) 내 장소
  const ci = await get('/api/customimages'); items.push({ store: 'customimages', key: 'all', json: ci.items || {} }); report.customimages = Object.keys(ci.items || {}).length;
  const mk = await get('/api/marks'); items.push({ store: 'marks', key: 'all', json: mk.items || {} }); report.marks = Object.keys(mk.items || {}).length;
  const mp = await get('/api/myplaces'); items.push({ store: 'myplaces', key: 'all', json: { items: mp.items || [], updatedAt: mp.updatedAt || null } }); report.myplaces = (mp.items || []).length;
  // 5) 공개 범위 설정
  if (auth.share) items.push({ store: 'settings', key: 'share', json: auth.share });
  // 6) 손님 스토리 (작성자 열쇠는 옮길 수 없어 'imported' 로 — 주인은 계속 관리 가능)
  let gphotoIds = [];
  try {
    const gs = await get('/api/gstories');
    for (const g of gs.items || []) {
      const { mine, ...rest } = g;
      items.push({ store: 'gstories', key: 's-' + g.id, json: { ...rest, author: g.owner ? 'owner' : 'imported' } });
      gphotoIds.push(...(g.photoIds || []));
    }
    report.gstories = (gs.items || []).length;
  } catch (e) { log('gstories 건너뜀', e.message); }
  // 사진 번호 모으기
  const PHOTO_RE = /[0-9a-f-]{36}\.(?:jpg|png|webp|gif)/g;
  const photoIds = [...new Set(JSON.stringify([stories, ci.items || {}, mp.items || []]).match(PHOTO_RE) || [])];
  gphotoIds = [...new Set(gphotoIds)];
  report.photos = photoIds.length; report.gphotos = gphotoIds.length;
  // 카카오 지도 키(웹 페이지용 공개 키)
  let env = {};
  try { const mc = await get('/api/mapconfig'); if (mc.kakaoKey) env.KAKAO_JS_KEY = mc.kakaoKey; } catch {}
  log('목록', JSON.stringify(report));
  await post({ items, env });
  log('자료 표 옮김', items.length);
  // 사진: 몇 장씩 나눠 보내기
  let batch = [], size = 0, done = 0, fail = [];
  const flush = async () => { if (!batch.length) return; await post({ items: batch }); done += batch.length; log('사진', done, '/', photoIds.length + gphotoIds.length); batch = []; size = 0; };
  for (const [store, ids, url] of [['photos', photoIds, '/api/photos/'], ['gphotos', gphotoIds, '/api/gphotos/']]) {
    for (const id of ids) {
      try {
        const r = await fetch(url + id, { credentials: 'include' });
        if (!r.ok) { fail.push(id); continue; }
        const buf = await r.arrayBuffer();
        batch.push({ store, key: id, b64: b64(buf), meta: store === 'gphotos' ? { author: 'imported', at: Date.now() } : {} });
        size += buf.byteLength;
        if (batch.length >= 4 || size > 6_000_000) await flush();
      } catch (e) { fail.push(id); }
    }
  }
  await flush();
  if (opts.lock !== false) await post({ items: [], done: true });
  const res = { ...report, photosSent: done, failed: fail };
  log('끝', JSON.stringify(res));
  return res;
};
