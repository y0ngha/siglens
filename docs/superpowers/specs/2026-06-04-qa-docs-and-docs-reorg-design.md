# QA 문서 세트 + docs/ 폴더 재구성 — 설계 (Design)

> **목적**: 이번 세션에서 수행한 QA(테스트·실증)·PR 리뷰 루프·릴리스 검증·안정성 감사 노하우를
> 다음 세션에서도 그대로 재참조할 수 있는 문서 세트로 남기고, 동시에 flat한 `docs/`를 목적별
> 폴더 구조로 재구성한다.

**작성일**: 2026-06-04
**대상 브랜치**: `master` (직접 커밋, 논리적 3커밋 분리)
**작성 주체**: 메인 오케스트레이터(Opus 4.8)가 직접 작성, 커밋·푸시는 git-agent

---

## 1. 목표 (Goal)

세 가지를 한 번에 처리한다.

- **A. docs/ 재구성** — flat 16개 `.md`를 목적별 6폴더로 이동 + `docs/README.md` 인덱스 신규
- **B. QA 문서 7종 신규** — `docs/qa/` 아래 작성 + `docs/qa/README.md` 인덱스
- **C. 참조 갱신 + 교훈 반영** — 모든 운영 참조 경로 수정 + 세션 교훈을 MISTAKES.md/fix-log에

설계 결정(브레인스토밍에서 확정):
1. 기존 문서와 겹치는 내용(docker/Redis 백엔드, 에이전트 루프)은 **cross-ref만 하고 중복 작성하지 않는다**(단일 소스).
2. 새 QA 문서는 `docs/qa/` 서브폴더 + README 인덱스.
3. #6(릴리스 검증)과 안정성 감사는 **두 문서로 분리**.
4. docs/ 재구성은 **목적별 6폴더**.

---

## 2. docs/ 재구성 매핑 (A)

기존 파일명은 **UPPERCASE 유지(이동만)** — 불필요한 rename churn 방지.

```
docs/
├── README.md                ← 신규: 전체 docs 인덱스(폴더별 한 줄 설명)
├── product/                 제품·도메인 (무엇을 만드나)
│   ├── SERVICE.md
│   ├── DOMAIN.md
│   └── AUTH.md
├── architecture/            구조·범위 (어떻게 구성되나)
│   ├── ARCHITECTURE.md
│   ├── SCOPE.md
│   └── PERFORMANCE_BASELINE.md
├── conventions/             작성 규칙
│   ├── CONVENTIONS.md
│   ├── FF.md
│   ├── GIT_CONVENTIONS.md
│   └── DESIGN.md
├── reference/               레퍼런스 (조회)
│   ├── API.md
│   └── CRON.md
├── workflows/               에이전트 프로세스
│   ├── ISSUE_IMPL_FLOW.md
│   ├── PR_FIX_FLOW.md
│   └── MISTAKES.md
├── qa/                      테스트·검증 (E2E.md 이동 + 7 신규)
│   ├── README.md            ← 신규: QA 문서군 인덱스
│   ├── E2E.md               ← 이동
│   ├── QA_ENV_SETUP.md      ← 신규 #1
│   ├── TEST_SHEET_AUTHORING.md  ← 신규 #2
│   ├── MULTI_ENV_TESTING.md ← 신규 #3
│   ├── EMPIRICAL_VERIFICATION.md ← 신규 #4
│   ├── PR_REVIEW_LOOP.md    ← 신규 #5
│   ├── RELEASE_VERIFICATION.md   ← 신규 #6
│   └── STABILITY_AUDIT.md   ← 신규 #7
├── __agents_only__/         (불변)
└── superpowers/             (불변 — 역사적 아카이브, 내부 링크 갱신 안 함)
```

**아카이브 제외 원칙**: `docs/superpowers/specs|plans/`는 날짜가 박힌 시점 기록이며 이미 stale 링크
(`docs/PUBLIC_API.md` 등)가 존재한다. 이동에 따른 링크 갱신을 하지 않는다(아카이브로 취급).

