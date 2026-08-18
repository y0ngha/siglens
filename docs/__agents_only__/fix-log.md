
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

## [PR #678 | agent/seo-index-quality-gate | 2026-07-08]
- Violation: Central symbol indexability gate was applied only to the chart page metadata while sibling symbol routes could still emit indexable metadata for unapproved longtail symbols.
  - Rule: SEO metadata must stay consistent across route variants that represent the same crawlable entity.
  - Context: Added a shared app-level metadata helper and wired it into chart, news, fundamental, options, overall, fear-greed, financials, and congress metadata.

## [PR #678 | agent/seo-index-quality-gate | 2026-07-08]
- Violation: Codex hook configuration hardcoded the author's absolute local project path.
  - Rule: Repository tooling must not depend on contributor-specific absolute paths.
  - Context: Replaced the hook command with a repository-relative path so the checked-in hook works outside the author's machine.

## [PR #678 | agent/seo-index-quality-gate | 2026-07-08]
- Violation: The checked-in exit-signal hook allowlist omitted newly added agent names.
  - Rule: Tooling allowlists must be updated atomically with the agents they validate.
  - Context: Added `issue-agent` and `mistake-managing-agent` to `KNOWN_AGENTS` so their valid exit signals are accepted.


## [PR #690 | claude/mobile-ai-analysis-ui-42kyji | 2026-07-17]
- Violation: 첫 분석(서사 없음) 로딩을 AnalyzingBanner(광고 없음)에서 AnalysisProgress로 교체하면서 `isFreeUser`를 전달하지 않아, 기본값 `true`로 인해 Pro 사용자에게도 로딩 중 AdBanner가 노출됐다. 같은 파일의 기존 AnalysisPanel 호출도 동일하게 미전달 상태였다.
  - Rule: 티어 게이팅 prop(isFreeUser 등)을 소비하는 컴포넌트를 렌더할 때, 게이팅 값을 명시적으로 전달해야 한다 — "안전한 기본값"에 의존하면 유료 티어에 무료용 표면(광고)이 새어 나간다.
  - Context: ChartContent에서 이미 destructure된 `tier`로 `const isFreeUser = tier !== 'pro'`를 계산해 AnalysisProgress·AnalysisPanel 두 호출 모두에 전달. claude[bot] 리뷰 Blocker 반영.

## [test/views-coverage-include | 2026-07-27]
- Violation: Hot-looping mocked poll interval (vitest worker exit). `@/shared/lib/sleep` mocked to resolve immediately; polling action stubbed to return `{status:'processing'}` indefinitely → while loop spins with no yield → vitest worker killed ("Worker exited unexpectedly")
  - Rule: Test best practices — Mocked polling loops must have a terminating stub that yields eventually (return one processing tick, then never-settling promise)
  - Context: useAnalysisBranches.test.tsx polling action stub. Fixed by returning a single {status:'processing'} response, then a promise that never settles, allowing loop to yield before next poll.

## [feat/latest-llm-models | siglens | R1 recommended]
- Violation: Label versioning inconsistency — 'Opus 5' next to unversioned 'Opus' (=4.7) made the old model appear current on collapsed trigger, misleading users about which version they selected.
  - Rule: User-facing text must match code state; version numbers in labels must be consistent
  - Context: Added suffix to old Opus label ('Opus 4.7'), clarifying the version relationship.

## [feat/latest-llm-models | siglens | R1 recommended]
- Violation: E2E spec header contained a stale hand-maintained free/premium model enumeration (a prose copy of TIER_CONFIG.models that drifts every time a generation lands). It was missing all six new models and both DeepSeek models, and labelled gemini-2.5-flash-lite "(default)" while the default is deepseek-v4-flash.
  - Rule: Test data must not be duplicated from production without continuous sync; outdated comments hide test/prod divergence
  - Context: Deleted the enumeration and replaced it with a prose pointer to siglens-core `src/domain/tier.ts` (TIER_CONFIG.models), plus a note that "free" means server-key-funded rather than cheap. No code change — the spec's assertions already read the list at runtime.
  - Correction (2026-07-31): this entry originally cited a model id `claude-opus-4-turbo` and a replacement helper `getModelsFor('free_tier')`. Neither exists in any of the three repos; both were fabricated when the entry was written. A deployment audit caught it. Fix-log entries feed MISTAKES.md promotion, so an invented detail here becomes a permanent false "recurring pattern" — verify every symbol name in an entry against the repo before writing it.

