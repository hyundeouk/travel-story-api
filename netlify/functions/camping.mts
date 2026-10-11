import type { Context, Config } from '@netlify/functions';
import { guard, viewerShare } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { callGovApi, jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 캠핑 탭: 한국관광공사 고캠핑 정보 조회서비스(GoCamping) — 전국 캠핑장 목록·사진.
//   GET /api/camping              전국 캠핑장 목록(카드·지도용으로 줄인 항목). 하루에 한 번 고캠핑에서 새로 받아 저장해 둔다.
//   GET /api/camping?id=1234&k=2  캠핑장 하나의 전체 항목 (k = 목록에 같이 준 묶음 번호)
//   GET /api/camping?img=1234     그 캠핑장 사진 주소 목록 (7일 저장)
// 공공데이터 인증키는 TOUR_API_KEY(관광공사와 같은 키, 고캠핑은 공공데이터포털에서 따로 활용신청).
const FALLBACK_KEY = '';
const BASE = 'https://apis.data.go.kr/B551011/GoCamping';
const TTL_MS = 24 * 60 * 60 * 1000;
const PAGE = 300;          // 고캠핑에 한 번에 묻는 수
const FULL_CHUNK = 300;    // 전체 항목 저장 묶음 (저장 칸 하나가 너무 커지지 않게)
const LIST_CHUNK = 1200;   // 줄인 목록 저장 묶음
const store = () => getStore('cache');

const https = (u: unknown) => { const s = String(u || '').trim(); return /^http:\/\//i.test(s) ? 'https://' + s.slice(7) : s; };
const str = (v: unknown, n = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const SIDO: Record<string, string> = { 서울시: '서울', 서울특별시: '서울', 부산시: '부산', 부산광역시: '부산', 대구시: '대구', 대구광역시: '대구', 인천시: '인천', 인천광역시: '인천', 광주시: '광주', 광주광역시: '광주', 대전시: '대전', 대전광역시: '대전', 울산시: '울산', 울산광역시: '울산', 세종시: '세종', 세종특별자치시: '세종', 경기도: '경기', 강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남', 전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주도: '제주', 제주특별자치도: '제주' };
const sido = (v: unknown) => { const s = str(v, 20); return SIDO[s] || s.slice(0, 2); };

// 저장해 둘 항목 (상세 화면에 쓰는 것만)
const KEEP = ['contentId', 'facltNm', 'lineIntro', 'intro', 'featureNm', 'induty', 'lctCl', 'doNm', 'sigunguNm', 'addr1', 'addr2', 'mapX', 'mapY', 'direction', 'tel', 'homepage', 'resveUrl', 'resveCl',
  'facltDivNm', 'mangeDivNm', 'manageSttus', 'hvofBgnde', 'hvofEnddle', 'operPdCl', 'operDeCl', 'gnrlSiteCo', 'autoSiteCo', 'glampSiteCo', 'caravSiteCo', 'indvdlCaravSiteCo',
  'siteBottomCl1', 'siteBottomCl2', 'siteBottomCl3', 'siteBottomCl4', 'siteBottomCl5', 'glampInnerFclty', 'caravInnerFclty', 'trlerAcmpnyAt', 'caravAcmpnyAt',
  'toiletCo', 'swrmCo', 'wtrplCo', 'brazierCl', 'sbrsCl', 'sbrsEtc', 'posblFcltyCl', 'posblFcltyEtc', 'exprnProgrm', 'clturEvent', 'themaEnvrnCl', 'eqpmnLendCl', 'animalCmgCl', 'tourEraCl', 'firstImageUrl', 'modifiedtime'];
function trimFull(it: any) {
  const o: any = {};
  for (const k of KEEP) {
    const v = it?.[k];
    if (v === undefined || v === null || v === '') continue;
    o[k] = k === 'intro' ? str(v, 1200) : k === 'firstImageUrl' ? https(v) : typeof v === 'string' ? str(v, 400) : v;
  }
  return o;
}
function compact(it: any, k: number) {
  const y = Number(it.mapY), x = Number(it.mapX);
  if (!(y > 32 && y < 39.5 && x > 124 && x < 132)) return null;
  const o: any = {
    id: String(it.contentId), k, n: str(it.facltNm, 60), t: str(it.induty, 60), s: sido(it.doNm), g: str(it.sigunguNm, 20),
    a: str(it.addr1, 120), y: Math.round(y * 1e5) / 1e5, x: Math.round(x * 1e5) / 1e5, p: str(it.tel, 30), w: str(it.homepage, 200), rv: str(it.resveUrl, 200),
    img: https(it.firstImageUrl), li: str(it.lineIntro, 80), an: str(it.animalCmgCl, 20), st: str(it.manageSttus, 10), lc: str(it.lctCl, 40), th: str(it.themaEnvrnCl, 60),
  };
  for (const key of Object.keys(o)) if (o[key] === '') delete o[key];
  return o;
}

async function refresh(key: string) {
  const first = await callGovApi(BASE, 'basedList', key, { numOfRows: PAGE, pageNo: 1 });
  if (!first.ok && !first.items.length) throw new Error(first.resultMsg || first.resultCode || 'gocamping failed');
  const total = Number(first.raw?.response?.body?.totalCount) || first.items.length;
  const pages = Math.min(20, Math.ceil(total / PAGE));
  let all = first.items.slice();
  const rest: Promise<any>[] = [];
  for (let p = 2; p <= pages; p++) rest.push(callGovApi(BASE, 'basedList', key, { numOfRows: PAGE, pageNo: p }));
  for (const r of await Promise.all(rest)) all = all.concat(r.items || []);
  const full = all.map(trimFull).filter((o) => o.contentId);
  const s = store();
  const nFull = Math.ceil(full.length / FULL_CHUNK);
  const list: any[] = [];
  for (let i = 0; i < nFull; i++) {
    const part = full.slice(i * FULL_CHUNK, (i + 1) * FULL_CHUNK);
    await s.setJSON('gocamp-full-' + i, part);
    part.forEach((it) => { const c = compact(it, i); if (c) list.push(c); });
  }
  const nList = Math.ceil(list.length / LIST_CHUNK);
  for (let i = 0; i < nList; i++) await s.setJSON('gocamp-list-' + i, list.slice(i * LIST_CHUNK, (i + 1) * LIST_CHUNK));
  const meta = { at: Date.now(), total: list.length, nFull, nList };
  await s.setJSON('gocamp-meta', meta);
  return { meta, list };
}

async function readList(meta: any) {
  const s = store();
  let list: any[] = [];
  for (let i = 0; i < (meta.nList || 0); i++) list = list.concat(((await s.get('gocamp-list-' + i, { type: 'json' })) as any[]) || []);
  return list;
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const share = await viewerShare(req);
  if (share && share.tabs && (share.tabs as any).camp === false) return jsonResponse({ items: [], hidden: true });

  const q = new URL(req.url).searchParams;
  const key = Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
  const s = store();
  try {
    // 사진 목록
    const img = q.get('img');
    if (img) {
      if (!/^\d{1,12}$/.test(img)) return jsonResponse({ error: 'bad id' }, { status: 400 });
      const ck = 'gocamp-img-' + img;
      const hit: any = await s.get(ck, { type: 'json' });
      if (hit && Date.now() - (hit.at || 0) < 7 * TTL_MS) return jsonResponse(hit);
      const r = await callGovApi(BASE, 'imageList', key, { contentId: img, numOfRows: 30 });
      const out = { at: Date.now(), images: (r.items || []).map((x: any) => https(x.imageUrl)).filter((u: string) => /^https:\/\//.test(u)).slice(0, 30) };
      if (r.ok || out.images.length) await s.setJSON(ck, out);
      return jsonResponse(out);
    }
    let meta: any = await s.get('gocamp-meta', { type: 'json' });
    // 캠핑장 하나
    const id = q.get('id');
    if (id) {
      const k = Number(q.get('k'));
      if (!meta || !(k >= 0 && k < (meta.nFull || 0))) return jsonResponse({ error: 'not found' }, { status: 404 });
      const part = ((await s.get('gocamp-full-' + k, { type: 'json' })) as any[]) || [];
      const it = part.find((x) => String(x.contentId) === id);
      return it ? jsonResponse({ item: it }) : jsonResponse({ error: 'not found' }, { status: 404 });
    }
    // 전체 목록
    if (meta && Date.now() - (meta.at || 0) < TTL_MS) return jsonResponse({ items: await readList(meta), at: meta.at, cached: true });
    try {
      const r = await refresh(key);
      return jsonResponse({ items: r.list, at: r.meta.at });
    } catch (e: any) {
      // 고캠핑이 안 될 때는 예전에 받아 둔 목록이라도 준다
      if (meta) return jsonResponse({ items: await readList(meta), at: meta.at, stale: true });
      return jsonResponse({ items: [], error: String(e?.message || e).slice(0, 120) }, { status: 502 });
    }
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/camping',
};
