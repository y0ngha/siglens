# Fix Log

## [PR #420 Round 13 | master | 2026-05-05]
- B1: `finalizeOAuthSignupAction.test.ts` — `if (!created) { throw new Error('createOAuthUser returned null') }` branch inside transaction not covered. Added test that overrides MockUserRepo to return null from createOAuthUser and asserts redirect to /login?error=service_unavailable (MISTAKES.md Infrastructure §2 — 100% branch coverage).
  - Rule: MISTAKES.md Infrastructure §2 — 100% branch coverage
- S1: `finalizeOAuthSignupAction.test.ts` — SAMPLE_TERMS_P/T fixtures had `createdAt: new Date()` which is not a field in TermsRecord interface. Removed `createdAt` from both fixtures.
  - Rule: MISTAKES.md Tests §2 — mock keys must match actual return type
- S2: `db/scripts/seedTerms.ts` — sequential for...of + await loop for independent upsertFromSeed calls. Converted to Promise.all(seeds.map(async seed => { ... })) for parallel execution (MISTAKES.md §5 — prefer declarative patterns).
  - Rule: MISTAKES.md §5 — prefer declarative patterns over imperative loops

## [PR #420 Round 12 | master | 2026-05-05]
- B1: `ConsentCheckboxGroup.test.tsx` — test queries `getByRole('alert')` but component now renders `role="status"`; test would fail at runtime (MISTAKES.md Tests §1 — test must sync with implementation). Changed query to `getByRole('status')` and updated test description accordingly.
  - Rule: MISTAKES.md Tests §1 — test must sync with implementation
- S1: `OAuthConsentForm.test.tsx` — `jest.mock('@/infrastructure/auth/cancelOAuthSignupAction', ...)` is dead; OAuthConsentForm receives cancelAction as a prop, never imports the action. Removed the unnecessary mock.
  - Rule: MISTAKES.md §4 — Remove logic/code that has no effect (dead code)
- S2: `route.ts` ([provider] callback) — 3 WHAT-comments (`Existing OAuth account → immediate login`, `Email already registered`, `New user →`) violate CLAUDE.md comment policy; code already expresses intent. Removed all 3 comments.
  - Rule: CLAUDE.md comment policy — comments should explain WHY, not WHAT (code expresses WHAT)

## [PR #420 Round 11 | master | 2026-05-05]
- B1: `cancelOAuthSignupAction.ts` — entire action body not wrapped in outer try-catch; unexpected exceptions would propagate to client (MISTAKES.md §0.7). Wrapped in outer try-catch; re-throws NEXT_REDIRECT, falls back to redirect('/login') for other errors.
  - Rule: MISTAKES.md §0.7 — Server Actions must catch all throws, never propagate to client
- B2: `ConsentCheckboxGroup.tsx` — `role="alert"` + `aria-live="polite"` conflict; role="alert" implicitly sets aria-live="assertive", creating unpredictable screen reader behavior. Changed to `role="status"` (keeps explicit aria-live="polite").
  - Rule: ARIA semantics — role="alert" conflicts with explicit aria-live="polite"
- B3: `ConsentCheckboxGroup.tsx` — error `<p>` had no `id`; invalid checkboxes had no `aria-describedby` connection to error message. Added `const errorId = useId()`, `id={errorId}` on error element, `errorId` prop on ConsentRow, `aria-describedby: errorId` on checkbox inputs.
  - Rule: ARIA accessibility — form inputs with errors must have aria-describedby pointing to error message
- S1: `route.ts` ([provider] callback) — `let token; try { token = await ... } catch { return ... }` imperative pattern (MISTAKES.md §14). Replaced with declarative `const token = await pendingStore.save({...}).catch(() => null); if (!token) return ...`
  - Rule: MISTAKES.md §14 — Imperative exception handling within try-catch should use declarative .catch() or ?. chains
- S2: `usePageShowReload.ts` moved from `src/components/auth/hooks/` to `src/components/hooks/` (generic bfcache hook placed in auth feature subfolder instead of global hooks dir, MISTAKES.md Components §15). Updated import in OAuthConsentForm.tsx.
  - Rule: MISTAKES.md Components §15 — Feature-agnostic utilities belong in global directories, not feature-specific subdirs
- S3: `seedTerms.ts` — imperative `for (let i = 0; ...)` index loop for version gap detection. Replaced with declarative `findIndex` pattern.
  - Rule: MISTAKES.md §5 — Declarative patterns (map, filter, reduce, findIndex) preferred over imperative loops

