// 산림청 자료(숲나들e 관련)를 앱에서 쓰는 모양으로 바꾸는 곳.
//  - 자연휴양림: 공공데이터포털 "전국휴양림표준데이터" 오픈 API (tn_pubr_public_rcrfrst_api)
//  - 숲길: 공공데이터포털 파일데이터의 자동 변환 오픈 API (api.odcloud.kr)
//      · 숲나들e 숲길 100대명산 정보 (15112801)
//      · 숲나들e 숲길정보(예약 가능한 숲길) (15113562)
// 세 가지 모두 공공데이터포털에서 같은 인증키로 "활용신청"을 해야 쓸 수 있다.

export const RECREATION_API = 'https://api.data.go.kr/openapi/tn_pubr_public_rcrfrst_api';
export const MOUNTAIN_API = 'https://api.odcloud.kr/api/15112801/v1/uddi:72bf80fc-1a93-4193-a6db-8a547d7c3333';
export const FORESTTRAIL_API = 'https://api.odcloud.kr/api/15113562/v1/uddi:64947ca3-c1c9-4e0e-a83d-8a7b813ba1bd';

export const DATASETS = {
  recreation: { name: '전국휴양림표준데이터', page: 'https://www.data.go.kr/data/15013111/standard.do' },
  mountain: { name: '산림청 국립자연휴양림관리소_숲나들e 숲길 100대명산 정보', page: 'https://www.data.go.kr/data/15112801/fileData.do' },
  foresttrail: { name: '산림청 국립자연휴양림관리소_숲나들e 숲길정보', page: 'https://www.data.go.kr/data/15113562/fileData.do' },
};

