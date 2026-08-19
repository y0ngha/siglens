/// <reference types="next" />

// `tsconfig.scripts.json` 전용 앰비언트 진입점.
//
// 스크립트가 끌어오는 `src/**` 파일 다수가 `import 'server-only'`로 시작한다.
// 그 모듈 선언은 `node_modules/next/types/global.d.ts`에 있는데, 메인 프로젝트는
// 그걸 **우연히** 얻는다 — `src/app/api/sitemap/static/route.ts` 같은 파일이
// `next/server`를 import하면서 next 타입 전체가 프로그램에 딸려 들어온다.
// 스크립트만 담은 프로그램에는 그 경로가 없어 전부 TS2882로 깨진다.
//
// `next-env.d.ts`로 대신할 수 없다: `next build`가 만드는 파일이라 gitignore
// 대상이고, CI는 typecheck를 빌드보다 먼저 돌려 그 파일이 없다(v0.57.0 배포가
// `files`에 그걸 넣었다가 TS6053으로 죽었다).
export {};
