/**
 * 국가유산청 국가유산 Open API (인증키 불필요, XML 전용).
 *  - 목록: /cha/SearchKindOpenapiList.do?pageUnit=&pageIndex=&ccbaKdcd=(종목)&ccbaCtcd=(시도)
 *  - 상세: /cha/SearchKindOpenapiDt.do?ccbaKdcd=&ccbaAsno=&ccbaCtcd=
 * 주의: 응답 필드명은 작업 환경에서 직접 호출해 확인하지 못했음(접속 차단).
 *       그래서 필드가 예상과 달라도 원인을 볼 수 있게 debug 옵션으로 원본 키를 돌려준다.
 */
import { parseStringPromise } from 'xml2js';

const BASES = ['https://www.khs.go.kr/cha', 'http://www.khs.go.kr/cha'];
export const PAGE_UNIT = 100;

// 종목코드
export const KINDS: Record<string, string> = { '11': '국보', '12': '보물', '13': '사적', '15': '명승', '16': '천연기념물' };

// 관광공사(TourAPI) 지역코드 → 국가유산청 시도코드
const AREA_TO_CTCD: Record<string, string> = {
  '1': '11', '2': '23', '3': '25', '4': '22', '5': '24', '6': '21', '7': '26', '8': '45',
  '31': '31', '32': '32', '33': '33', '34': '34', '35': '37', '36': '38', '37': '35', '38': '36', '39': '50',
};

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const coord = (v: unknown) => {
  const n = Number(text(v));
  return Number.isFinite(n) && n !== 0 ? n : null;
};
const toArray = (v: any) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);
const httpsUrl = (v: unknown) => text(v).replace(/^http:\/\//i, 'https://');
const cleanBody = (v: unknown) =>
  text(v).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

async function getXml(path: string, params: Record<string, string>): Promise<any> {
  let lastErr: unknown;
  for (const base of BASES) {
    try {
      const url = new URL(`${base}/${path}`);
      for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`heritage api http ${res.status}`);
      const body = await res.text();
      const data = await parseStringPromise(body, { explicitArray: false, ignoreAttrs: true, trim: true });
      if (!data?.result) throw new Error('heritage api: unexpected response');
      return data.result;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function mapListItem(it: any, kindFallback = '') {
  return {
    id: [text(it.ccbaKdcd), text(it.ccbaAsno), text(it.ccbaCtcd)].join('-'),
    kdcd: text(it.ccbaKdcd),
    asno: text(it.ccbaAsno),
    ctcd: text(it.ccbaCtcd),
    name: text(it.ccbaMnm1),
    hanja: text(it.ccbaMnm2),
    kindName: text(it.ccmaName) || kindFallback,
    sido: text(it.ccbaCtcdNm),
    sigungu: text(it.ccsiName),
    admin: text(it.ccbaAdmin),
    lat: coord(it.latitude),
    lng: coord(it.longitude),
  };
}

// 이름으로 찾기 (전국, 모든 종목, 지정 해제 제외)
export async function searchHeritage(q: string, max = 30) {
  const result = await getXml('SearchKindOpenapiList.do', { pageUnit: String(max), pageIndex: '1', ccbaMnm1: q, ccbaCncl: 'N' });
  return toArray(result.item).map((it: any) => mapListItem(it)).filter((it: any) => it.name);
}

export async function fetchHeritageList(opts: { kind?: string; areaCode?: string; page?: number; debug?: boolean }) {
  const kind = KINDS[opts.kind || ''] ? (opts.kind as string) : '11';
  const page = Math.max(1, Math.floor(opts.page || 1));
  const result = await getXml('SearchKindOpenapiList.do', {
    pageUnit: String(PAGE_UNIT),
    pageIndex: String(page),
    ccbaKdcd: kind,
    ccbaCtcd: AREA_TO_CTCD[opts.areaCode || ''] || '',
    ccbaCncl: 'N', // 지정 해제된 것은 제외
  });
  const rawItems = toArray(result.item);
  const items = rawItems.map((it: any) => mapListItem(it, KINDS[kind])).filter((it: any) => it.name);
  const total = Number(text(result.totalCnt)) || items.length;
  const out: any = { items, total, page, pageUnit: PAGE_UNIT, kind, kindName: KINDS[kind] };
  if (opts.debug) out.debug = { resultKeys: Object.keys(result), rawCount: rawItems.length, firstRaw: rawItems[0] || null };
  return out;
}

// 사진 설명(캡션)으로 "대상 전체가 보이는 사진"을 고른다.
// 부분·세부를 찍은 사진(기단부, 상륜부, 탑신, 문양, 올려다 본 모습 등)은 뒤로 미룬다.
const WHOLE_RE = /(전경|전체|원경|정면|측면|모습|외관|항공|드론|국립문화유산연구원|풍경|경관)/;
const PART_RE = /(기단|상륜|탑신|옥개|팔부|중상|사천왕|세부|부분|문양|올려|내려다|명문|현판|글씨|도면|실측|탁본|확대|근경|조각|감실|내부|천장|기와|단청|장식|부재|초석|평면|배치도)/;

const NURI: Record<string, string> = { A: '공공누리 제1유형', B: '공공누리 제2유형', C: '공공누리 제3유형', D: '공공누리 제4유형', E: '공공누리 제0유형' };
function nuriLabel(code: string) {
  const first = String(code || '').split('/')[0].trim().toUpperCase();
  return NURI[first] || '';
}
function pickWholePhotos(list: { url: string; desc: string; credit?: string }[], max = 5) {
  const seen = new Set<string>();
  const uniq = list.filter((p) => p.url && !seen.has(p.url) && seen.add(p.url));
  const scored = uniq.map((p, i) => {
    let score = 0;
    if (WHOLE_RE.test(p.desc)) score += 3;
    if (PART_RE.test(p.desc)) score -= 5;
    return { ...p, score, i };
  });
  const good = scored.filter((p) => p.score >= 0).sort((a, b) => b.score - a.score || a.i - b.i);
  return good.slice(0, max).map(({ url, desc, credit }) => ({ url, desc, credit: credit || '국가유산청' }));
}

// 국가유산 사진 목록: /cha/SearchImageOpenapi.do — 한 item 안에 imageUrl·ccimDesc가 여러 번 나올 수 있다.
async function fetchHeritageImages(opts: { kdcd: string; asno: string; ctcd: string }) {
  try {
    const result = await getXml('SearchImageOpenapi.do', { ccbaKdcd: opts.kdcd, ccbaAsno: opts.asno, ccbaCtcd: opts.ctcd });
    const out: { url: string; desc: string; credit: string }[] = [];
    for (const it of toArray(result.item)) {
      const urls = toArray(it.imageUrl).map(httpsUrl);
      const descs = toArray(it.ccimDesc).map(text);
      const nuris = toArray(it.imageNuri).map(text);
      urls.forEach((u: string, i: number) => {
        const lic = nuriLabel(nuris[i] || '');
        if (/^https:\/\//.test(u)) out.push({ url: u, desc: descs[i] || '', credit: '국가유산청' + (lic ? ' · ' + lic : '') });
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchHeritageDetail(opts: { kdcd: string; asno: string; ctcd: string; debug?: boolean }) {
  const [result, imgs] = await Promise.all([
    getXml('SearchKindOpenapiDt.do', { ccbaKdcd: opts.kdcd, ccbaAsno: opts.asno, ccbaCtcd: opts.ctcd }),
    fetchHeritageImages(opts),
  ]);
  const it = toArray(result.item)[0] || {};
  const asdt = text(it.ccbaAsdt);
  const mainImage = httpsUrl(it.imageUrl) || null;
  const classes = [it.gcodeName, it.bcodeName, it.mcodeName, it.scodeName].map(text).filter(Boolean);
  const images = pickWholePhotos(imgs, 5);
  if (!images.length && mainImage) images.push({ url: mainImage, desc: '', credit: '국가유산청' });
  const out: any = {
    name: text(it.ccbaMnm1),
    hanja: text(it.ccbaMnm2),
    kindName: text(it.ccmaName),
    classification: classes.join(' / '),
    address: text(it.ccbaLcad),
    era: text(it.ccceName),
    designatedAt: /^\d{8}$/.test(asdt) ? `${asdt.slice(0, 4)}.${asdt.slice(4, 6)}.${asdt.slice(6, 8)}` : asdt,
    quantity: text(it.ccbaQuan),
    owner: text(it.ccbaPoss),
    admin: text(it.ccbaAdmin),
    image: images[0]?.url || mainImage,
    images,
    content: cleanBody(it.content),
    lat: coord(result.latitude),
    lng: coord(result.longitude),
  };
  if (opts.debug) out.debug = { resultKeys: Object.keys(result), itemKeys: Object.keys(it), imageCount: imgs.length, imageSample: imgs.slice(0, 8) };
  return out;
}