## [PR #420 Round 10 | master | 2026-05-05]
- B1: `ConsentCheckboxGroup.tsx` — `text-white` raw Tailwind color used for checkmark SVG icon. MISTAKES.md §0.5 prohibits raw color references. Changed to `text-secondary-50` (design system semantic token).
  - Rule: MISTAKES.md §0.5 — Use design system semantic tokens, not raw Tailwind colors
- B2: `registerAction.test.ts` — 2 occurrences of `expect.anything()` as second argument in `toHaveBeenCalledWith()`. MISTAKES.md Tests §15/§16 forbids `expect.anything()`. Replaced with `expect.objectContaining({ emailTokens: expect.objectContaining({...}), db: expect.objectContaining({...}) })`. Also moved `agreedTermsIds` test from `'입력 정규화'` describe block to new `'약관 ID 전달'` describe block (correct category).
  - Rule: MISTAKES.md Tests §15/§16 — forbids `expect.anything()` in assertion
- B3: `termsRepository.test.ts` — `InsertedRow.kind: 'privacy' | 'tos'` inline union instead of named type. MISTAKES.md TypeScript §5/§5.2 requires named type alias. Added `import type { TermsKind }` and changed to `kind: TermsKind`.
  - Rule: MISTAKES.md TypeScript §5/§5.2 — inline union literals should use named type aliases
- S1: `pendingOAuthSignupStore.ts` — object literal methods missing explicit return type annotations. Added explicit return types to all 4 methods (save, peek, consume, delete).
  - Rule: MISTAKES.md §0 — explicit return type annotations for methods
- S2: `legal-toc.test.ts` — missing test for github-slugger duplicate slug deduplication behavior. Added test verifying -1, -2 suffix for repeated headings.
  - Rule: Test coverage — slug deduplication is internal utility behavior and should have dedicated test

## [PR #420 Round 9 | master | 2026-05-05]
- M1: `registerAction.ts` — catch block returned `service_unavailable` without logging unexpected runtime errors, making debugging difficult. Added `console.error('[registerAction] unexpected error:', err)` before returning error.
  - Rule: Error logging in catch blocks — debugging requires visibility into root causes
- M2: `finalizeOAuthSignupAction.ts` — transaction .catch() and outer catch block redirected to serviceUnavailable without logging, making root cause analysis impossible. Added `console.error('[finalizeOAuthSignupAction] transaction failed:', err)` in .catch() and `console.error('[finalizeOAuthSignupAction] unexpected error:', err)` in outer catch.
  - Rule: Error logging in catch blocks — debugging requires visibility into root causes

## [PR #420 Round 8 | master | 2026-05-05]
- B1: `tryParse` catch 분기 미테스트 — `pendingOAuthSignupStore.test.ts`에 corrupted JSON 케이스 추가.
  - Rule: MISTAKES.md Infrastructure §2 — 100% branch coverage
- B2: `termsRepository.test.ts` mock row `effective_date`(snake_case) → `effectiveDate`(camelCase) 수정, `findActive` 성공 케이스에 `effectiveDate` 검증 추가.
  - Rule: MISTAKES.md Tests §2 — mock 키가 실제 반환 타입과 일치해야 함
- B3: `registerAction.test.ts` `expect.anything()` → `expect.objectContaining({ emailTokens, db })` 명시 검증. db mock에 `transaction` 함수 추가.
  - Rule: 의존성 주입 검증 — db 인자 포함 여부 명시

## [PR #420 Round 7 | master | 2026-05-05]
- B1/B2/B3: `isSecureCookieEnv()` 동일 함수 내 2회 중복 호출 — `finalizeOAuthSignupAction.ts`, `registerAction.ts`, `route.ts` 세 파일 모두 `const secure = isSecureCookieEnv()`로 추출 후 재사용.
  - Rule: MISTAKES.md §2 — 동일 함수 내 중복 호출 금지

## [PR #420 Round 6 | master | 2026-05-04]
- B1: `formatKoreanDate` 타임존 버그 — `getFullYear/Month/Date`는 프로세스 로컬(UTC) 기준이라 KST 날짜가 하루 밀림. `Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul' })`로 교체.
  - Rule: 서버 UTC 환경에서 로컬 날짜 API 금지
- B2: `PolicySection.tsx`의 `export type { TocItem }` backward-compat re-export 제거. `LegalPageShell.tsx`가 `@/lib/legal-toc`에서 직접 import하도록 변경.
  - Rule: CLAUDE.md — 역호환 re-export 금지
