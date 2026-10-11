// 여행 스토리 Cloudflare 배포 도우미 (배포-cloudflare.bat 가 실행)
// 1) Cloudflare 로그인 확인  2) 저장소(D1) 만들기·연결  3) 표 만들기  4) 올리기  5) 새 주소 저장·열기
const { execSync, spawn } = require('child_process');
const fs = require('fs');
process.chdir(__dirname);
const W = 'npx -y wrangler@4.40.0';
const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
const step = (t) => console.log('\n==== ' + t + ' ====');

(async () => {
  step('1/4 Cloudflare 로그인 확인');
  let who = '';
  try { who = run(W + ' whoami'); } catch (e) { who = String(e.stdout || '') + String(e.stderr || ''); }
  if (!/logged in/i.test(who) || /not authenticated/i.test(who)) {
    // 브라우저가 저절로 안 열리는 PC가 있어서, 주소를 받아 직접 크롬/기본 브라우저로 연다. 시간이 지나면 다시 시도.
    let ok = false;
    for (let tryNo = 1; tryNo <= 3 && !ok; tryNo++) {
      console.log('\n브라우저에 Cloudflare 화면이 열리면 (로그인 후) [Allow] 를 눌러 주세요. (' + tryNo + '/3번째)');
      ok = await new Promise((resolve) => {
        const ch = spawn(W + ' login --browser=false', { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
        let opened = false, buf = '';
        const onData = (d) => {
          const t = String(d); buf += t;
          if (!opened) {
            const m = buf.match(/https:\/\/dash\.cloudflare\.com\/oauth2\/auth\?[^\s]+/);
            if (m) {
              opened = true;
              console.log('브라우저를 여는 중…');
              try { execSync('start "" "' + m[0] + '"', { stdio: 'ignore', shell: true }); }
              catch (e) { console.log('브라우저를 못 열었어요. 아래 주소를 복사해 크롬 주소창에 붙여넣어 주세요:\n' + m[0]); }
            }
          }
          if (/Successfully logged in/i.test(t)) console.log('로그인 성공!');
        };
        ch.stdout.on('data', onData); ch.stderr.on('data', onData);
        ch.on('close', (code) => { let w = ''; try { w = run(W + ' whoami'); } catch (e) { w = String(e.stdout || ''); } resolve(/logged in/i.test(w) && !/not authenticated/i.test(w)); });
      });
      if (!ok) console.log('로그인을 마치지 못했어요. 다시 시도합니다.');
    }
    if (!ok) throw new Error('Cloudflare 로그인을 하지 못했어요');
  } else console.log('이미 로그인되어 있어요.');

  step('2/4 저장소(D1) 준비');
  let toml = fs.readFileSync('wrangler.toml', 'utf8');
  // [저장소 이름, wrangler.toml 안의 자리표시]
  const DBS = [['travel-story', 'REPLACE_ME'], ['travel-story-photos1', 'REPLACE_PH1'], ['travel-story-photos2', 'REPLACE_PH2'], ['travel-story-photos3', 'REPLACE_PH3']];
  let list = null;
  for (const [name, ph] of DBS) {
    if (!toml.includes('"' + ph + '"')) { console.log(name + ': 이미 연결되어 있어요.'); continue; }
    let id = null;
    try {
      if (!list) list = JSON.parse(run(W + ' d1 list --json'));
      const f = (Array.isArray(list) ? list : []).find((d) => d.name === name);
      if (f) id = f.uuid || f.database_id || f.id;
    } catch (e) {}
    if (!id) {
      const out = run(W + ' d1 create ' + name + ' --location apac');
      const m = out.match(/"?database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/);
      id = m && m[1];
      if (!id) { console.log(out); throw new Error(name + ' 저장소 번호를 찾지 못했어요'); }
    }
    toml = toml.replace('"' + ph + '"', '"' + id + '"');
    fs.writeFileSync('wrangler.toml', toml);
    console.log(name + ' 연결:', id);
  }
  for (const [name] of DBS) execSync(W + ' d1 execute ' + name + ' --remote --file=schema.sql --yes', { stdio: 'inherit' });

  step('3/4 올리기 (처음이면 workers.dev 주소 이름을 물어볼 수 있어요 — 영어 소문자로 아무 이름이나 입력)');
  execSync(W + ' deploy', { stdio: 'inherit' });
  // 주소 알아내기 (이미 올린 뒤라 묻는 것 없이 주소만 다시 알려 준다)
  let out = '';
  try { out = run(W + ' triggers deploy'); } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const url = (out.match(/https:\/\/travel-story\.[a-z0-9-]+\.workers\.dev/) || [])[0];

  step('4/4 끝');
  if (url) {
    fs.writeFileSync('새주소.txt', url + '\r\n');
    console.log('새 주소:', url, '(새주소.txt 에도 적어 뒀어요)');
    try { execSync('start "" "' + url + '"', { stdio: 'ignore', shell: true }); } catch (e) {}
  }
  console.log('\nRESULT: OK');
})().catch((e) => { console.error('\n' + e.message); console.log('\nRESULT: FAILED'); process.exitCode = 1; });