---

## 3. QA 문서 7종 개요 (B) — 각 net-new 집중, 겹침은 cross-ref

### #1 `docs/qa/QA_ENV_SETUP.md` — 범용 QA 환경 셋업
- **docker 백엔드 3서비스**: `postgres:17`(5433) / `redis:7`(6380) / `serverless-redis-http`(SRH, 8079).
  세부 구성·healthcheck는 `docs/qa/E2E.md` 링크. 본 문서는 "수동 prod-like 검증" 관점에서 기술.
- **`.env.local` DATABASE_URL → docker 전환·원복**: 검증 중 docker postgres로 바꾸고, **끝나면 메인
  `.env.local`과 동일(Neon)하게 반드시 원복**. 워크트리 `.env.local`과 메인 레포 `.env.local`은 별개.
- **Redis 실증 경로**: `.env.e2e`의 `UPSTASH_REDIS_REST_URL/TOKEN/READONLY_TOKEN`이 SRH(localhost:8079)를
  가리켜 앱의 Upstash 클라이언트(`getOrSetCache`)가 **prod Upstash 대신 로컬 docker Redis**를 때린다.
  → FMP 캐싱·공지 등 Redis 캐싱 동작을 prod 미접촉으로 실증 가능.
- **prod-like 빌드/실행**: `E2E_TEST=1 yarn build` + `yarn start -p 4300`(또는 env-shadow), 빌드 exit code는
  파이프 없이 직접 캡처(`> log 2>&1; echo $?`).
- **멀티브라우저 도구 설치**: Chrome MCP(claude-in-chrome) + Playwright(`yarn playwright install chromium webkit`).
- **워크트리 주의**: node_modules는 **symlink 금지**(Turbopack 거부 + dual-React 실패). `cp -al` 하드링크 후
  잔여 `node_modules/node_modules` 제거. 검증용 stub(server-only no-op 등)은 끝나고 원복.
- **prod DB 절대 미접촉**: `DIRECT_DATABASE_URL`이 prod Neon이면 migrate가 prod를 칠 수 있음 → docker URL override.
  prod journal에 당일 엔트리 없음으로 미변경 검증.
- **종료 체크리스트**: `.env.local` 원복 / 검증 패치(client.ts 등) 원복 / `:4300` 종료 / `yarn e2e:down`(docker) /
  잔존 시드 데이터 정리 / 워크트리·Chrome 탭 정리.

### #2 `docs/qa/TEST_SHEET_AUTHORING.md` — 테스트 시트 작성
- **변경면(change surface) 분석 → 케이스 도출** 순서. happy path뿐 아니라 worst/edge/integration.
- **이번 세션 누락 사례(중요)**: 사용자 피드백으로 뒤늦게 드러난 항목 — ① 마크다운 렌더링 ② 매우 긴 본문
  스크롤(사용성) ③ Safari ④ 모바일. 케이스 설계 단계에서 이를 선제 포착하는 **보강 체크리스트** 제공:
  "렌더링 입력이 사용자 데이터(마크다운/HTML)인가? 길이 극단값은? 브라우저 엔진(WebKit) 차이는? 뷰포트(모바일)는?"
