# 여행 스토리

나만의 여행 다이어리 웹앱 — https://travel-story.hongtravel7584.workers.dev

- `public/` 화면 (index.html, 이미지, 자료)
- `cf/` Cloudflare Workers 서버 (`dist/worker.js` 는 미리 묶어 둔 파일)
- `src/`, `netlify/functions/` 서버 기능 원본

이 저장소에 바뀐 내용이 올라오면 Cloudflare가 자동으로 배포한다.
비밀 열쇠(VWORLD_KEY 등)는 저장소가 아니라 Cloudflare 설정에 보관한다.
배포 시험
