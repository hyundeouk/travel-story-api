// 여행 스토리 — Cloudflare 비밀키 넣기 (비밀키-넣기.bat 가 실행)
// 넣은 값은 Cloudflare 에만 저장되고, 이 파일이나 화면 코드에는 남지 않는다.
const { spawn } = require('child_process');
const readline = require('readline');
process.chdir(__dirname);
const W = 'npx -y wrangler@4.40.0';
const KEYS = [
  ['VWORLD_KEY', '브이월드 인증키 (산 상세의 "주변 등산로" 지도)', 'https://www.vworld.kr → 로그인 → 마이페이지 → 인증키 관리'],
  ['NAVER_MAP_SECRET', '네이버 클라우드 Maps Client Secret (길찾기 · 경로 보기)', 'https://console.ncloud.com → AI·Application Service → Maps → Application → 인증 정보'],
];
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, (a) => r(a.trim())));
function put(name, value) {
  return new Promise((resolve) => {
    const ch = spawn(W + ' secret put ' + name, { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
    ch.stdin.write(value + '\n');
    ch.stdin.end();
    ch.on('close', (code) => resolve(code === 0));
  });
}
(async () => {
  console.log('\n==== 여행 스토리 비밀키 넣기 ====');
  let ok = 0, fail = 0;
  for (const [name, what, where] of KEYS) {
    console.log('\n[' + name + '] ' + what);
    console.log('  어디서 보나요: ' + where);
    const v = await ask('  값을 붙여넣고 Enter (건너뛰려면 그냥 Enter): ');
    if (!v) { console.log('  건너뜀'); continue; }
    console.log('  Cloudflare 에 넣는 중...');
    if (await put(name, v)) { ok++; console.log('  넣었어요!'); } else { fail++; console.log('  넣지 못했어요.'); }
  }
  rl.close();
  console.log('\n' + (fail ? 'RESULT: FAILED (' + fail + '개 실패)' : 'RESULT: OK (' + ok + '개 넣음)'));
})();
