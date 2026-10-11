/* xml2js 대신(Cloudflare Workers 에서는 Node 전용 모듈이 무거워서) fast-xml-parser 로 같은 모양을 만든다.
   원래 옵션: { explicitArray:false, ignoreAttrs:true, trim:true } → 반복 태그는 배열, 한 번이면 값, 글자만 있으면 문자열. */
import { XMLParser } from 'fast-xml-parser';
const parser = new XMLParser({ ignoreAttributes: true, trimValues: true, parseTagValue: false, ignoreDeclaration: true, ignorePiTags: true });
function fix(v: any): any {
  if (Array.isArray(v)) return v.map(fix);
  if (v && typeof v === 'object') { const o: any = {}; for (const k in v) o[k] = fix(v[k]); return o; }
  if (v === undefined || v === null) return '';
  return typeof v === 'string' ? v : String(v);
}
export async function parseStringPromise(text: string, _opts?: any) { return fix(parser.parse(String(text))); }
export default { parseStringPromise };
