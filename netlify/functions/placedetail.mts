import type { Context, Config } from '@netlify/functions';
import { guard } from '../../src/lib/auth.mts';
import { getStore } from '@netlify/blobs';
import { callGovApi, jsonResponse, corsPreflightResponse } from '../../src/lib/govApi.mts';

// 명소·맛집·행사의 상세 정보 (한국관광공사 관광정보 KorService2)
//  - detailCommon2: 개요(설명), 홈페이지, 전화
//  - detailIntro2 : 종류별 안내(이용시간, 쉬는날, 주차, 대표메뉴, 행사기간 등)
//  - detailImage2 : 사진 여러 장 (3~5장만 고른다)
// 한 번 받은 것은 저장해 두고 다시 쓴다 (하루 호출 한도 절약).
// 공공데이터 인증키는 코드에 두지 않고 Cloudflare 비밀값 TOUR_API_KEY 에서 읽는다
const FALLBACK_KEY = '';
const TOUR_BASE = 'https://apis.data.go.kr/B551011/KorService2';

const clean = (v: unknown) =>
  String(v ?? '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
const https = (v: unknown) => String(v ?? '').trim().replace(/^http:\/\//i, 'https://');
const firstHref = (v: unknown) => {
  const m = String(v ?? '').match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0].replace(/^http:\/\//i, 'https://') : '';
};

// 종류별로 보여줄 안내 항목 [필드, 이름]
const INTRO: Record<string, [string, string][]> = {
  '12': [['infocenter', '문의 및 안내'], ['usetime', '이용시간'], ['restdate', '쉬는날'], ['parking', '주차'], ['expguide', '체험 안내'], ['chkbabycarriage', '유모차'], ['chkpet', '반려동물']],
  '39': [['firstmenu', '대표 메뉴'], ['treatmenu', '취급 메뉴'], ['opentimefood', '영업시간'], ['restdatefood', '쉬는날'], ['infocenterfood', '문의 및 안내'], ['parkingfood', '주차'], ['packing', '포장'], ['reservationfood', '예약']],
  '15': [['eventstartdate', '시작일'], ['eventenddate', '종료일'], ['eventplace', '행사 장소'], ['playtime', '공연 시간'], ['usetimefestival', '이용 요금'], ['spendtimefestival', '관람 소요시간'], ['agelimit', '관람 가능 연령'], ['sponsor1', '주최'], ['sponsor1tel', '주최 연락처'], ['sponsor2', '주관']],
  '28': [['infocenterleports', '문의 및 안내'], ['usetimeleports', '이용시간'], ['restdateleports', '쉬는날'], ['usefeeleports', '이용 요금'], ['parkingleports', '주차'], ['openperiod', '개장 기간']],
  '32': [['infocenterlodging', '문의 및 안내'], ['checkintime', '입실'], ['checkouttime', '퇴실'], ['parkinglodging', '주차'], ['reservationlodging', '예약 안내']],
  '14': [['usetimeculture', '이용시간'], ['restdateculture', '쉬는날'], ['usefee', '이용 요금'], ['parkingculture', '주차'], ['infocenterculture', '문의 및 안내']],
};
async function sha1(text: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  if (!Number.isFinite(bLat) || !Number.isFinite(bLng)) return Infinity;
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * t) / 2) ** 2 + Math.cos(aLat * t) * Math.cos(bLat * t) * Math.sin(((bLng - aLng) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// 관광공사 사진 저작권 구분: Type1 = 공공누리 제1유형(출처표시), Type3 = 제3유형(출처표시+변경금지)
function tourCredit(code: unknown) {
  const m = String(code ?? '').match(/Type\s*(\d)/i);
  return '한국관광공사' + (m ? ` · 공공누리 제${m[1]}유형` : '');
}
const dateFmt = (v: string) => (/^\d{8}$/.test(v) ? `${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6, 8)}` : v);

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;

  try {
    const q = new URL(req.url).searchParams;
    let id = q.get('id') || '';
    let type = q.get('type') || '';
    const debug = q.get('debug') === '1';
    const store = getStore('cache');
    const key = Netlify.env.get('TOUR_API_KEY') || FALLBACK_KEY;
    let matched = '';
    // 이름(+좌표)만 아는 장소(자연휴양림·명산 등): 관광공사 자료에서 같은 곳을 찾아 사진·소개를 빌려 온다.
    const name = (q.get('q') || '').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!id && name.length >= 2) {
      const lat = Number(q.get('lat')), lng = Number(q.get('lng'));
      const hasLL = Number.isFinite(lat) && Number.isFinite(lng) && lat > 32 && lng > 124;
      const radius = Math.min(Math.max(Number(q.get('r')) || 3, 0.5), 8);
      // pdq2: 이름 꼴을 바꿔 가며 찾는다 (예: 산림청 "청태산휴양림" ↔ 관광공사 "국립 청태산자연휴양림")
      const qKey = `pdq2-${await sha1(name + '|' + (hasLL ? lat.toFixed(3) + ',' + lng.toFixed(3) : '') + '|' + radius)}`;
      let found: any = debug ? null : await store.get(qKey, { type: 'json' });
      if (!found) {
        const norm = (t: string) => String(t || '').replace(/\(.*?\)|\s+/g, '');
        const isForest = /(휴양림|산림욕장|휴양마을)$/.test(name.replace(/\s+/g, ''));
        const core = name.replace(/^국립\s*/, '').replace(/\s+/g, '').replace(/(자연)?휴양림$|산림욕장$|휴양마을$/, '');
        const keywords = Array.from(new Set([name, ...(isForest && core.length >= 2 ? [core + '자연휴양림', core] : [])]));
        let best: any = null, anyOk = false;
        for (const kw of keywords) {
          const r = await callGovApi(TOUR_BASE, 'searchKeyword2', key, { keyword: kw, numOfRows: 30, arrange: 'A' });
          if (r.ok || r.items.length) anyOk = true;
          let b: any = null, bestD = Infinity;
          for (const it of r.items) {
            if (!['12', '14', '28', '32'].includes(String(it.contenttypeid))) continue;
            // 짧은 이름(core)으로 찾았을 때는 휴양림·산림욕장인 것만 (같은 이름의 캠핑장·레포츠파크 등은 제외)
            if (kw === core && !/(휴양림|산림욕장|휴양마을|숲)/.test(String(it.title))) continue;
            if (hasLL) {
              const d = km(lat, lng, Number(it.mapy), Number(it.mapx));
              if (d <= radius && d < bestD) { b = it; bestD = d; }
            } else if (norm(it.title) === norm(name)) { b = it; break; }
          }
          if (b && (!best || (!best.firstimage && b.firstimage))) best = b;
          if (best && best.firstimage) break;
        }
        found = best ? { id: String(best.contentid), type: String(best.contenttypeid), title: clean(best.title), image: https(best.firstimage) } : { none: true };
        if (!debug && anyOk) await store.setJSON(qKey, found);
      }
      if (found.none) return jsonResponse({ none: true, info: [], images: [] });
      // 카드용 가벼운 요청: 찾은 곳의 대표 사진만 돌려준다 (관광공사 호출을 아끼기 위해)
      if (q.get('lite') === '1') return jsonResponse({ matched: found.title || '', image: found.image || '' });
      id = found.id; type = found.type; matched = found.title || '';
    }
    if (!/^\d{1,12}$/.test(id) || !/^\d{2}$/.test(type)) return jsonResponse({ error: 'bad request' }, { status: 400 });
    const cKey = `pd2-${type}-${id}`;
    if (!debug) {
      const hit: any = await store.get(cKey, { type: 'json' });
      if (hit) return jsonResponse({ ...hit, matched, cached: true });
    }
    const [common, intro, image] = await Promise.all([
      callGovApi(TOUR_BASE, 'detailCommon2', key, { contentId: id }),
      callGovApi(TOUR_BASE, 'detailIntro2', key, { contentId: id, contentTypeId: type }),
      callGovApi(TOUR_BASE, 'detailImage2', key, { contentId: id, imageYN: 'Y' }),
    ]);
    const c: any = common.items[0] || {};
    const it: any = intro.items[0] || {};
    const info: [string, string][] = [];
    for (const [field, label] of INTRO[type] || []) {
      let v = clean(it[field]);
      if (!v) continue;
      if (field === 'eventstartdate' || field === 'eventenddate') v = dateFmt(v);
      info.push([label, v]);
    }
    const seen = new Set<string>();
    const images = image.items
      .map((x: any) => ({ url: https(x.originimgurl || x.smallimageurl), desc: clean(x.imgname), credit: tourCredit(x.cpyrhtDivCd) }))
      .filter((x: any) => /^https:\/\//.test(x.url) && !seen.has(x.url) && seen.add(x.url))
      .slice(0, 5);
    const firstimage = https(c.firstimage);
    if (firstimage && !seen.has(firstimage)) images.unshift({ url: firstimage, desc: '', credit: tourCredit(c.cpyrhtDivCd) });
    const out: any = {
      title: clean(c.title),
      overview: clean(c.overview),
      homepage: firstHref(c.homepage),
      tel: clean(c.tel),
      address: [clean(c.addr1), clean(c.addr2)].filter(Boolean).join(' '),
      info,
      images: images.slice(0, 5),
    };
    if (matched) out.matched = matched;
    const ok = common.ok || intro.ok || image.ok;
    if (debug) out.debug = { common: [common.resultCode, common.resultMsg, Object.keys(c)], intro: [intro.resultCode, Object.keys(it)], image: [image.resultCode, image.items.length] };
    else if (ok) await store.setJSON(cKey, out);
    return jsonResponse(out);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'unknown error' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/placedetail',
};
