
# Fix Log




## [PR #545 Round 1 | fix/symbol-infra-fallback | 2026-06-02]
- Violation: 변수명 `mockGetAssetInfoCached`가 실제로는 `getAssetInfoResilient`를 참조 (2개 파일)
  - Rule: MISTAKES.md §11 — 함수/변수명은 실제 참조 대상과 정확하게 일치해야 한다
  - Context: PR #545에서 `getAssetInfoCached` → `getAssetInfoResilient`로 교체 후 테스트 변수명 rename이 누락됨

## [feat/bot-cost-caching Round 1 | feat/bot-cost-caching | 2026-05-28]
- Violation: 'use server' file exported non-async-function constants `POLL_INTERVAL_MS`, `POLL_MAX_ATTEMPTS`
  - Rule: entities/CONVENTIONS.md — 'use server' files may only export async functions; constants must live in separate modules
  - Context: Attempted to export constants in `ensureNewsCardsAnalyzedAction.ts` (a 'use server' file), caused Next.js error 71011. Corrected by moving constants to `lib/newsAnalysisConstants.ts` and importing them.

## [feat/bot-cost-caching Round 1 | feat/bot-cost-caching | 2026-05-28]
- Violation: Global `vi.mock('@upstash/redis', ...)` added to `vitest.setup.base.ts` when per-file mocks + resolve alias sufficed
  - Rule: Test best practices — Global mocks weaken test isolation; per-file mocks keep missing-mock failures visible
  - Context: Removed global mock to maintain test isolation and visibility of unintended missing dependencies.
## [PR #513 Round 1 | fix/fear-greed-ssr-and-fmp-retry | 2026-05-26]
- Violation: `page.tsx` prefetch 배열에 `.push()` 사용 — 배열 직접 변이
  - Rule: MISTAKES.md §5 — Array/object mutation via push/splice 금지
  - Context: 차트 페이지에서 조건부 prefetch를 추가할 때 spread 대신 push를 사용. spread 패턴으로 교체

## [PR #432 Round 4 | fix/cancel-job-on-page-unload | 2026-05-09]
- Violation: `route.ts` body validation used `!j.type` (falsy check only), allowing invalid type strings (e.g. `"unknown"`) to pass and silently return 204
  - Rule: Infrastructure Functions — validate all inputs at API boundaries; invalid values must return 400
  - Context: Added `VALID_JOB_TYPES` Set check so unrecognized job types are rejected with 400 rather than logged as a warning and treated as success

## [PR #546 Round 2 | fix/fear-greed-h1-dup | 2026-06-03]
- Status: APPROVED (both rounds, zero findings)
  - Review: Removed duplicate ticker in h1 (`AAPL` duplicated because displayName + explicit ticker append) across 4 spots (fear-greed/page.tsx: h1, FAQ JSON-LD, guide; [symbol]/page.tsx: sr-only)
  - Result: Clean merge — no violations logged

## [fix/market-summary-load-error-notice Round 2 | fix/market-summary-load-error-notice | 2026-06-03]
- Violation: `role="alert"` element (implicit `aria-live="assertive"`) nested inside `<section aria-live="polite">`, creating competing/overlapping live regions
  - Rule: WAI-ARIA best practices — Nested live regions with different urgency levels (assertive + polite) cause conflicting announcements
  - Context: Market notice alert nested in polite section. Moved `aria-live="polite"` off section to the data div instead, so alert sits outside and announces independently with assertive priority.

## [test/vitest-e2e-env-leak-cleanup Round 1 | test/vitest-e2e-env-leak-cleanup | 2026-06-03]
- Status: APPROVED (zero findings)
  - Review: Fixed non-deterministic CI vitest flake under `pool: 'vmThreads'`. vi.stubEnv() with default `unstubEnvs: false` leaked `E2E_TEST=1` into env-agnostic factory tests. Fix: `unstubEnvs: true` in vitest.config + global `afterEach` in vitest.setup.base.ts restoring `process.env.E2E_TEST` to its worker-start value.
  - Result: Clean merge — no violations logged

## [PR #562 Round 2 | worktree-verify-0.15-current | 2026-06-04]
- Violation: Manual markdown-notice seeds (priority 100) left in shared docker e2e DB masked 3 existing notice specs (priority 99) → wrong-data failures
  - Rule: MISTAKES.md E2E #2 — delete manual seeds after verification; leftover high-priority rows hide per-test seeds
  - Context: Deleted leftover seeds; re-run passed. Added cleanup step to docs/qa/QA_ENV_SETUP.md §7.
- Violation: Esc-advances-notice unit test flaked only on CI (vmThreads) — keyDown fired before useEscapeKey passive-effect listener attached
  - Rule: MISTAKES.md Tests #19 — await a same-effect-batch sibling (dialog focus) before dispatching; do not blind-bump timeouts
  - Context: Added `waitFor(() => dialog toHaveFocus)` before `fireEvent.keyDown`. Local single + full suite (4887 tests) already green; targeted the race, not the timeout.