## [perf/cdn-cache-hit-rate | perf/cdn-cache-hit-rate | 2026-08-12]
- Violation: `.gitignore` — new script `scripts/probe-cdn-cache.sh` invisible to git because `/scripts/**` ignored without `!` allowlist exception
  - Rule: (new) — Deployment/ops scripts must be committed to version control; .gitignore must include allowlist exceptions for tracked tools
  - Context: Added `!scripts/probe-cdn-cache.sh` exception to .gitignore to allow the probe script to be version-controlled
- Violation: `src/proxy.ts` — `NextResponse.redirect(url, 307)` lacks documented WHY for status choice; adjacent redirects in the same file document theirs
  - Rule: MISTAKES.md Predictability §8 — Non-obvious operational choices must document WHY at the decision point (status codes, cacheability, workarounds)
  - Context: Added JSDoc explaining "307 prevents permanent browser caching of search-query parameter redirects"
- Finding: Reviewer claimed Cloudflare rule `len(http.request.headers["rsc"]) > 0` uses invalid type. Cloudflare docs and production deployment verify `len()` supports String|Bytes|Array.
  - Status: REJECTED — false positive; reviewer claim was incorrect
- Finding (R3 - runtime verification, after 2 review rounds approved): `src/proxy.ts` guard checked `reqUrl.searchParams.has('_rsc')` + `req.headers.get('rsc')`, but Next.js strips both before middleware runs (next/dist/server/web/adapter.js: line 153 calls stripInternalSearchParams; lines 139-147 delete FLIGHT_HEADERS including RSC). Guard was dead code. Unit tests passed because mock NextRequest still had param + header — mock encoded false assumption about runtime.
  - Rule: (new) — Middleware/proxy logic inspecting framework-internal request state (_rsc param, RSC/FLIGHT headers) cannot be validated by unit tests with hand-built mock requests. Mock defines the reality being asserted. Such logic requires production build + real HTTP request to verify firing. Origin-side enforcement is impossible; defense must move to edge (Cloudflare cache rule).
  - Context: Guard + tests reverted to master. Defense moved entirely to Cloudflare cache rule. docs/architecture/CDN_CACHING.md updated documenting why origin-side enforcement is impossible.

## [perf/rsc-prefetch-fragmentation Round 1 | perf/rsc-prefetch-fragmentation | 2026-08-12]
- Violation: Global-render navigation links (/login, /signup) left with default prefetch enabled while the PR justifies the exception with an undocumented assertion ("single conversion action") rather than measurement data. When Cloudflare metrics were pulled, both showed cache misses: /login 22.2% hit ratio (54 misses), /signup 44.0% (38 misses).
  - Rule: (new) — When a PR establishes a policy and then carves out an exception to that policy, the exception must be backed by measurement or explicit data analysis, not assertion or assumption.
  - Context: Removed prefetch from /login and /signup to match the policy established by the rest of the PR. Added comment referencing Cloudflare hit-rate data.

## [perf/rsc-prefetch-fragmentation Round 1 | perf/rsc-prefetch-fragmentation | 2026-08-12]
- Violation: `src/shared/ui/auth/ConsentCheckboxGroup.tsx` — privacy/terms links omitted from the prefetch policy sweep despite being in the same navigation tier. Oversight, not a deliberate exception.
  - Status: FIXED — links now respect prefetch policy consistently.


## [perf/indicator-precision Round 1 | perf/indicator-precision | 2026-08-13]
- Violation: Fixed-precision formatting (toFixed()) truncated sub-penny assets (SHIBUSD trade price ~0.00000XXX) to 0, and reversed MACD histogram sign in candle serialization
  - Rule: Numeric formatting must not lose precision on low-value assets; histogram sign must be preserved from calculation
  - Context: Review caught two precision defects before deployment. Both fixed by switching from fixed decimal places to significant figures, preserving data fidelity while maintaining payload reduction (-34.0% consistent with original measurement).
- Violation (documentation): docs/product/DOMAIN.md §15.6 listed a histogram aggregation formula that is not implemented in the live serialization path
  - Rule: Documentation must reflect actual implementation, not aspirational future code
  - Context: Corrected formula in docs to match live code path.

