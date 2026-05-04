# Fix Log

## [PR #417 Round 5 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: 신규 infrastructure 함수 `getAssetInfoCached` 단위 테스트 부재
- Rule: CONVENTIONS.md infrastructure/ 100%, MISTAKES.md Tests #12
- Context: R4에서 4개 페이지 중복을 제거하면서 추출한 새 infrastructure 파일. 테스트 누락 → 위임 동작(action 결과 pass-through) + null 반환 + jest 환경 동작 3 케이스로 커버.

- Violation: 워크트리 \`CLAUDE.md\` 갱신 누락 — R4 fix-log에 갱신 완료로 기재되어 있으나 실제로는 main 레포의 CLAUDE.md만 수정되어 있고 워크트리의 같은 파일은 옛 내용("infrastructure ← May import from domain only")을 그대로 갖고 있었다
- Rule: 변경 사항은 실제 commit 대상(워크트리)의 파일에 적용해야 함
- Context: R4에서 절대경로로 \`/Users/y0ngha/Project/siglens/CLAUDE.md\`(메인 레포)를 수정해 워크트리의 같은 파일은 미반영. 워크트리의 \`CLAUDE.md\`도 동일하게 \"May import from domain and lib (lib must be pure utilities/constants only)\"로 갱신.

## [PR #417 Round 4 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: loadKoreanFont에 인라인 매직 넘버 `60 * 60 * 24 * 7` (7일 초)
- Rule: MISTAKES.md #15 — 매직 넘버는 모듈 레벨 상수로 추출
- Context: `import { SECONDS_PER_DAY } from '@/domain/constants/time'`로 이미 존재하는 시간 상수 활용. `const FONT_REVALIDATE_SECONDS = 7 * SECONDS_PER_DAY` 도입.

- Doc policy update (REJECTED B1 → 문서 수정으로 처리): `infrastructure ← lib` 금지 규칙 완화
- Rule: ARCHITECTURE.md, CLAUDE.md(root), src/lib/CLAUDE.md 일괄 갱신
- Context: lib/og.ts에 색상/레이아웃 순수 상수만 두고 사이드 이펙트 함수(loadKoreanFont)는 R2에서 이미 infrastructure로 옮겼다. 그러나 색상 상수는 lib에 남아 infrastructure(buildSymbolOgImage.tsx)에서 import해야 했고, 이는 기존 "infrastructure ← domain only" 규칙 위반. 사용자 결정으로 규칙을 "infrastructure ← domain + lib (lib must be pure utilities/constants only)"로 명시 완화. 단 cross-layer 타입은 여전히 domain/types.ts에만 두기로 유지(hook 측 import 경로 보호).

- Doc policy clarification (REJECTED B3 → 문서 수정으로 처리): MISTAKES.md #0 적용 범위 명시
- Rule: MISTAKES.md #0 (Non-component function or Route Handler missing explicit return type)
- Context: 사용자 의도는 "순수 함수/로직 함수"의 반환 타입 명시였고, Next.js 파일 컨벤션(page.tsx, layout.tsx, opengraph-image.tsx, sitemap.ts, robots.ts, manifest.ts 등)은 Next가 시그니처를 보장하므로 예외라는 점을 문서화. 룰 제목과 본문 모두 "Pure function or logic-bearing function" + 예외 목록으로 갱신.

- Suggestion S1 적용: 4개 page에 반복되던 `const getAssetInfoCached = cache(getAssetInfoAction)` 패턴
- Rule: FF Cohesion — 동일 코드 N번 반복은 한 곳으로 모은다
- Context: `src/infrastructure/ticker/getAssetInfoCached.ts`로 추출. React.cache는 per-request scope이므로 모듈 레벨에 한 번만 정의해도 동일 동작.

- Suggestion S2 적용: SymbolPageClient bottomSlot 주석 WHAT → WHY로 교체
- Rule: 주석은 코드로 자명하지 않은 이유를 적는다
- Context: "차트 컨테이너 아래에 렌더" → "서버 컴포넌트가 SEO용 cross-link를 주입하기 위한 슬롯".

- Suggestion S3 적용: package.json predev/prebuild 명령어 중복
- Rule: FF Cohesion — drift 방지
- Context: `copy:backtesting` 공유 스크립트로 추출하고 predev/prebuild는 `yarn copy:backtesting`을 호출.

## [PR #417 Round 3 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: 신규 infrastructure 함수 `buildSymbolOgImage` (src/infrastructure/og/buildSymbolOgImage.tsx) 단위 테스트 부재
- Rule: CONVENTIONS.md "infrastructure/ 100% (필수)" + MISTAKES.md Tests #12 — every new infra function must have a unit test file
- Context: P3.3 → R2에서 OG 라우트 4개 중복을 제거하면서 새로 만든 공유 팩토리. R3 reviewer가 테스트 누락 지적. `next/og.ImageResponse`와 `loadKoreanFont`를 mock하여 fonts 옵션 분기 + size 옵션 검증 3개 케이스 추가.

- Violation: 신규 infrastructure 함수 `loadKoreanFont` (src/infrastructure/og/loadKoreanFont.ts) 단위 테스트 부재
- Rule: CONVENTIONS.md infrastructure/ 100%, MISTAKES.md Tests #12
- Context: R1에서 lib/og.ts에서 infrastructure로 이동하면서 테스트를 추가하지 않았음. global.fetch mock으로 (a) 성공 (b) res.ok=false (c) fetch throw (d) arrayBuffer throw 4 분기 모두 커버.

- Violation: fundamental/page.tsx generateMetadata와 page body 간 sector opt 비대칭 — `<meta description>`은 sector 없는 카피, JSON-LD WebPage description은 sector 보강 카피로 갈라짐
- Rule: FF Predictability — 동일 의미의 메타 description이 두 갈래로 갈라지면 reviewer/Google 모두 혼란
- Context: P2.4 의도된 비대칭(generateMetadata에서 getProfile 추가 fetch 회피). 의도 코멘트만 추가하여 향후 reviewer가 silent drift로 오인하지 않도록 명시.

- Violation: backtesting/page.tsx 면책 고지가 `<aside>`로 감싸져 있어 ARIA `complementary` role이 적용 — 면책 고지는 보완 콘텐츠가 아니라 필수 법적 노트
- Rule: ARIA semantics — `<aside>`는 제거해도 메인 콘텐츠 이해에 지장이 없는 보완 콘텐츠 전용
- Context: P4.6에서 `<footer>` → `<aside>`(글로벌 Footer landmark 중복 회피) 변경. R1 reviewer가 footer 원복 권고 → 거절(글로벌 Footer 충돌). R3 reviewer가 `<div role="note" aria-label>` 옵션 제시. 두 우려 모두 해소되는 third path를 채택.

- Violation: overall/page.tsx 인트로 `<section>`에 accessible name 없음 — 스크린 리더 랜드마크 탐색에서 generic으로 처리
- Rule: ARIA — `<section>`은 aria-labelledby로 접근 가능 이름이 명시되어야 랜드마크로 인식
- Context: P1.1에서 visible static SEO 콘텐츠 블록을 `<section>`으로 추가. 내부 `<h2>`에 id 부여하고 `<section aria-labelledby>`로 연결.

## [PR #417 Round 2 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: `Promise<{ id: SitemapId }[]>` inline object literal in return type of `generateSitemaps()`
- Rule: MISTAKES.md TypeScript #5.5 — Function return types using inline object literals instead of named types
- Context: Created during P4.1 sitemap split. Extracted to `interface SitemapSegment { id: SitemapId }` and reused in both `generateSitemaps()` return and `sitemap()` parameter destructure type.

- Violation: Magic number `20` for US market close UTC hour in sitemap.ts
- Rule: MISTAKES.md #15 — All magic numbers must be extracted to module-level constants
- Context: P3.7 originally inlined `Date.UTC(..., 20, 0, 0, 0)`. Extracted to `const US_MARKET_CLOSE_UTC_HOUR = 20`.

- Violation: `assetInfo` null handling asymmetric between generateMetadata (ternary) and page body (direct pass) in fundamental/page.tsx
- Rule: MISTAKES.md Predictability #1.5 — Asymmetric input handling across related functions (extends to consistent null-guard style)
- Context: `buildDisplayName` accepts nullable assetInfo so the page body was technically correct, but the asymmetry was a maintenance trap. Unified to ternary pattern matching generateMetadata, plus added a comment explaining why fundamental allows assetInfo=null (FMP profile-only ticker support, distinct from news/overall behavior).

- Violation: OG image layout magic numbers (top:56, right:72, fontSize:32/240/64, padding:'80px') duplicated across 4 opengraph-image.tsx files
- Rule: MISTAKES.md #15 drift trap — when a constant exists in a file, every literal use of the same value must reference the constant
- Context: P3.3 inlined identical layout numbers in 4 OG route files. Extracted to OG_CONTAINER_PADDING / OG_TICKER_FONT_SIZE / OG_LABEL_FONT_SIZE / OG_SITE_NAME_FONT_SIZE / OG_SITE_NAME_TOP / OG_SITE_NAME_RIGHT / OG_LABEL_MARGIN_TOP in lib/og.ts. Also extracted shared JSX to infrastructure/og/buildSymbolOgImage.tsx factory; 4 route files reduced to 16-line thin wrappers each.

- Violation: `newsItems.slice(0, 10)` magic number in news/page.tsx
- Rule: MISTAKES.md #15
- Context: Extracted to `const JSON_LD_NEWS_MAX_ITEMS = 10` with comment referencing Google ItemList guideline.

- Violation: TypeScript narrowing comment "id is narrowed to 'tickers' by exhaustive SitemapId union"
- Rule: MISTAKES.md #2.5 — Comments describing TypeScript narrowing already evident from code
- Context: Removed; the `if (id === 'static') return [...]` guard above already proves narrowing.

## [PR #417 Round 1 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: `lib/og.ts` exposed `loadKoreanFont()` performing CDN `fetch()` (network I/O side effect) inside the lib layer
- Rule: `src/lib/CLAUDE.md` — "Pure functions only, no side effects" (mirrors ARCHITECTURE.md layer constraint)
- Context: Created during P3.3 (dynamic OG image route). Moved to `src/infrastructure/og/loadKoreanFont.ts`; `lib/og.ts` now contains only pure color constants (OG_BG, OG_FG, OG_ACCENT, OG_MUTED). Same pattern caught in earlier review (P3.3 round 2 moved og-shared.ts to lib/og.ts), but the `loadKoreanFont` part of that move kept the side effect inside lib — second review caught the residual.

- Violation: schema.org `Article.datePublished` set to `new Date().toISOString()` (request time) — Googlebot interprets every crawl as a fresh publication
- Rule: schema.org Article semantics — `datePublished` is original publication time, not request time; for content updates use `dateModified`
- Context: Added during P3.1 (news Article JSON-LD). Replaced with `SITE_BUILD_DATE.toISOString()` for `datePublished` and kept `new Date().toISOString()` as `dateModified` (background card analysis genuinely changes per request). Promoted `SITE_BUILD_DATE` to `@/lib/seo` so news/page.tsx and sitemap.ts share one source instead of duplicating `parseBuildDate`.

## [PR #415 Round 2 | chore/upgrade-siglens-core-0.7.3 | 2026-05-04]
- Violation: chatAction's getProviderForModel/getServerPrimaryKey calls placed outside try-catch block — 0.7.3 throws on unknown modelId
- Rule: Server Actions must not propagate exceptions to the client — all throw paths must be caught and returned as { ok: false, error: 'server_error' }
- Context: Moved getProviderForModel + getServerPrimaryKey inside try block. Updated chatAction.test.ts to assert resolves({ ok: false }) instead of rejects.toThrow. Removed comment describing old behavior.

- Violation: submitOverallAnalysisAction had no try-catch — unexpected throws (e.g. DB failure, core throw) would crash the Server Action
- Rule: Server Actions must return typed error results instead of propagating uncaught exceptions
- Context: Wrapped entire body in try-catch; returns { status: 'error', axis: 'technical', error: e } on failure. Added corresponding test case.

## [PR #415 Doc Policy Removal | chore/upgrade-siglens-core-0.7.3 | 2026-05-04]
- Policy removed: MISTAKES.md Documentation Sync 규칙 4 (다중 라인 JSDoc 금지) — PR #415 review comments triggered by this rule were rejected; rule removed per user decision
- Context: Three review comments (Blockers #3178568999, #3178569205 and Suggestion #3178569415) cited the multi-line JSDoc policy. User decided the policy was overly restrictive; removed from MISTAKES.md.

## [chore/upgrade-siglens-core-0.7.3 | Round 1 | 2026-05-04]
- Violation: None — review-agent approved with zero findings
- Rule: N/A
- Context: Branch upgrades @y0ngha/siglens-core from 0.7.2 to 0.7.3 and applies five fixes for consumer-side breakages (useOverallAnalysis limit_error case, submitOverallAnalysisAction newsItems rename, chatAction key semantics, router comment). All changes approved on round 1.

## [Tasks 2.12–2.14 R1 | feat/fundamental-news-analysis | 2026-05-02]
- Violation: SymbolPageHeader.tsx had orphaned border-secondary-700 class (border color with no border-direction after border-b removal)
- Rule: MISTAKES.md rule 4 — Remove logic/code that has no effect (dead CSS)
- Context: Removed border-secondary-700 from header className since no border-direction utility is present.

## [Task 2.11 | feat/fundamental-news-analysis | 2026-05-02]
- Violation: OverallContent.tsx used `style={{ width: '...' }}` inline for skeleton widths
- Rule: MISTAKES.md rule 7 — Never use inline style for layout/styling; use CSS custom property + Tailwind pattern
- Context: Changed to `style={{ '--skeleton-w': '...' } as CSSProperties}` + `className="w-[var(--skeleton-w)]"`.

## [Issue #396 | feat/396/llm-api-key-management | 2026-05-02]
- Violation: ApiKeyActionState/RegisteredProvider 타입을 infrastructure/llm/types.ts에 정의 — components가 infrastructure에서 직접 type import
- Rule: ARCHITECTURE.md — components는 infrastructure에서 import 금지; 타입은 domain에 두어야 layer 규칙 준수 가능
- Context: domain/llm/types.ts로 이동 후 infrastructure/llm/types.ts에서 re-export. components는 @/domain/llm에서 import.

- Violation: safeClose, handleBackdropClick 함수에 void 반환 타입 미선언
- Rule: MISTAKES.md #0 — 컴포넌트 render 외부 함수는 반환 타입 명시 필요
- Context: `: void` 반환 타입 추가.

- Violation: ApiKeySection.tsx, PremiumModelGateModal.tsx에서 raw Tailwind color(emerald-*, amber-*) 직접 사용
- Rule: MISTAKES.md Design rule 0.5 — 모든 색상은 globals.css에 등록된 semantic token(ui-success, ui-warning, ui-danger) 사용
- Context: text-emerald-*/bg-emerald-*/ring-emerald-* → ui-success 토큰, text-amber-* → ui-warning 토큰으로 교체.

- Violation: chatAction.ts에서 createDatabaseClient() (인수 필요)를 인수 없이 호출 — getDatabaseClient() (캐시된 싱글톤)를 써야 함
- Rule: 함수 시그니처 불일치 — 인수 없이 호출 시 TypeScript 오류 발생
- Context: createDatabaseClient() → getDatabaseClient()로 교체.

## [PR #405 Round 4 | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: deleteAccount.ts revokeOAuthTokens가 명령형 forEach + void Promise로 fire-and-forget 처리
- Rule: CONVENTIONS.md — 명령형 forEach 대신 선언형 map + Promise.allSettled 사용 (FP 일관성)
- Context: forEach 내부 .catch로 개별 에러 흡수 + 외부 void Promise.allSettled로 묶어 동일한 fire-and-forget + 에러 개별 처리 동작 유지. 테스트 무수정 통과(883/101).

## [PR #405 Round 2 | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: tokenEncryption.ts 헤더 문구에 "sync obligation" 언급 (Phase 6 완료했으므로 불필요)
- Rule: Phase 6 마이그레이션 완료 후 더 이상 siglens-core와의 동기화 의무 없음 — 헤더를 과거시제로 갱신
- Context: tokenEncryption.ts의 "Sync obligation" 문구를 "Phase 6 of the scope-realignment refactor moved the DB layer fully into siglens"로 변경; 동기화 명령문 제거.

## [PR #405 | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: drizzle/0004_add_oauth_token_columns.sql가 _journal.json에 등재되지 않은 채 0006_striped_marauders.sql과 SQL이 완전 중복
- Rule: drizzle 마이그레이션은 _journal.json 등재 순서로 적용되며, 등재되지 않은 파일은 dead-code이자 drizzle-kit migrate 시 0006에서 컬럼 중복 오류 유발
- Context: orphan SQL 파일을 git rm으로 삭제. _journal.json은 변경 없음.

- Violation: drizzle/0004_petite_medusa.sql이 email_verified DEFAULT true로 추가되어 0005에서 false로 되돌리기 전 가입한 사용자들이 자동 검증 처리됨
- Rule: 운영 DB에 이미 적용된 마이그레이션은 사후 편집 금지 — 보정이 필요하면 새 forward migration 추가
- Context: 두 마이그레이션 모두 _journal에 등재되어 적용된 상태. 0004를 retroactive 수정하지 않고 0005에 사후 보존 사유와 향후 처리 가이드를 SQL 주석으로 명시.


## [PR #389 round 2 | feat/369/auth-email | 2026-04-28]
- Violation: Next.js error.tsx 컴포넌트 props 인터페이스에 `error: Error & { digest?: string }` 누락
- Rule: Next.js App Router 컨벤션 — error.tsx는 프레임워크가 `error`와 `reset` 두 prop을 모두 전달하므로 인터페이스에 양쪽 다 선언 필요
- Context: src/app/login/error.tsx가 reset만 prop으로 선언하고 error를 누락. 표시에 사용하지 않더라도 타입 안전성을 위해 선언 추가.


## [PR #384 Round 2 | feat/372-377/siglens-core-migration | 2026-04-27]
- Violation: WHY 주석 삭제 — EMA index 매핑 및 SQUEEZE_MOMENTUM_MIN_BARS 알고리즘 유도 주석 제거
- Rule: CLAUDE.md 코멘트 규칙 ("WHY is non-obvious" 주석은 유지)
- Context: 마이그레이션 과정에서 비자명 인덱스 매핑 주석(20-period EMA, 60-period EMA)과 알고리즘 유도 주석(2*kcLength-1 이유)이 삭제됨. 독자가 EMA_DEFAULT_PERIODS를 열어봐야만 확인 가능한 숨겨진 매핑이므로 반드시 유지해야 함.

## [Round 1 — Skipped findings]
- `src/app/[symbol]/page.tsx:144` and `src/app/market/page.tsx:13` (recommended): RSC에서 siglens-core 함수를 직접 호출하는 패턴은 기존 관례이며 이번 PR이 도입한 변경이 아님. RSC는 underlying async 함수를 직접 호출하고, 클라이언트용 Server Action wrapper는 별도 hook 경로로 사용하는 분리 패턴이 의도됨. PR 범위 밖이므로 skip.

## [PR #413 R3 | feat/fundamental-news-analysis | 2026-05-02]
- Violation: domain/types.ts 파일 중단부(~113행)에 import type { ChatMessage } from '@y0ngha/siglens-core' 선언
- Rule: ESLint import/first — 모든 import는 파일 최상단에 위치해야 함
- Context: DisplayMessage/ContextSwitchMessage 타입 추가 시 import를 파일 하단에 삽입. 최상단으로 이동.

## [PR #390 | feat/369/auth-social | 2026-04-28]
- Violation: OAuth 콜백에서 쿠키에 저장된 next 경로를 검증 없이 그대로 redirect로 사용
- Rule: Open Redirect 방어 — 사용자 변조 가능 입력은 사용 시점마다 sanitize (defense-in-depth)
- Context: state 쿠키는 HMAC 서명 없이 base64url JSON으로만 저장되므로 next 값이 변조 가능. /start에서 한 번 sanitize했더라도 콜백에서 redirect 직전에 sanitizeNextPath를 다시 적용해야 안전.

## [PR #390 | feat/369/auth-social | 2026-04-28]
- Violation: 외부 OAuth 토큰/유저 응답의 .json() 파싱 실패가 500 에러로 노출됨
- Rule: 시스템 경계(외부 API)의 예측 불가능한 응답은 try/catch로 감싸 결과 객체로 변환
- Context: tokenResponse.ok가 200이라도 본문이 JSON이 아닐 수 있어 await response.json()가 SyntaxError를 throw할 수 있음. google/kakao/apple 세 어댑터 모두에 동일 패턴 적용.


## [PR #395 Round 4 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: code 단계에서 동일한 codeState.error.message가 AuthErrorAlert와 AuthFieldGroup.error prop 두 곳에 동시 표시
- Rule: 동일 정보를 두 채널로 동시 노출하지 않음 — 하나의 에러는 하나의 UI 위치에서만 표시
- Context: SignupForm.tsx code phase에서 AuthErrorAlert와 AuthFieldGroup error prop에 모두 codeState.error.message를 전달하여 사용자에게 동일 에러가 중복 노출됨. AuthFieldGroup error prop 제거로 AuthErrorAlert 단일 표시로 통일.
## [PR #391 코멘트 반영 | feat/387/회원탈퇴-ui | 2026-04-30]
- Violation: describe 레이블과 실제 테스트 케이스 의미 불일치
- Rule: MISTAKES.md Tests #9 — describe 텍스트는 내부 it()들의 공통 전제조건만 커버해야 함
- Context: describe('이메일 검증 (email_mismatch)') 블록 안에 이메일이 일치하여 성공하는 케이스가 포함됨. 별도 describe('이메일 정규화') 블록으로 분리.



## [PR #393 | feat/388/비밀번호-재설정-ui | 2026-05-01]
- Violation: 동기 토큰 생성/해시 함수 테스트에서 불필요한 await 사용
- Rule: 테스트는 실제 함수 계약을 반영해야 하며 동기 API를 비동기처럼 보이게 작성하지 않는다
- Context: passwordResetTokenService 테스트가 string을 반환하는 generatePasswordResetToken/hashPasswordResetToken 호출에 await를 붙여 API 성격을 흐리게 했음. await와 async 테스트 선언을 제거.

## [PR #403 | feat/398/contact-us-form | 2026-05-01]
- Violation: cn()을 aria-describedby ID 조합에 오용
- Rule: cn()은 Tailwind 클래스 병합 전용 유틸리티로 ARIA ID 문자열 조합에 사용 금지
- Context: ContactTextareaField의 aria-describedby 값 조합에 cn()을 사용. 배열 filter+join 방식으로 교체.


## [PR #405 follow-up | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: future siglens work risked re-introducing analysis logic locally instead of in siglens-core
- Rule: SCOPE.md §3 (dependency direction) — analysis secret sauce stays in core
- Context: added siglens-side §0 work-boundary checklist + CLAUDE.md cross-repo scope guard so that analysis-related task descriptions trigger an explicit redirect-or-confirm step before any code is written.

## [Issue #401 | feat/401/worker-ai-provider-enhancement | 2026-05-02]
- Violation: 에러 처리 의도와 retryable 플래그 모순
- Rule: MISTAKES.md Predictability 6 — 인터페이스/구현/문서 정합성
- Context: chatgpt.ts에서 `finish_reason === 'length'` 처리 시 주석은 "재시도해도 결과는 같다"라고 적었지만 `{ retryable: true }`로 throw. ChatGPT는 budget 축소 등 mitigation이 없으므로 non-retryable로 변경.

## [PR #413 R4 | feat/fundamental-news-analysis | 2026-05-02]
- Violation: SymbolTabs used `role="tablist"` + `role="tab"` on `<Link>` elements that navigate to different URLs
- Rule: WCAG / ARIA Authoring Practices — tablist/tab is for same-page panel switching; URL navigation uses `<nav>` + `aria-current="page"`
- Context: Converted SymbolTabs from div[role=tablist]+Link[role=tab]+aria-selected+tabIndex+handleKey to nav[aria-label]+Link[aria-current]. Removed keyboard arrow-key handler (nav landmark does not require it per ARIA contract).

## [PR #413 Round 20 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: newsRepository.ts imported NewsDisplayItem from @/lib/news/types (infrastructure importing lib)
- Rule: CLAUDE.md Layer Dependency Rules — infrastructure ← domain only; infrastructure cannot import lib
- Context: Blocker B1. NewsDisplayItem moved from src/lib/news/types.ts to src/domain/types.ts. Note: R18 reviewer originally said NewsDisplayItem should move OUT of domain (UI type purity); R20 reviewer said move BACK to domain (layer rule enforcement). R20 ruling is structurally correct — domain is the only layer importable by both components/ and infrastructure/. Trade-off acknowledged: presentation-adjacent types tolerated in domain when cross-layer sharing required.

- Violation: httpClient.ts exported @internal JSDoc tag on non-exported FMP_FETCH_TIMEOUT_MS constant
- Rule: MISTAKES.md Documentation Sync 3 — @internal on non-exported symbols is redundant (4th recurrence: R12, R17, R18, R20)
- Context: Suggestion S1. FMP_FETCH_TIMEOUT_MS is non-exported (local to module), so @internal tag adds no semantic value. Removed.

- Violation: ChatPanel.tsx had WHAT comment "Narrowed to ChatMessage (role: 'user' | 'model') past this point"
- Rule: CONVENTIONS.md — comments only for WHY non-obvious; type narrowing behavior is self-evident from TypeScript
- Context: Suggestion S2. Comment describes TypeScript narrowing behavior rather than explaining a WHY decision. Type system is the documentation; removed comment.

- Violation: derivePageContextLabel.ts used 3 sequential if statements instead of object map for subpage lookup
- Rule: CONVENTIONS.md Declarative Code — prefer data structures (map, lookup) over imperative conditionals
- Context: Suggestion S3. Replaced if-else chain with SUBPAGE_LABEL record lookup + fallback to BASE_SYMBOL_LABEL.


## [PR #413 R7 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: useNewsAugment.ts run() 함수가 submitNewsAnalysisAction 호출 전 상태를 'loading'으로 초기화하지 않아, 이전 symbol/modelId의 'done' 상태가 persist
- Rule: MISTAKES.md Components 6.5 — State/function/documentation divergence
- Context: Added `setState({ status: 'loading' })` at top of run() to reset state before async operation. Symbol/modelId change now properly clears prior result state.

- Violation: todayKstIsoDate를 fundamentalData.ts와 newsData.ts에서 re-export하여 page.tsx 편의성을 위해 중간 계층 생성
- Rule: Module boundaries — data modules should not re-export lib utilities; consumers import directly from source
- Context: Removed todayKstIsoDate re-exports. pages now import directly from @/lib/dateKey, clarifying data module role.

## [PR #413 R8 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: SymbolTabsSkeleton.tsx nav element had both `aria-hidden="true"` and `aria-label="분석 종류"`
- Rule: MISTAKES.md Accessibility 1.5 — aria-hidden removes element from a11y tree; aria-label on hidden element is meaningless
- Context: Removed aria-label since aria-hidden="true" already hides from screen readers.


## [PR #413 R10 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: FinancialHealthCard had nested ternary (3 levels) for conditional BadgeVariant class assignment
- Rule: MISTAKES.md Coding Paradigm 7 — Nested ternaries 3+ times; extract to helper or declarative map
- Context: Replaced with `BADGE_VARIANT_CLASS: Record<BadgeVariant, string>` object map + extracted `BadgeVariant` type alias per CONVENTIONS.md declarative paradigm.

- Violation: lib/dateKey.ts called Date.now() (side effect), violating lib/ pure function requirement
- Rule: CLAUDE.md layer dependency — lib/ must contain external UI utility wrappers only; pure functions with side effects belong in infrastructure
- Context: Moved lib/dateKey.ts → infrastructure/utils/dateKey.ts; updated 4 import sites (fundamental/page.tsx, news/page.tsx, submitOverallAnalysisAction.ts, submitNewsAnalysisAction.ts).

## [PR #413 R11 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: useOverallAnalysis hook return type was inline `{ state: ...; trigger: () => void }` instead of named interface
- Rule: MISTAKES.md TypeScript 5.5 — Function return types using inline object literals instead of named types
- Context: Extracted `export interface UseOverallAnalysisReturn` named interface; hook now returns UseOverallAnalysisReturn.

## [PR #413 R12 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: toEarningsReport in src/infrastructure/db/earningsReportsRepository.ts had inline parameter type { symbol: string; earningsDate: string } while sibling earningsCalendarRepository.ts uses named EarningsCalendarDbRow interface
- Rule: MISTAKES.md TypeScript 5.5 — Inline object parameter type instead of named interface; breaks sibling consistency
- Context: Extracted EarningsReportDbRow named interface; toEarningsReport now uses named type matching earningsCalendarRepository pattern.

- Violation: src/infrastructure/utils/dateKey.ts (added in R10) had no corresponding test file
- Rule: MISTAKES.md Tests 12, 14 — All time-dependent utility functions must have test coverage including edge cases
- Context: Created src/__tests__/infrastructure/utils/dateKey.test.ts with 3 cases: UTC midnight, late evening (date crossover), early morning paths via jest.spyOn(Date, 'now').

## [PR #413 R12 | feat/fundamental-news-analysis | 2026-05-03 — Deferred]
- Question: Hooks importing infrastructure (useFundamentalAnalysis, useNewsAnalysis, useOverallAnalysis, useNewsAugment)
- Rule: CLAUDE.md hook→infrastructure imports limited to queryFn/mutationFn or useActionState Server Action connection
- Context: Current code uses useEffect polling state machines instead of Server Action callback. Architecture sufficient for async job-poll pattern (polling model was intentional design choice for stale background analysis). Deferred to separate cleanup pass requiring architectural rework not warranted in this PR scope.

## [PR #413 R13 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: OverallContent.tsx had inline `// status === 'done'` comment after `if (state.status !== 'done') return null;` guard
- Rule: MISTAKES.md Readability 2 — Guard clause already narrows type; post-guard comment stating the narrowed state is dead code
- Context: Removed comment; guard already establishes the invariant.

