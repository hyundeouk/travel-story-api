// 산행 기록 (스토리·내 여행 기록 공통). 골프 스코어카드처럼 글에 붙인다.
// { mountain, course, courseKm, start, summit, end, minutes, km, ascent, summitAlt, reached, level, with, review }
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, min: number, max: number, dp = 0) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  const f = 10 ** dp; return Math.round(n * f) / f;
};
const hhmm = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '');
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const LEVELS = ['쉬움', '보통', '힘듦'];

export function cleanHike(input: any) {
  if (!input || typeof input !== 'object') return null;
  const start = hhmm(input.start), summit = hhmm(input.summit), end = hhmm(input.end);
  let minutes: number | null = null;
  if (start && end) { minutes = mins(end) - mins(start); if (minutes <= 0) minutes += 1440; }
  else minutes = num(input.minutes, 1, 2880);
  const out = {
    mountain: str(input.mountain, 60),
    course: str(input.course, 100),
    start, summit, end, minutes,
    km: num(input.km, 0.1, 200, 1),
    ascent: num(input.ascent, 0, 9000),
    summitAlt: num(input.summitAlt, 0, 9000),
    reached: input.reached === true,
    level: LEVELS.includes(input.level) ? input.level : '',
    with: str(input.with, 100),
    review: str(input.review, 3000),
  };
  const has = out.course || start || summit || end || out.minutes != null || out.km != null || out.ascent != null || out.summitAlt != null || out.reached || out.level || out.with || out.review;
  return has ? out : null;
}