const SIDO_SHORT: Record<string, string> = {
  서울특별시: '서울', 서울시: '서울', 서울: '서울', 부산광역시: '부산', 부산: '부산', 대구광역시: '대구', 대구: '대구',
  인천광역시: '인천', 인천: '인천', 광주광역시: '광주', 광주: '광주', 대전광역시: '대전', 대전: '대전',
  울산광역시: '울산', 울산: '울산', 세종특별자치시: '세종', 세종: '세종', 경기도: '경기', 경기: '경기',
  강원도: '강원', 강원특별자치도: '강원', 강원: '강원', 충청북도: '충북', 충북: '충북', 충청남도: '충남', 충남: '충남',
  전라북도: '전북', 전북특별자치도: '전북', 전북: '전북', 전라남도: '전남', 전남: '전남', 전남광주통합특별시: '전남',
  경상북도: '경북', 경북: '경북', 경상남도: '경남', 경남: '경남', 제주도: '제주', 제주특별자치도: '제주', 제주: '제주',
};
export function sidoShort(text: unknown): string {
  const words = String(text ?? '').replace(/[,·ㆍ()]/g, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) if (SIDO_SHORT[w]) return SIDO_SHORT[w];
  return '';
}
// 글 속에서 처음 나오는 시·도 이름 (주소가 따로 없는 숲길용)
const CITY_SIDO: Record<string, string> = { 서귀포: '제주', 제주시: '제주', 한라산: '제주' };
export function sidoInText(text: unknown): string {
  const t = String(text ?? '');
  for (const [k, v] of Object.entries(CITY_SIDO)) if (t.includes(k) && !Object.keys(SIDO_SHORT).some((s) => s.length > 1 && t.indexOf(s) >= 0 && t.indexOf(s) < t.indexOf(k))) return v;
  let best = '';
  let at = Infinity;
  for (const [k, v] of Object.entries(SIDO_SHORT)) {
    if (k.length < 2) continue;
    const i = t.indexOf(k);
    if (i >= 0 && (i < at || (i === at && k.length > best.length))) { at = i; best = v; }
  }
  return best;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
// HTML이 섞인 글을 읽기 좋은 일반 글로 바꾼다. (엔티티가 두 번 감싸진 경우도 있음)
export function plain(v: unknown): string {
  let s = String(v ?? '');
  for (let k = 0; k < 2 && /&(#\d+|[a-z]+);/i.test(s); k++) s = decodeEntities(s);
  if (/<table/i.test(s)) s = s.replace(/<br\s*\/?>/gi, ' ').replace(/<thead[\s\S]*?<\/thead>/gi, '');
  s = s
    .replace(/<caption[\s\S]*?<\/caption>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|p|div|li|h\d)>/gi, '\n')
    .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s === '미입력' || s === '-' ? '' : s;
}
const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null;
};
function httpsUrl(v: unknown): string {
  let s = String(v ?? '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  s = s.replace(/^http:\/\//i, 'https://');
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : '';
}
function inKorea(lat: number | null, lng: number | null) {
  return lat != null && lng != null && lat > 32.8 && lat < 38.9 && lng > 124 && lng < 132.2;
}
// 키 앞뒤 공백·BOM을 없애서 같은 이름으로 찾을 수 있게 한다.
function normKeys(row: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row || {})) out[k.replace(/^﻿/, '').trim()] = v;
  return out;
}
function shortHash(text: string): string {
  // 짧은 고정 id (FNV-1a)
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

// ---------- 자연휴양림 ----------
export interface Recreation {
  id: string; name: string; sido: string; kind: string; area: number | null; capacity: number | null;
  fee: string; stay: boolean | null; facilities: string; address: string; org: string; tel: string;
  homepage: string; lat: number | null; lng: number | null; refDate: string;
}
export function mapRecreation(raw: any): Recreation | null {
  const r = normKeys(raw);
  const pick = (...keys: string[]) => { for (const k of keys) if (r[k] != null && String(r[k]).trim() !== '') return String(r[k]).trim(); return ''; };
  const name = pick('rcrfrstNm', '휴양림명');
  if (!name) return null;
  const lat = num(pick('latitude', '위도'));
  const lng = num(pick('longitude', '경도'));
  const address = pick('rdnmadr', '소재지도로명주소', 'lnmadr');
  const sidoRaw = pick('ctprvnNm', '시도명');
  const stayRaw = pick('stayngPosblYn', 'stayngPosblAt', '숙박가능여부').toUpperCase();
  const fee = pick('admfee', 'entrncfeeInfo', '입장료');
  return {
    id: shortHash(name.replace(/\s+/g, '') + '|' + (lat ?? '').toString().slice(0, 6) + '|' + (lng ?? '').toString().slice(0, 7)),
    name,
    sido: sidoShort(sidoRaw) || sidoShort(address) || sidoRaw,
    kind: pick('rcrfrstType', 'rcrfrstSe', '휴양림구분'),
    area: num(pick('rcrfrstAr', '휴양림면적')),
    capacity: num(pick('aceptncCo', '수용인원수')),
    fee: fee === '0' ? '무료' : fee,
    stay: stayRaw === 'Y' ? true : stayRaw === 'N' ? false : null,
    facilities: pick('mainFcltyNm', '주요시설명').replace(/\s*\+\s*/g, ', '),
    address,
    org: pick('institutionNm', '관리기관명'),
    tel: pick('telephoneNumber', 'phoneNumber', '휴양림전화번호'),
    homepage: httpsUrl(pick('homepageUrl', '홈페이지주소')),
    lat: inKorea(lat, lng) ? lat : null,
    lng: inKorea(lat, lng) ? lng : null,
    refDate: pick('referenceDate', '데이터기준일자'),
  };
}
// 같은 휴양림이 여러 기관 자료로 겹쳐 올라온 경우 하나만 남긴다 (이름+가까운 위치 기준, 더 최근·더 자세한 것 우선).
export function dedupeRecreation(list: Recreation[]): Recreation[] {
  const score = (r: Recreation) => [r.tel, r.homepage, r.facilities, r.fee, r.capacity, r.address].filter((x) => x != null && x !== '').length;
  const keyOf = (r: Recreation) => r.name.replace(/\(.*?\)|\s+|자연휴양림|휴양림/g, '') + '|' + (r.lat != null ? r.lat.toFixed(2) + ',' + r.lng!.toFixed(2) : r.address);
  const best = new Map<string, Recreation>();
  for (const r of list) {
    const k = keyOf(r);
    const cur = best.get(k);
    if (!cur || r.refDate > cur.refDate || (r.refDate === cur.refDate && score(r) > score(cur))) best.set(k, r);
  }
  return Array.from(best.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

// ---------- 숲길: 100대 명산 ----------
export interface Mountain {
  id: string; type: 'mountain'; name: string; address: string; sido: string; height: string; difficulty: string;
  feature: string; overview: string; points: string; course: string; transport: string; lat: number | null; lng: number | null;
}
export function mapMountain(raw: any): Mountain | null {
  const r = normKeys(raw);
  const name = plain(r['명산_이름']);
  if (!name) return null;
  let lat = num(r['Y좌표']);
  let lng = num(r['X좌표']);
  if (lat != null && lng != null && lat > 100 && lng < 50) [lat, lng] = [lng, lat];
  const address = plain(r['명산_소재지']);
  const diff = plain(r['난이도']).replace(/(산행시간|산높이|난이도)\s*:/g, '\n$1:').replace(/^\n/, '').replace(/[:]\s*-\s*$/m, ': -');
  return {
    id: 'm' + shortHash(name + '|' + address),
    type: 'mountain',
    name,
    address,
    sido: sidoShort(address) || sidoInText(address),
    height: plain(r['명산_높이']),
    difficulty: diff.split('\n').map((l) => l.trim()).filter((l) => l && !/:\s*-$/.test(l)).join('\n'),
    feature: plain(r['특징_및_선정_이유']),
    overview: plain(r['산_개요']),
    points: plain(r['산행포인트']),
    course: plain(r['산행코스']).split('\n').filter((l) => !/^구분\s*·/.test(l.trim())).join('\n'),
    transport: plain(r['교통정보']),
    lat: inKorea(lat, lng) ? lat : null,
    lng: inKorea(lat, lng) ? lng : null,
  };
}

// ---------- 숲길: 숲나들e에서 예약하는 숲길 (같은 숲길의 시간대·구간 상품을 하나로 묶음) ----------
// 자료에 위치가 비어 있는 숲길의 대표 주소 (안내센터·탐방로 입구 기준)
const TRAIL_ADDRESS: Record<string, string> = {
  'DMZ펀치볼둘레길': '강원특별자치도 양구군 해안면',
  '홍릉숲 탐방': '서울특별시 동대문구 회기로 57',
  '점봉산 곰배령 산림생태탐방': '강원특별자치도 인제군 기린면 진동리',
  '백두대간트레일': '강원특별자치도 인제군 기린면 내린천로 4096-3',
  '울진금강소나무숲길': '경상북도 울진군 근남면 울진북로 245-5',
  '한남시험림탐방': '제주특별자치도 서귀포시 남원읍 서성로651번길 235',
};
export interface ForestTrail {
  id: string; type: 'foresttrail'; name: string; sido: string; address: string; spot: string; transport: string; stay: string;
  dailyLimit: number | null; courses: { name: string; level: string; way: string; time: string; km: number | null; from: string; to: string }[];
}
export function groupForestTrails(rows: any[]): ForestTrail[] {
  const map = new Map<string, ForestTrail>();
  for (const raw of rows) {
    const r = normKeys(raw);
    const name = plain(r['휴양림명']);
    if (!name) continue;
    const gid = String(r['휴양림아이디'] || name);
    let t = map.get(gid);
    if (!t) {
      t = { id: 'f' + shortHash(gid), type: 'foresttrail', name, sido: '', address: TRAIL_ADDRESS[name] || '', spot: '', transport: '', stay: '', dailyLimit: null, courses: [] };
      map.set(gid, t);
    }
    const longer = (a: string, b: string) => (b.length > a.length ? b : a);
    t.spot = longer(t.spot, plain(r['관리지점설명']));
    t.transport = longer(t.transport, plain(r['교통편설명']));
    t.stay = longer(t.stay, plain(r['숙박정보설명']));
    const lim = num(r['일일예약가능건수']);
    if (lim != null) t.dailyLimit = Math.max(t.dailyLimit ?? 0, lim);
    const h = num(r['산_소요시간']) || 0;
    const m = num(r['소요시간_분']) || 0;
    const course = {
      name: plain(r['상품명']),
      level: plain(r['숲길구간난이도']),
      way: plain(r['거리구간구분']),
      time: h || m ? (h ? h + '시간' : '') + (m ? (h ? ' ' : '') + m + '분' : '') : '',
      km: num(r['숲길구간길이']),
      from: plain(r['구간_시점명']),
      to: plain(r['구간_종점명']),
    };
    const same = t.courses.find((c) => c.name === course.name && c.from === course.from && c.to === course.to);
    if (!same && course.name) t.courses.push(course);
  }
  const out = Array.from(map.values());
  for (const t of out) t.sido = sidoShort(t.address) || sidoInText(t.spot) || sidoInText(t.transport) || sidoInText(t.name);
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
