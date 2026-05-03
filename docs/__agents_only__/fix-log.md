# Fix Log

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
- Violation: ProfileCard.tsx, ProfitabilityCard.tsx, SectorDirectionCard.tsx had multi-line JSDoc blocks for component purpose description
- Rule: MISTAKES.md Documentation Sync 4 — Multi-line JSDoc blocks for single-line function descriptions; component names already self-explanatory
- Context: Compressed to single-line or removed. Pattern recurring 13th+ consecutive round.

- Violation: usePageContextLabel() hook (containing useMemo) was between useQuery group and useMutation in useChat.ts hook ordering
- Rule: MISTAKES.md Components 17 — Hook order: useState/useRef → useQuery/useMutation → useCallback/useMemo → derived variables
- Context: Moved after useMutation group, before useMemo calculations with explanatory comment.

- Violation: NewsDisplayItem component name lacks clear semantic meaning for news object representation
- Rule: MISTAKES.md Components 11 — Function/interface names become inaccurate after architectural changes
- Context: Reviewed suggested renames (NewsPublicFields, NewsItemBase) but each has trade-offs without clear winner. Deferred for naming committee discussion (not blockers per blocker scope).

- Violation: toGradesAction in fundamentalClient.ts is module-private but had @internal JSDoc tag
- Rule: MISTAKES.md Documentation Sync 3 — @internal inconsistent with visibility (not exported yet marked internal)
- Context: Removed @internal, kept description; function is internal via scope (no export), not via documentation.

- Violation: useOverallAnalysis hardcoded "1분" in error message instead of computed from MAX_DEPENDENCY_RETRIES * poll interval
- Rule: MISTAKES.md Coding Paradigm 15 — Hardcoded literals in messages; values out of sync when constants change
- Context: Changed to `${Math.round((MAX_DEPENDENCY_RETRIES * AUGMENT_AND_OVERALL_POLL_INTERVAL_MS) / 1000)}초` computed from constants.

- Violation: SectorDirectionCard had `const N = 30` magic number for sparkline days
- Rule: MISTAKES.md Coding Paradigm 15 — All magic numbers extracted to named constants
- Context: Extracted to module-level `SPARKLINE_DAYS = 30` with JSDoc.

- Violation: `[...Array(N)]` magic number patterns across 6 loading.tsx and skeleton files
- Rule: MISTAKES.md Coding Paradigm 15 — Named constants for render-count magic numbers
- Context: Each file extracted local constants: SKELETON_LINE_COUNT (3 files: 3 lines), SKELETON_SECTION_COUNT (3 loading.tsx files: 6/5/3 sections).

## [PR #413 R18 | feat/fundamental-news-analysis | 2026-05-03]
- Violation: NewsDisplayItem.sentiment and .category were `string | null`, losing type safety
- Rule: MISTAKES.md TypeScript 7 — Using `as` type assertions instead of type guards; DB columns backed by domain enums must be cast at repository boundary
- Context: Now typed `NewsSentiment | null` / `NewsCategory | null` from @y0ngha/siglens-core with trust model comment in toNewsRow: "DB는 sentiment/category를 raw text로 저장하므로 LLM 결과를 신뢰해 좁혀준다."

- Violation: 17+ @internal tags on exported interfaces in src/infrastructure/fmp/types.ts
- Rule: MISTAKES.md Documentation Sync 3 — @internal contradicts export visibility; exported symbols are consumable
- Context: Removed all @internal tags via sed. Mass occurrence in single file; RawFmpPriceTargetPeriod (non-exported) @internal also removed for consistency.

- Violation: @internal tag on non-exported interface NewsDbRow in src/infrastructure/db/newsRepository.ts
- Rule: MISTAKES.md Documentation Sync 3 — @internal redundant when function/type is already module-private by scope
- Context: Removed tag, kept description. Same precedent as R17 (toGradesAction).

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


