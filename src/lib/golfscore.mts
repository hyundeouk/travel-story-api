// 골프 라운드 스코어카드 (스토리·내 여행 기록 공통).
// { course, courseKey, front, back, holes: [{ par, strokes, putts }] (9 또는 18), review }
// 합계는 화면에서 계산하지만, 목록에서 바로 쓰도록 total·par·putts도 함께 저장한다.
const int = (v: unknown, min: number, max: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function cleanGolf(input: any) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.holes)) return null;
  const n = input.holes.length >= 18 ? 18 : 9;
  const holes = Array.from({ length: n }, (_, i) => {
    const h = input.holes[i] || {};
    return { par: int(h.par, 3, 6) ?? 4, strokes: int(h.strokes, 1, 20), putts: int(h.putts, 0, 10) };
  });
  const played = holes.filter((h) => h.strokes != null);
  const review = str(input.review, 3000);
  if (!played.length && !review) return null;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return {
    course: str(input.course, 100),
    courseKey: typeof input.courseKey === 'string' && /^g:[0-9a-f]{12}$/.test(input.courseKey) ? input.courseKey : null,
    front: str(input.front, 20),
    back: n === 18 ? str(input.back, 20) : '',
    holes,
    total: played.length ? sum(played.map((h) => h.strokes as number)) : null,
    par: played.length ? sum(played.map((h) => h.par)) : null, // 친 홀의 파 합계 (오버/언더 계산용)
    putts: holes.some((h) => h.putts != null) ? sum(holes.map((h) => h.putts || 0)) : null,
    played: played.length,
    review,
  };
}