- 산출물 형식(C#/B# 케이스 ID + 기대값 + 결과) 예시는 `docs/qa/RELEASE_VERIFICATION.md` 링크.

### #3 `docs/qa/MULTI_ENV_TESTING.md` — 멀티 환경 테스트
- **매트릭스**: Chrome/Safari × Desktop/Mobile (4조합 기본).
- **도구 매핑**: claude-in-chrome = **Chrome 전용**. Safari·모바일 = **Playwright webkit / iPhone 14 device**.
- Playwright 프로젝트 구성: `chromium`(Desktop Chrome, 모든 비-account 스펙), `webkit`(iPhone 14,
  `@webkit` 태그만). 모바일 Safari 커밋 커버리지는 describe+test 제목 양쪽 `@webkit` 태그.
- **표준화**: 피드백으로 누락됐던 환경(Safari·모바일)이 기본 매트릭스에 항상 포함되도록 규정.

### #4 `docs/qa/EMPIRICAL_VERIFICATION.md` — 실증 프로세스
- **원칙**: 무언가 적용/주장하기 전 항상 **실증 + 자료조사**. 추측-사이클 금지.
- **리뷰봇 주장 검증**: 이 레포 리뷰봇(claude-review/gemini)은 false-positive 다발. 프레임워크/사실 주장은
  문서+실측으로 확인하고 거짓이면 근거와 함께 반려. stale 인라인(이미 수정된 항목 재지적) 식별.
- **ground truth**: Playwright trace.zip(실제 헤더), 빌드 로그 직접 캡처, DB journal 등 1차 증거.
- **flake 판별 절차**: 격리 단독 반복(N회) → full-suite 로컬 → CI 차이. pool(`vmThreads`) env 누수 이력 참조.
  "로컬 통과·CI 실패" 시 추측 말고 아티팩트(playwright-report) 분석.

### #5 `docs/qa/PR_REVIEW_LOOP.md` — 외부 리뷰봇 자동반영 루프
- 에이전트 라우팅(review/mistake/git-agent)은 `docs/workflows/PR_FIX_FLOW.md` 링크(중복 금지).
- **net-new**: 외부 봇(claude-code-review Action + Gemini) 자동반영 루프 —
  PR 생성/푸시 → 백그라운드 모니터(60s/최대 20min 폴링) → 코멘트 전수 검증 →
  유효는 반영, false-positive는 근거와 함께 PR 코멘트로 반려 →
  **Changes Requested면 Draft↔Ready 토글로 재리뷰**, Approved면 Suggestion/Question까지 반영 후 머지.
- **머지 규칙**: `--merge`(squash 아님), branch protection 차단 시 `--admin`. APPROVED 전 머지 금지.
- **push 검증**: git-agent 보고 신뢰 말고 `git ls-remote`로 remote SHA 확인(pre-push hook timeout 오보 대비).
- **CI flake 대응**: CI 실패 시 원인 분류(실제 회귀 vs flake). flake면 격리/반복으로 입증 후 robust 수정.
  pre-push hook은 format/lint/typecheck/test/build(e2e는 `SIGLENS_RELEASE_E2E=1`일 때만).

### #6 `docs/qa/RELEASE_VERIFICATION.md` — 릴리스(버전범위) 실증 검증 플레이북
- **목적**: 최근 배포 ~ 현재 버전(예: v0.15.0 → 현재)의 변경사항·핵심 기능을 prod처럼 빌드·실행해
  동작/SEO 문제를 실증. E2E·테스트코드가 커버해도 prod 빌드 런타임 관점 점검.
- **이중 방법**: ① **curl**(응답값/Status Code) ② **Chrome 도구**(직접 확인). 둘 다 활용.
- **절차**: Spec 작성 → Test Case를 Opus 4.8로 먼저 생성 → 개발/prod 서버 기동 → curl C# + Chrome B# 수행 →
  결과 요약 → 필요 시 수정 PR.
- **재사용 프롬프트 템플릿(검증)** — §6.1에 verbatim 수록.
- 세션 예시 산출물: `docs/superpowers/specs/2026-06-03-predeploy-verification.md`,
  `2026-06-04-v015-to-current-verification-spec.md` 링크.

### #7 `docs/qa/STABILITY_AUDIT.md` — 배포 안정성 감사(5 fresh-context agent)
- **구성**: 5개 Opus 4.8 에이전트를 **fresh context**(현 세션 맥락 모름)로 띄움 —
  ① review-agent 코드 감사 ② 일반 agent 배포 안정성 감사 ③ 일반 agent "현재 배포 가정" 안정성 감사
  ④ 일반 agent `seo-audit` SEO 감사 ⑤ 일반 agent 테스트 커버리지 90%+ 및 worst/edge/integration/e2e 감사.
- **why fresh context**: 세션 편향 없이 독립 시각 확보(배포 env 누락 같은 코드-무관 이슈 발견에 효과적).
- **종합**: 5개 결과를 모아 중복 제거 → 실제 이슈만 수정 PR로. (예: 4-agent 감사가 빌드 필수 env 누락 발견.)
- **재사용 프롬프트 템플릿(감사)** — §7.1에 verbatim 수록.

---

## 4. 참조 갱신 인벤토리 (C) — 운영 참조만

이동으로 깨지는 `docs/<NAME>.md` 링크를 새 경로로 갱신한다. **갱신 대상(운영)**:

- 루트 `CLAUDE.md` — Request Routing 표(`docs/ISSUE_IMPL_FLOW.md`→`docs/workflows/...`,
  `docs/PR_FIX_FLOW.md`→`docs/workflows/...`, `docs/SCOPE.md`→`docs/architecture/...`),
  Reference Documents 표(전 항목 경로), Cross-repo 가드의 SCOPE 경로.
- `README.md` — docs 링크 전부.
- `.claude/agents/review-agent.md`, `.claude/agents/mistake-managing-agent.md` — `MISTAKES.md`, `FF.md` 경로.
- `src/app/CLAUDE.md` 및 기타 레이어 CLAUDE.md — `MISTAKES.md`, `DESIGN.md` 등.
- `.github/ISSUE_TEMPLATE/*`, `.github/*`, `.gemini/*` — docs 링크.
- live docs 상호참조: `ARCHITECTURE.md`, `SCOPE.md`, `MISTAKES.md`, `PR_FIX_FLOW.md`, `ISSUE_IMPL_FLOW.md`
  내부의 `docs/<NAME>.md` 링크.

**제외**: `docs/superpowers/specs|plans/*`(아카이브).

**검증**: 이동·갱신 후 다음으로 깨진 링크 0건 확인 —
```
grep -rnoE "docs/[A-Za-z_]+\.md" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.mjs" . \
  | grep -v "node_modules\|\.next\|\.claude/worktrees\|docs/superpowers" \
  | (각 경로가 실제 파일로 resolve되는지 확인)
```

### 교훈 반영 (MISTAKES.md / fix-log)
이번 세션에서 반복 가능성이 있는 패턴 추가:
1. **false WHY 주석(§15.6 강화 예시)**: "Playwright로 검증"처럼 실재하지 않는 검증을 인용하는 주석 금지 —
   주석의 모든 단언은 런타임/코드 현실과 일치해야. (방법 A: 주석 사실화 / 방법 B: 실제 테스트 추가)
2. **잔존 시드 데이터로 인한 기존 테스트 마스킹**: 수동 검증 때 시딩한 데이터(높은 priority)가 공유 docker
   DB에 남아 기존 E2E가 엉뚱한 데이터를 봐 실패. 수동 시드는 검증 후 반드시 정리.
3. **passive-effect 리스너 부착 race = CI-only flake**: `useEffectEvent`로 document 리스너를 등록하는 컴포넌트의
   테스트는 부하(CI vmThreads)에서 리스너 부착 전 이벤트 발사로 유실 가능 → 같은 effect 배치 산물(포커스 등)을
   기다려 부착 보장 후 발사. 블라인드 타임아웃 상향이 아니라 race 타깃.

---

## 4b. Part D — 문서 정합성 감사 수정 (5-agent 심층 감사, 전부 코드로 실증)

브레인스토밍 중 5개 Opus 4.8 에이전트로 docs/ 전체 + README + 루트/레이어 CLAUDE.md + 두 리뷰
설정을 감사. 아래는 **코드로 실증 완료**한 수정 대상. (범위: 검증된 🔴 전부 + 명확한 🟡. PERFORMANCE_
BASELINE 측정 수치 스냅샷은 보존, stale 라인참조만 정리.)

### D-1. 리뷰 설정 정합성 (behavioral — 최우선)
- **`.gemini/styleguide.md:22-25`** 🔴 — "Test Scope: `components/`·`app/` 테스트 제외" → CONVENTIONS.md
  (`src/app/** 90%`)와 충돌, `components/`는 pre-FSD 사멸 경로. **수정**: 해당 섹션을 "측정 대상 전 FSD
  레이어(`src/app/**` 포함) ~90%, 세부는 CONVENTIONS.md §Coverage Targets 참조"로 교체.
- **`.github/workflows/claude-code-review.yml:139`** 🔴 — `jest.setup.ts` → vitest. **수정**: "vitest.setup.base.ts /
  vitest.config.ts가 env를 전역 설정하면 누락 env를 버그로 보고하지 않는다"로.
- **`claude-code-review.yml:87`** 🟡 — `src/domain/`·`src/infrastructure/` "마이그레이션 중" 프레이밍 → 완료.
  **수정**: "FSD 마이그레이션 완료로 해당 레거시 경로는 제거됨; 경로명이 아니라 책임/내용으로 트리거".
- **parity** ⚪ — `.gemini/styleguide.md`에 AUTH 트리거 부재(claude.yml은 `docs/.../AUTH.md` 읽음). 선택적으로
  Gemini에도 AUTH 참조 추가(두 설정 criteria 문서 세트 일치화).

### D-2. 문서 콘텐츠 staleness (실증 완료)
- **`docs/AUTH.md`** 🔴 — Kakao OAuth "활성" 서술 ↔ `providers.ts:11 SUPPORTED_PROVIDERS=['google']`(Kakao
  비활성, 코드 주석 명시). **수정**: Kakao 관련 행(L24 env, L29 활성목록, L106 파일맵, L269 정책블록)을
  "비활성/예정"으로 표기, 활성은 Google만.
- **`docs/ARCHITECTURE.md:205-206`** 🔴 — "Cloud Run worker" ↔ `submitAnalysisAction.ts:3 waitUntil from
  '@vercel/functions'`. **수정**: Vercel `waitUntil` + 내부 `/worker` 라우트(API.md 정합)로.
- **`docs/ARCHITECTURE.md`** 🔴/🟡 — `fear-greed`를 entity로 분류(실제 widget) / `src/lib` legacy 엔트리(L160,
  실제 없음) / entities·widgets 인벤토리 drift. **수정**: `src/entities/`·`src/widgets/` 실제 슬라이스로
  목록 교정(fear-greed 제거, src/lib 제거, 누락분 추가 — 실제 디렉토리 ls 기준).
- **`docs/DESIGN.md:264-346`** 🔴 — `tailwind.config.ts` JS설정 블록 ↔ 파일 없음, Tailwind v4 `@theme`
  (globals.css). **수정**: 블록을 `@theme` CSS 커스텀 프로퍼티 형식(globals.css)으로 교체, 누락 토큰 포함.
- **`docs/DESIGN.md:357`** 🔴 — `@/lib/chartColors` → 실제 `@/shared/lib/chartColors`. **수정**: import 경로.
- **`src/widgets/CLAUDE.md:13`** 🔴 — "src/pages 사용 시 Pages Router 충돌" 근거 ↔ ESLint이 `pages` 레이어
  (`src/pages/*`, 라우팅 제외) 정식 예약(eslint.config.mjs:95). **수정**: "현재 composition은
  widgets/symbol-page에 잠정 유지, FSD `pages` 레이어는 ESLint에 이미 예약(향후 이관)"으로 — "충돌 위험"
  근거 제거.
- **`docs/SERVICE.md:44`** 🟡 — "30 types of multi candles" → DOMAIN.md MultiCandlePattern 34종. **수정**: 34
  (또는 "30 reversal + 4 continuation").
- **`docs/AUTH.md:316-318`** 🟡 — 비밀번호 재설정 UI "#388 후속" 노트 ↔ 같은 파일이 구현된 reset 플로우 문서화.
  **수정**: #388 노트 제거/완료 표기.
- **`docs/PERFORMANCE_BASELINE.md:229,381`** 🟡 — `src/middleware.ts` → 실제 `src/proxy.ts`. **수정**: 경로.
  L228 `cookies()@layout.tsx:137`는 §11에서 해소됨을 주석(측정 수치 자체는 보존).
- **`docs/API.md:34-62`** 🟡 — intraday 매핑표(5Min 시작) ↔ 예시 `historical-chart/1min`. **수정**: 예시를
  지원 세트와 일치(5min) 또는 1Min 행 추가 — 실제 지원값 확인 후.
- **`docs/CONVENTIONS.md:880-944`** 🟡 — React Query 예시 코드펜스 미닫힘(이후 섹션이 코드로 렌더). **수정**:
  L907 `---` 앞에서 펜스 닫기.
- **`docs/CONVENTIONS.md:546`** ⚪ — `§7.6` dangling(번호 섹션 사라짐). **수정**: "Import Path Rules" 섹션명 참조.
- **`skills/CLAUDE.md:9`** 🟡 — "~66" → 실제 스킬 수(70, 또는 명시적 근사+날짜). **수정**: 카운트 갱신.
- **`docs/ISSUE_IMPL_FLOW.md:197-198` / `PR_FIX_FLOW.md:226-227`** ⚪ — `--testPathPattern`(Jest 플래그) ↔
  vitest는 positional. **수정**: `yarn test run <pattern>` 형태로(package.json `test` 스크립트 확인 후).
- **`README.md` / 루트 `CLAUDE.md`** ⚪ — doc 테이블 상호 drift + 누락(AUTH/E2E/CRON/PERFORMANCE_BASELINE/
  flows). **수정**: reorg 시 두 테이블을 실제 docs/ 내용으로 재동기화(비망라면 명시).
- **`src/features/CLAUDE.md:11-15`** ⚪ — cross-feature 예외표에 `auth-oauth-consent → auth-signup` 누락.
  **수정**: 행 추가.

### D-3. 참조-갱신과 합류
SCOPE.md의 `docs/PUBLIC_API.md` 3건은 siglens에 없는 파일(core 레포 정본) → "core 레포 위치 명시"로 정리.
나머지 flat `docs/<NAME>.md` 참조는 §4 reorg 경로 갱신에 합류.

**검증 완료 로그**: ① `SUPPORTED_PROVIDERS=['google']` ② `waitUntil from '@vercel/functions'`(Cloud Run 없음)
③ `tailwind.config.*` 없음 + globals.css `@theme`×2 ④ `src/entities/fear-greed` 없음·`src/widgets/fear-greed`
존재 ⑤ `src/shared/lib/chartColors.ts`만 존재 ⑥ `src/lib` 없음 ⑦ `src/pages` 없음·eslint `pages` 예약.

---

## 5. 실행 순서 & 안전

**논리적 5커밋**(git-agent) — 의존 순서:
1. `docs: fix stale/conflicting content surfaced by consistency audit` — **Part D** 콘텐츠 수정(AUTH Kakao,
   ARCHITECTURE Cloud Run/인벤토리/src/lib, DESIGN tailwind/chartColors, SERVICE 캔들수, PERFORMANCE_BASELINE
   proxy, API 타임프레임, CONVENTIONS 펜스/§7.6, skills 카운트, widgets/pages 근거, 레이어 doc 표). reorg
   **이전**에 수행 — 평면 경로 상태에서 콘텐츠만 고쳐 diff를 깔끔히.
2. `chore(review): align claude/gemini review configs with current stack` — **D-1** 리뷰 설정(gemini test-scope,
   jest→vitest, src/domain 프레이밍, AUTH parity).
3. `docs: reorganize flat docs into purpose folders + update references` — **A** 파일 이동(`git mv`) + 모든 운영
   참조 갱신(루트/레이어 CLAUDE.md, README, `.claude/agents/*`, 두 리뷰설정 경로, live docs 상호참조) +
   `docs/README.md` 인덱스 신규. **깨진 링크 0건 grep 검증**.
4. `docs(qa): add QA/verification playbook set` — **B** `docs/qa/` 7 신규 + `docs/qa/README.md` 인덱스 +
   루트 CLAUDE.md Reference 표 등록.
5. `docs: capture session QA lessons in MISTAKES` — **C** MISTAKES.md/fix-log 교훈 3건.

각 커밋은 문서/설정(yml·md)만 변경하므로 빌드/런타임 영향 없음(pre-push build 통과). 파일 이동은 `git mv`로
히스토리 보존. 커밋 1·2를 reorg(3) 앞에 두어 콘텐츠 수정과 경로 이동 diff가 섞이지 않게 한다.

**리스크 & 완화**:
- 참조 누락 → 깨진 링크: §4 grep 검증을 커밋 1 직후 수행.
- 에이전트 동작 의존(MISTAKES.md/PR_FIX_FLOW.md 경로): `.claude/agents/*`와 루트/레이어 CLAUDE.md를
  최우선 갱신, 누락 시 라우팅 실패하므로 grep로 전수 확인.

---

## 6. 부록 — 재사용 프롬프트 템플릿

### 6.1 릴리스 실증 검증 프롬프트 (RELEASE_VERIFICATION.md에 수록)
```
진행 전, 변경 범위에 대해 Spec을 작성하고, Test Case를 먼저 Opus 4.8로 생성해줘. 그 이후 실증을 진행할거야.

범위는 {시작버전} ~ 현재버전까지이고, 변경사항들과 핵심 기능들에 대해 문제가 없는지 Test case를 따라 테스트를 진행할거야.
E2E와 Test Code가 커버를 하고 있지만, 실제 Production처럼 빌드를 하고, 실행하였을 때 동작에 문제가 없는지 / SEO에 문제가 없는지 등 살펴보는거지.

두 가지 방안으로 할 수 있는데, 우선 개발서버를 띄우고
1. Curl로 확인한다. (응답값 / Status Code 등)
2. 크롬 도구를 이용해 직접 확인한다.
두 가지 방법을 모두 활용하여 진행해줘.
```

### 7.1 배포 안정성 감사 프롬프트 (STABILITY_AUDIT.md에 수록)
```
지금 세션의 context를 모르는채로, review-agent에게 코드 감사 / 일반 agent에게 배포 안정성 감사 / 일반 agent에게
현재 배포한다고 가정했을 떄 배포 안정성 감사 / 일반 agent에게 `seo-audit`을 이용하여 현재 SEO 감사 / 테스트 커버리지 90% 이상 및 Worst case, edge case, integration test, e2e 테스트 감사 - 총 5개의 agent를 띄우고 opus 4.8로
실행해줘.
모두 다 fresh context, 즉 지금 세션의 context를 모르는 채로 진입해야해.
```

---

## 7. Self-review 체크
- Placeholder 없음(모든 섹션 구체값). TBD 없음.
- 내부 일관성: 6폴더 매핑 ↔ 참조 갱신 인벤토리 ↔ 3커밋 순서 정합.
- 범위: 단일 실행 플랜으로 충분(문서 작업). 코드 변경 없음.
- 모호성: "아카이브 제외" 기준 명시(superpowers/), 파일명 UPPERCASE 유지 명시.