## [PR #413 R15 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: useAnalysis.ts: eslint-disable react-hooks/set-state-in-effect with poll useEffect pattern reverted to poll-async-IIFE + cooldown async-IIFE useEffect
- Rule: MISTAKES.md #13 — eslint-disable suppresses lint warnings instead of fixing root cause; restructure code to eliminate the warning
- Context: Partial React Query refactor reverted; poll/cooldown use async-IIFE patterns where setState happens inside callback, not synchronously in effect body. Pattern does not trigger rule because setState is wrapped in async callback scope.

## [PR #413 R17 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: usePageContextLabel() hook (containing useMemo) was between useQuery group and useMutation in useChat.ts hook ordering
- Rule: MISTAKES.md Components 17 — Hook order: useState/useRef → useQuery/useMutation → useCallback/useMemo → derived variables
- Context: Moved after useMutation group, before useMemo calculations with explanatory comment.

- Violation: NewsDisplayItem component name lacks clear semantic meaning for news object representation
- Rule: MISTAKES.md Components 11 — Function/interface names become inaccurate after architectural changes
- Context: Reviewed suggested renames (NewsPublicFields, NewsItemBase) but each has trade-offs without clear winner. Deferred for naming committee discussion (not blockers per blocker scope).

## [PR #413 R18 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: NewsDisplayItem.sentiment and .category were `string | null`, losing type safety
- Rule: MISTAKES.md TypeScript 7 — Using `as` type assertions instead of type guards; DB columns backed by domain enums must be cast at repository boundary
- Context: Now typed `NewsSentiment | null` / `NewsCategory | null` from @y0ngha/siglens-core with trust model comment in toNewsRow: "DB는 sentiment/category를 raw text로 저장하므로 LLM 결과를 신뢰해 좁혀준다."