## [fix/bars-seed-fold Round 1 | Fold index mechanism in bars query | 2026-08-13]
- Violation: Test runner invocation `yarn vitest run src/entities/bars src/app/__tests__ src/views/symbol` omitted bracketed-path directory `src/app/[symbol]/__tests__`, causing 24 actual test failures to go unreported
  - Rule: (new) — Test scope for refactoring must be derived from file graph (changed files + consumers), not hand-typed path list; [bracketed] dynamic-route directories are easy to miss
  - Context: Reported 648 passed; actual suite had failures invisible to reported scope. Additionally, getQuantizedBarsStatic (the refactored function) had zero unit tests before merge attempt.
- Violation: New refactored function `getQuantizedBarsStatic` had no unit tests
  - Rule: (new) — Core refactored functions must include unit tests before merge

## [fix/bars-seed-fold Round 2 | Fold index mechanism in bars query | 2026-08-13]
- Violation: Mock not reset in `beforeEach`; failure-path test passed in full suite (`yarn vitest run`) but failed in isolation (`yarn vitest run -t "실패"`), leaking previous test's resolved value
  - Rule: Test best practices — After repointing a mock during refactor, failure-path tests must be re-run in isolation (`-t "pattern"`) to detect unreset-leak bugs masked by full-suite runs

## [fix/bars-seed-fold Round 3 | Fold index mechanism in bars query | 2026-08-13]
- Violation: Claimed dead mocks removed from 2 files; only 1 was actually cleaned
  - Rule: (new) — Cleanup assertions must be verified exhaustively; missed files hide dead code

## [fix/bars-seed-fold Round 5 | Fold index mechanism in bars query | 2026-08-13]
- Status: APPROVED (zero findings)

## [feat/kr-equity Round 2 | Korean stock support | 2026-08-16]
- Violation: isTabAllowedForSymbol used nested ternary (ternary ? ternary : value) pattern, obscuring control flow
  - Rule: FF.md Readability 1-E — no nested ternaries; early returns preserve clarity
  - Context: Refactored to early return, also eliminating unnecessary DB call for KR symbols (now skips isCryptoSymbolStatic check for all KR market profiles)

## [worktree-refactor+deepseek-model-swap | Migrate Gemini → DeepSeek, Round 3 | 2026-08-17]
- Violation: Guard condition to skip persisting empty analysis (when titleKo + summaryKo both blank) is too broad; applies only to bot branch but skips re-submission check on human page view → permanently malformed articles re-submitted to LLM on every view for 180-day FMP lookback
  - Rule: Pattern copied from sibling files without verifying destination's invariant holds
  - Context: src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts. Sibling economy paths pair the skip guard with unconditional TTL flag (cost-bounded), but destination only gates on isRecentlyFetched/markFetched (applies to bot branch only, leaving human path unguarded). Fixed by narrowing skip condition to exact normalizer-fallback signature only so responses model genuinely produced still persist.

## [feat/market-calendar-adoption Round 1 | Stock market calendar adoption | 2026-08-18]
- Violation: MAX_REWIND_DAYS infinite-loop guard had no unit test
  - Rule: MISTAKES.md §Tests §22 — Every new pure helper must have dedicated unit tests achieving the project's coverage target
  - Context: Added test verifying MAX_REWIND_DAYS guard terminates the rewind loop on the boundary (no test before)
- Violation: DST transition date tests used a 16:00 market close on dates adjacent to the transition, not within the divergent wall-clock window (02:00–07:00 local); one-pass vs two-pass offset correction only diverge inside that window
  - Rule: MISTAKES.md §Tests §18 — New threshold/conditional branch introduced without test cases covering both true and false paths; boundary test cases must account for the actual divergence range
  - Context: Round 1 looked like it closed the gap but did not. Round 2 added synthetic spec with close time inside the divergent window, confirmed by mutation testing (deleting second offset pass fails exactly those two tests)

## [feat/market-calendar-adoption Round 5 | Stock market calendar adoption | 2026-08-18]
- Status: APPROVED (zero findings)

## [feat/kr-sitemap-scope Round 3 | Korean symbol sitemap scoping decision | 2026-08-18]
- Status: APPROVED (zero findings)