## [PR #564 | fix/fmp-cache-and-earnings-gate | 2026-06-04]
- Violation: Redis 캐시 키(buildBarsRawKey)가 GetBarsOptions의 일부 필드만 포함(limit 누락) → 옵션 확장 시 서로 다른 요청이 같은 캐시를 반환할 충돌 위험
  - Rule: (신규) 캐시 키는 결과에 영향을 줄 수 있는 모든 입력 필드를 포함해야 한다 (cache key must cover every result-affecting input field)
  - Context: CachedMarketDataProvider.buildBarsRawKey에 limit 포함(Gemini 리뷰 반영). limit은 timeframe 종속이라 분할 없이 미래 충돌만 방지. (B1 entities/lib Date.now() 순수함수 위반은 MISTAKES §Architecture #0.7 / Tests #14에 이미 문서화되어 기록 생략.)
- Violation: getNextEarningsReport가 entities/lib에서 side effect(Date.now/DB/FMP) 포함 — 순수 함수 레이어 위반 (pre-existing, R3 Blocker)
  - Rule: MISTAKES §Architecture #0.7 — entities/{slice}/lib/는 순수 함수 전용
  - Context: PR #564 R3 claude 리뷰에서 Blocker로 지적. pre-existing이라 별도 PR로 분리(이슈 #565). nextEarningsReport.ts JSDoc에 TODO(#565) 링크를 남겨 추적. 이번 PR diff엔 미수정(scope = 캐시/gate).

## [PR #589 Round 9 | feat/indicator-modal-grid-persist | 2026-06-12]
- Violation: DOM-count assertion used `expect(document.querySelector('.col-span-2')).toBeInTheDocument()` where element count is deterministic (exactly 1 ma binding = exactly 1 col-span-2 wrapper)
  - Rule: MISTAKES.md §Tests §13 — DOM assertions on deterministic counts must use exact count matcher, not existence check
  - Context: Modal grid bind test; fixture produces exactly 1 ma binding row → exactly 1 col-span-2 wrapper. Changed to `expect(document.querySelectorAll('.col-span-2').length).toBe(1)` for correctness and future-proofing against accidental duplicates.

## [feat/economy-page Round 2 | feat/economy-page | 2026-06-16]
- Violation: Two new application helpers `peekMacroBriefingCache`, `macroBriefingInputHash` shipped WITHOUT colocated test files
  - Rule: MISTAKES.md §Tests §22 — Pure/helper functions incomplete test coverage — missing unit tests entirely
  - Context: Both helpers were mirrors of market-briefing originals (which have dedicated test suites). New copies lacked tests, leaving graceful-degrade catch paths and calendar-sort tiebreak unexercised. Fixed by adding `__tests__/macbroBriefing.test.ts` with all branches ≥90% coverage.
- Violation: Coverage verification in pre-review step used `yarn test` (vitest run) which exits 0 even if thresholds fail
  - Rule: (KEY LESSON) test coverage thresholds (90% lines/functions/branches/statements) only enforced by `yarn test-coverage` (vitest run --coverage); `yarn test` bare run skips gate
  - Context: Pre-review step reported coverage OK via `yarn test` with no-op exit. Only `test-coverage` applies the gate. Lesson: always verify coverage with `test-coverage` flag before review submission.
- Status: Round 2 APPROVED (zero findings after test additions)

## [feat/economy-page Round 3 (Audit Follow-up) | feat/economy-page | 2026-06-17]
- Status: Post-APPROVED 5-audit deep-dive exposed gaps not caught in 7 review rounds
- Violations: 11 total fixed
  - Rule Pattern: **New top-level page routes ship without sitemap + internal-link + SSR-proxy coverage** — recurring across multi-round PRs
  - P0 Orphan Page Fixes (Audits 1,2):
    1. `/economy` missing from static sitemap (`buildStaticEntries.ts`) — added entry
    2. Footer internal link to `/economy` missing — added link in Footer.tsx
  - P1 Crawl Coverage Fix (Audit 5):
    3. EconomyMacroFacts component shipped as client-only bridge to MacroBriefing — crawlers see empty skeleton. Added SSR text-proxy (mirrors SectorFactsSummary pattern)
  - Test Coverage Audit (Audit 5):
    4. `EconomicIndicatorGrid.test.tsx` missing 2s10s negative spread test case
    5. `DeltaBadge.test.tsx` missing floating-point 0-case edge test
    6. NEW `src/app/economy/__tests__/page.test.tsx` integration test: degrade/metadata/peek-throw paths
  - E2E Gaps (Audit 5):
    7. `e2e/specs/economy.spec.ts` added: MacroBriefing mount + bot UA + mobile 3-viewport scenarios
  - P2 SEO/Metadata Refinements (Audit 4):
    8. JSON-LD `dateModified` missing — added field
    9. degraded state: `alternates: { canonical: null }` + `robots.follow: true` (was default-missing)
    10. h1 duplicated in 2 places — refactored to shared `EconomyHeroH1` component
    11. keywords enhanced with domain-specific terms (`2s10s 스프레드`, `10년물 국채 금리`)

### Recurring Pattern Analysis (for MISTAKES.md promotion)

**Pattern: Multi-audit consensus on top-level page route gaps**
- Evidence: feat/economy-page (3 audits needed for completeness) + implicit history from fix-log
- Recurring rule: PR APPROVED + review-agent clean does NOT mean ready-to-merge for new pages
- Gap classes: (1) sitemap/discoverability, (2) internal navigation, (3) SSR/bot crawl coverage, (4) test integration, (5) SEO metadata
- Lesson: **Post-APPROVED pages require fresh-context seo-audit + coverage-audit before merge.** Shipping orphan top-level routes is a systemic miss.

**Checking fix-log history for prior sitemap omissions...**
- PR #546 (fear-greed, 2026-06-03): h1 dedup fix — APPROVED clean, no audit follow-up logged
- PR #513 (fmp-retry): chart page — no top-level route mentioned
- No prior sitemap omission explicitly logged (economy-page appears to be first time this specific gap pattern surfaced at scale)

**Decision:** Promote to MISTAKES.md as new rule under Architecture/SEO section: "New pages at top-level routes (app/) must include sitemap entry, internal nav link, SSR-proxy (if component-bridge), SEO metadata, + integrated test before merge. seo-audit + coverage-audit are mandatory post-approval."