## [PR #413 R19 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: SectorDirectionCard.tsx hardcoded literal "최근 30거래일 섹터 수익률" in JSX while using SPARKLINE_DAYS=30 constant
- Rule: MISTAKES.md Coding Paradigm 15 — Magic number drifts from constant when literal also hardcoded elsewhere
- Context: Replaced hardcoded literal with template string using constant: `최근 {SPARKLINE_DAYS}거래일 섹터 수익률`. Updated JSDoc to document JSX dependency.

- Violation: FundamentalAiSummary.tsx used `CATEGORY_LABEL[a.category] ?? a.category` as fallback after total Record lookup
- Rule: MISTAKES.md Predictability 2 — Dead code fallback when type system guarantees field presence
- Context: CATEGORY_LABEL is a total Record<FundamentalCategory, string> — the ?? branch never runs. Removed fallback.

- Violation: useChat.ts effect comment "Skip initial mount (prev === currentLabel on first run)" was misleading
- Rule: MISTAKES.md Readability 2 — Comment describing implementation detail instead of actual behavior
- Context: Updated to "Skip initial mount (prev is null on first render) or when label is unavailable" to match actual exit condition.

- Violation: earningsCalendarRepository.ts defined unused listForRange(from, to) method and test cases
- Rule: YAGNI — Infrastructure methods should land in PR that uses them, not pre-emptively
- Context: Removed method (never called from production), dropped unused between import, makeSelectOrderByDb mock, and 2 test cases. Cron and per-symbol use cases already covered by upsertMany and getNextForSymbol.



## [PR #416 | fix/wig-cleanup | 2026-05-04]
- Violation: SubmitButton.tsx had `focus-visible:ring-primary-500` without `focus-visible:ring-offset-2` / `ring-offset-{color}` while peer buttons in the same PR (DangerSubmitButton, error retry buttons, PasswordField toggle) all carried the offset pair
- Rule: WAI-ARIA keyboard accessibility — same-color ring on same-color background needs ring-offset for sufficient contrast; cross-component consistency
- Context: Added `focus-visible:ring-offset-secondary-900 focus-visible:ring-offset-2` to align with the form's AuthCardShell `bg-secondary-900/80` surrounding background.