- S1: `consume` 비원자적 get+del → `client.getdel()` 단일 원자 연산으로 교체. 테스트 mock에 `getdel` 추가.
- S2: `[WebkitTapHighlightColor:transparent]` → `[-webkit-tap-highlight-color:transparent]` (Tailwind arbitrary 벤더 접두사 소문자 하이픈)

## [PR #420 Round 5 | master | 2026-05-04]
- B1: `OAuthConsentForm.tsx` — `formError` dead code 제거. `FinalizeOAuthSignupState.error.code`가 `'consent_required'` 리터럴이므로 `!== 'consent_required'` 조건은 항상 false. `formError` 변수·`AuthErrorAlert` 블록 제거.
  - Rule: MISTAKES.md §4 — Remove logic/code that has no effect
- S1: `finalizeOAuthSignupAction.ts` — 소비처 없는 `export type { FinalizeOAuthSignupState }` re-export 제거 (YAGNI).

## [PR #420 Round 4 | master | 2026-05-04]
- B2: `cancelOAuthSignupAction.test.ts` 분기 미테스트 — store null 케이스, store.delete() throw 케이스 두 테스트 추가.
  - Rule: MISTAKES.md Infrastructure §2 — 100% branch coverage

## [PR #420 Round 3 | master | 2026-05-04]
- B1: `OAuthConsentForm.tsx` had `import type { cancelOAuthSignupAction } from '@/infrastructure/auth/cancelOAuthSignupAction'` — component `.tsx` files cannot import from infrastructure even with `import type`. Replaced `typeof cancelOAuthSignupAction` with explicit `(formData: FormData) => Promise<void>` signature, removed the import.
  - Rule: MISTAKES.md Architecture §0 — component .tsx: infrastructure import prohibited (including `import type`)
- S1: `route.ts` GET handler — `pendingStore.save()` not wrapped in try-catch. Redis failure would cause unhandled 500. Wrapped in try-catch, redirects to `oauth_unknown` on failure (consistent with existing error handling pattern).

## [PR #420 Round 2 | master | 2026-05-04]
- B3: `ParsedSeed.kind` inline union literal `'privacy' | 'tos'` — should use `TermsKind` named alias from `constants.ts` for single source of truth.
  - Rule: MISTAKES.md §5.2 — inline union literals should use named type aliases
- S1: Replaced custom `slugify` in `legal-toc.ts` with `github-slugger` (already transitive dep). Added `transformIgnorePatterns` to `jest.config.js` to handle ESM-only package.

## [PR #420 Round 1 | master | 2026-05-04]
- B2: `finalizeOAuthSignupAction` missing outer try-catch — MISTAKES.md Coding Paradigm 0.7 (Server Actions must catch all throws, never propagate to client). Wrapped full body; re-throws NEXT_REDIRECT, redirects on other errors.
  - Rule: MISTAKES.md Coding Paradigm 0.7 — Server Actions must catch all throws
- B3: `CheckboxBoxProps` defined inline in component parameter — MISTAKES.md Components 13 requires named interface declared above component. Extracted interface above `CheckboxBox`.
  - Rule: MISTAKES.md Components 13 — props interfaces must be named and declared above component
- B5: `seedTerms.ts` used `list.push()` (array mutation) — MISTAKES.md §5 prohibits array mutation via push. Changed to spread: `[...list, seed.version]`.
  - Rule: MISTAKES.md §5 — no array mutation via push
- B6: `[...versions].sort()` — spread was unnecessary since `toSorted()` doesn't mutate. Changed to `versions.toSorted()`.
- B7: `legal-toc.ts` used imperative `for + push` — refactored to declarative `map`.
- B8: `OAuthConsentForm.tsx` had inline `useEffect` for pageshow event — MISTAKES.md Components 7 requires DOM event listeners in useEffect to be extracted to custom hooks. Extracted to `usePageShowReload` hook.
  - Rule: MISTAKES.md Components 7 — DOM event listeners in useEffect must be extracted to custom hooks
- Fix: `consent/page.tsx` had `export const dynamic = 'force-dynamic'` incompatible with `cacheComponents: true`. Removed — searchParams already makes page dynamic.
- Fix: `privacy/page.tsx`, `terms/page.tsx` — DB access in async page component triggers "Uncached data outside Suspense" with `cacheComponents: true`. Split into inner async components wrapped in Suspense.

