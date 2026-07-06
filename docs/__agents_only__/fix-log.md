
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

## [feat/skill-card-expand-description | AI 분석 스킬 카드 클릭-확장 기능 | 2026-06-22]
- Violation: Nested interactive control (ⓘ button) inside `role="button"` card container; card's `handleKeyDown` preventDefault suppressed button's native keyboard activation (Enter/Space)
  - Rule: Accessibility — Interactive controls nested in role="button" containers must not have their keyboard events hijacked by parent onKeyDown handlers
  - Context: SkillCardExpandable renders an info icon as a nested `<button>` inside a `<div role="button">`. The card's onKeyDown handler used preventDefault without guarding, which blocked the nested button's Enter/Space activation. Fixed by adding `if (e.target !== e.currentTarget) return;` to handleKeyDown, allowing events from nested interactives to bubble normally.

## [feat/ticker-search-relevance Round 2 | feat/ticker-search-relevance | 2026-06-23]
- Violation: JSDoc claimed "matched in DB somehow" for ticker search candidates, but the function is called from multiple contexts where the behavior differs or the claim does not hold
  - Rule: MISTAKES.md §15.6 — Comments/JSDoc making factually inaccurate claims about the code they describe
  - Context: searchTickersByRelevance JSDoc made a narrow claim about DB behavior that didn't account for all call sites. Removed the inaccurate claim; JSDoc now describes only what is universally true across all callers.

## [feat/ticker-search-relevance Round 2 | feat/ticker-search-relevance | 2026-06-23]
- Violation: Pure calculation helper used imperative for...of + mutable accumulators instead of declarative map/filter/reduce
  - Rule: MISTAKES.md §21 — Pure calculation functions using imperative for-loop + push instead of higher-order functions
  - Context: computeRelevanceScores iterated with for...of and pushed results into accumulator array. Refactored to use .map() for clarity and immutability.

## [feat/aws-infra Round 1 | feat/aws-infra | 2026-06-24]
- Violation: SSM env-vars written to /run (tmpfs) only at cloud-init → lost on OS reboot → container crash-loop
  - Rule: Infrastructure Functions — Runtime configuration must survive OS restart; ephemeral storage invalid for persistent config
  - Context: user-data.sh saved SSM env to /run only. Fixed: added systemd ExecStartPre to re-fetch from SSM before container start, ensuring config persists across reboots.
- Violation: workflow_dispatch trigger on restricted GitHub Actions OIDC trust (scoped to refs/tags/v*) → fails with 403
  - Rule: OIDC trust scope must match all intended workflow trigger patterns; workflow_dispatch incompatible with tag-scoped trust
  - Context: deploy.yml workflow_dispatch would fail because GitHub OIDC trust restricted to release tags. Removed workflow_dispatch; only refs/tags/v* remains in trigger scope.
- Violation: sed delimiter collision — `sed s/__IMAGE_TAG__/$TAG/` breaks when tag contains '/' (e.g., v2/aws-migration)
  - Rule: Shell utilities — sed delimiter must be chosen to avoid collision with variable content; '|' preferred for paths
  - Context: 05-launch-template.sh used forward-slash delimiter with tag variable that may contain forward-slashes. Changed to '|' delimiter for safety.
- Violation: IAM role Resource:* overly broad without resource condition guards
  - Rule: AWS IAM — Resource:* requires compensating conditions (kms:ViaService, effect narrowing); unconditional wildcards violate least-privilege
  - Context: kms:Decrypt Resource:* scoped via kms:ViaService=ssm condition (ci-deploy + ec2 role). Constraint prevents lateral key access across other services.

## [PR #668 | feat/skill-prompt-digests | 2026-07-03]
- Violation: `splitFrontmatter` split raw file content on `\n` only; a CRLF-line-ended skill file would leave a trailing `\r` on each split line, making `digest_hash`/`token_cost` computation platform-dependent
  - Rule: (new) File-content parsing that feeds a hash/fingerprint must normalize line endings before splitting, so the fingerprint is stable across platforms/editors
  - Context: Fixed by normalizing `content.replace(/\r\n/g, '\n')` inside `splitFrontmatter` — the single parse entry point every caller (verify, update-meta, tests) funnels through. Added a CRLF-vs-LF fixture-parity unit test. No-op for existing LF files (verified: `yarn skills:digest-verify` still reports 80/80 clean, unchanged).