## [PR #417 Round 6 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: \`@type: 'FinancialProduct'\` JSON-LD 의미 부적합 — schema.org/FinancialProduct는 대출/카드/보험 등 금융 상품 자체용이고 주식 분석 서비스에는 맞지 않음. WebPage about.Corporation으로 이미 금융 entity 신호 제공 중이라 중복.
- Rule: schema.org type semantic 정합성
- Context: P2.1에서 추가됐으나 WebPage about.Corporation으로 충분. 안전하게 제거 (Service로 교체할 수도 있으나 about.Corporation과 정보가 중복되어 가치 적음).

## [PR #417 Round 5 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: 워크트리 \`CLAUDE.md\` 갱신 누락 — R4 fix-log에 갱신 완료로 기재되어 있으나 실제로는 main 레포의 CLAUDE.md만 수정되어 있고 워크트리의 같은 파일은 옛 내용("infrastructure ← May import from domain only")을 그대로 갖고 있었다
- Rule: 변경 사항은 실제 commit 대상(워크트리)의 파일에 적용해야 함
- Context: R4에서 절대경로로 \`/Users/y0ngha/Project/siglens/CLAUDE.md\`(메인 레포)를 수정해 워크트리의 같은 파일은 미반영. 워크트리의 \`CLAUDE.md\`도 동일하게 \"May import from domain and lib (lib must be pure utilities/constants only)\"로 갱신.

## [PR #417 Round 4 | worktree-seo-overhaul-49 | 2026-05-04]
- Doc policy update (REJECTED B1 → 문서 수정으로 처리): `infrastructure ← lib` 금지 규칙 완화
- Rule: ARCHITECTURE.md, CLAUDE.md(root), src/lib/CLAUDE.md 일괄 갱신
- Context: lib/og.ts에 색상/레이아웃 순수 상수만 두고 사이드 이펙트 함수(loadKoreanFont)는 R2에서 이미 infrastructure로 옮겼다. 그러나 색상 상수는 lib에 남아 infrastructure(buildSymbolOgImage.tsx)에서 import해야 했고, 이는 기존 "infrastructure ← domain only" 규칙 위반. 사용자 결정으로 규칙을 "infrastructure ← domain + lib (lib must be pure utilities/constants only)"로 명시 완화. 단 cross-layer 타입은 여전히 domain/types.ts에만 두기로 유지(hook 측 import 경로 보호).

- Doc policy clarification (REJECTED B3 → 문서 수정으로 처리): MISTAKES.md #0 적용 범위 명시
- Rule: MISTAKES.md #0 (Non-component function or Route Handler missing explicit return type)
- Context: 사용자 의도는 "순수 함수/로직 함수"의 반환 타입 명시였고, Next.js 파일 컨벤션(page.tsx, layout.tsx, opengraph-image.tsx, sitemap.ts, robots.ts, manifest.ts 등)은 Next가 시그니처를 보장하므로 예외라는 점을 문서화. 룰 제목과 본문 모두 "Pure function or logic-bearing function" + 예외 목록으로 갱신.

- Suggestion S2 적용: SymbolPageClient bottomSlot 주석 WHAT → WHY로 교체
- Rule: 주석은 코드로 자명하지 않은 이유를 적는다
- Context: "차트 컨테이너 아래에 렌더" → "서버 컴포넌트가 SEO용 cross-link를 주입하기 위한 슬롯".

## [PR #417 Round 3 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: backtesting/page.tsx 면책 고지가 `<aside>`로 감싸져 있어 ARIA `complementary` role이 적용 — 면책 고지는 보완 콘텐츠가 아니라 필수 법적 노트
- Rule: ARIA semantics — `<aside>`는 제거해도 메인 콘텐츠 이해에 지장이 없는 보완 콘텐츠 전용
- Context: P4.6에서 `<footer>` → `<aside>`(글로벌 Footer landmark 중복 회피) 변경. R1 reviewer가 footer 원복 권고 → 거절(글로벌 Footer 충돌). R3 reviewer가 `<div role="note" aria-label>` 옵션 제시. 두 우려 모두 해소되는 third path를 채택.

- Violation: overall/page.tsx 인트로 `<section>`에 accessible name 없음 — 스크린 리더 랜드마크 탐색에서 generic으로 처리
- Rule: ARIA — `<section>`은 aria-labelledby로 접근 가능 이름이 명시되어야 랜드마크로 인식
- Context: P1.1에서 visible static SEO 콘텐츠 블록을 `<section>`으로 추가. 내부 `<h2>`에 id 부여하고 `<section aria-labelledby>`로 연결.

## [PR #417 Round 1 | worktree-seo-overhaul-49 | 2026-05-04]
- Violation: schema.org `Article.datePublished` set to `new Date().toISOString()` (request time) — Googlebot interprets every crawl as a fresh publication
- Rule: schema.org Article semantics — `datePublished` is original publication time, not request time; for content updates use `dateModified`
- Context: Added during P3.1 (news Article JSON-LD). Replaced with `SITE_BUILD_DATE.toISOString()` for `datePublished` and kept `new Date().toISOString()` as `dateModified` (background card analysis genuinely changes per request). Promoted `SITE_BUILD_DATE` to `@/lib/seo` so news/page.tsx and sitemap.ts share one source instead of duplicating `parseBuildDate`.

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

## [PR #413 R8 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: SymbolTabsSkeleton.tsx nav element had both `aria-hidden="true"` and `aria-label="분석 종류"`
- Rule: MISTAKES.md Accessibility 1.5 — aria-hidden removes element from a11y tree; aria-label on hidden element is meaningless
- Context: Removed aria-label since aria-hidden="true" already hides from screen readers.


## [PR #413 R10 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: FinancialHealthCard had nested ternary (3 levels) for conditional BadgeVariant class assignment
- Rule: MISTAKES.md Coding Paradigm 7 — Nested ternaries 3+ times; extract to helper or declarative map
- Context: Replaced with `BADGE_VARIANT_CLASS: Record<BadgeVariant, string>` object map + extracted `BadgeVariant` type alias per CONVENTIONS.md declarative paradigm.


## [PR #413 R12 | feat/fundamental-news-analysis | 2026-05-03 — Deferred]
- Question: Hooks importing infrastructure (useFundamentalAnalysis, useNewsAnalysis, useOverallAnalysis, useNewsAugment)
- Rule: CLAUDE.md hook→infrastructure imports limited to queryFn/mutationFn or useActionState Server Action connection
- Context: Current code uses useEffect polling state machines instead of Server Action callback. Architecture sufficient for async job-poll pattern (polling model was intentional design choice for stale background analysis). Deferred to separate cleanup pass requiring architectural rework not warranted in this PR scope.

## [PR #413 R15 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: useAnalysis.ts: eslint-disable react-hooks/set-state-in-effect with poll useEffect pattern reverted to poll-async-IIFE + cooldown async-IIFE useEffect
- Rule: MISTAKES.md #13 — eslint-disable suppresses lint warnings instead of fixing root cause; restructure code to eliminate the warning
- Context: Partial React Query refactor reverted; poll/cooldown use async-IIFE patterns where setState happens inside callback, not synchronously in effect body. Pattern does not trigger rule because setState is wrapped in async callback scope.

## [PR #413 R18 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: NewsDisplayItem.sentiment and .category were `string | null`, losing type safety
- Rule: MISTAKES.md TypeScript 7 — Using `as` type assertions instead of type guards; DB columns backed by domain enums must be cast at repository boundary
- Context: Now typed `NewsSentiment | null` / `NewsCategory | null` from @y0ngha/siglens-core with trust model comment in toNewsRow: "DB는 sentiment/category를 raw text로 저장하므로 LLM 결과를 신뢰해 좁혀준다."



## [PR #416 | fix/wig-cleanup | 2026-05-04]
- Violation: SubmitButton.tsx had `focus-visible:ring-primary-500` without `focus-visible:ring-offset-2` / `ring-offset-{color}` while peer buttons in the same PR (DangerSubmitButton, error retry buttons, PasswordField toggle) all carried the offset pair
- Rule: WAI-ARIA keyboard accessibility — same-color ring on same-color background needs ring-offset for sufficient contrast; cross-component consistency
- Context: Added `focus-visible:ring-offset-secondary-900 focus-visible:ring-offset-2` to align with the form's AuthCardShell `bg-secondary-900/80` surrounding background.

## [Phase 7 OAuth Consent Flow | Spec compliance R2 | 2026-05-04]
- Violation: finalizeOAuthSignupAction.ts variable `let createdUserId` may be uninitialized from TypeScript perspective when returned
- Rule: MISTAKES.md Coding Paradigm 0 — Non-null return type implies value is always assigned; use const + ternary/null coalescing
- Context: Must guarantee createdUserId is assigned before return in all code paths.


## [Phase 7 OAuth Consent Flow | Code quality R1 | 2026-05-04]
- Violation: route.ts cast comment inaccurate — stated narrowing was "isOAuthProvider narrows profile.provider" when actually narrowing URL param
- Rule: Narrowing guard comments must accurately describe which variable is being constrained
- Context: Comment should explain that isOAuthProvider checks the URL param, not a profile field.

