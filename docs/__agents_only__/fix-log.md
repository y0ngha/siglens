
# Fix Log

## [feat/bot-cost-caching Round 1 | feat/bot-cost-caching | 2026-05-28]
- Violation: 'use server' file exported non-async-function constants `POLL_INTERVAL_MS`, `POLL_MAX_ATTEMPTS`
  - Rule: entities/CONVENTIONS.md — 'use server' files may only export async functions; constants must live in separate modules
  - Context: Attempted to export constants in `ensureNewsCardsAnalyzedAction.ts` (a 'use server' file), caused Next.js error 71011. Corrected by moving constants to `lib/newsAnalysisConstants.ts` and importing them.

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

## [feat/aws-infra Round 1 | feat/aws-infra | 2026-06-24]
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
- Violation: Codex hook configuration hardcoded the author's absolute local project path.
  - Rule: Repository tooling must not depend on contributor-specific absolute paths.
  - Context: Replaced the hook command with a repository-relative path so the checked-in hook works outside the author's machine.

## [PR #690 | claude/mobile-ai-analysis-ui-42kyji | 2026-07-17]
- Violation: 첫 분석(서사 없음) 로딩을 AnalyzingBanner(광고 없음)에서 AnalysisProgress로 교체하면서 `isFreeUser`를 전달하지 않아, 기본값 `true`로 인해 Pro 사용자에게도 로딩 중 AdBanner가 노출됐다. 같은 파일의 기존 AnalysisPanel 호출도 동일하게 미전달 상태였다.
  - Rule: 티어 게이팅 prop(isFreeUser 등)을 소비하는 컴포넌트를 렌더할 때, 게이팅 값을 명시적으로 전달해야 한다 — "안전한 기본값"에 의존하면 유료 티어에 무료용 표면(광고)이 새어 나간다.
  - Context: ChartContent에서 이미 destructure된 `tier`로 `const isFreeUser = tier !== 'pro'`를 계산해 AnalysisProgress·AnalysisPanel 두 호출 모두에 전달. claude[bot] 리뷰 Blocker 반영.

## [feat/latest-llm-models | siglens | R1 recommended]
- Violation: Label versioning inconsistency — 'Opus 5' next to unversioned 'Opus' (=4.7) made the old model appear current on collapsed trigger, misleading users about which version they selected.
  - Rule: User-facing text must match code state; version numbers in labels must be consistent
  - Context: Added suffix to old Opus label ('Opus 4.7'), clarifying the version relationship.

## [perf/cdn-cache-hit-rate | perf/cdn-cache-hit-rate | 2026-08-12]
- Finding: Reviewer claimed Cloudflare rule `len(http.request.headers["rsc"]) > 0` uses invalid type. Cloudflare docs and production deployment verify `len()` supports String|Bytes|Array.
  - Status: REJECTED — false positive; reviewer claim was incorrect
- Finding (R3 - runtime verification, after 2 review rounds approved): `src/proxy.ts` guard checked `reqUrl.searchParams.has('_rsc')` + `req.headers.get('rsc')`, but Next.js strips both before middleware runs (next/dist/server/web/adapter.js: line 153 calls stripInternalSearchParams; lines 139-147 delete FLIGHT_HEADERS including RSC). Guard was dead code. Unit tests passed because mock NextRequest still had param + header — mock encoded false assumption about runtime.
  - Rule: (new) — Middleware/proxy logic inspecting framework-internal request state (_rsc param, RSC/FLIGHT headers) cannot be validated by unit tests with hand-built mock requests. Mock defines the reality being asserted. Such logic requires production build + real HTTP request to verify firing. Origin-side enforcement is impossible; defense must move to edge (Cloudflare cache rule).
  - Context: Guard + tests reverted to master. Defense moved entirely to Cloudflare cache rule. docs/architecture/CDN_CACHING.md updated documenting why origin-side enforcement is impossible.

## [perf/indicator-precision Round 1 | perf/indicator-precision | 2026-08-13]
- Violation: Fixed-precision formatting (toFixed()) truncated sub-penny assets (SHIBUSD trade price ~0.00000XXX) to 0, and reversed MACD histogram sign in candle serialization
  - Rule: Numeric formatting must not lose precision on low-value assets; histogram sign must be preserved from calculation
  - Context: Review caught two precision defects before deployment. Both fixed by switching from fixed decimal places to significant figures, preserving data fidelity while maintaining payload reduction (-34.0% consistent with original measurement).

## [fix/bars-seed-fold Round 1 | Fold index mechanism in bars query | 2026-08-13]
- Violation: Test runner invocation `yarn vitest run src/entities/bars src/app/__tests__ src/views/symbol` omitted bracketed-path directory `src/app/[symbol]/__tests__`, causing 24 actual test failures to go unreported
  - Rule: (new) — Test scope for refactoring must be derived from file graph (changed files + consumers), not hand-typed path list; [bracketed] dynamic-route directories are easy to miss
  - Context: Reported 648 passed; actual suite had failures invisible to reported scope. Additionally, getQuantizedBarsStatic (the refactored function) had zero unit tests before merge attempt.
- Violation: New refactored function `getQuantizedBarsStatic` had no unit tests
  - Rule: (new) — Core refactored functions must include unit tests before merge

## [fix/bars-seed-fold Round 3 | Fold index mechanism in bars query | 2026-08-13]
- Violation: Claimed dead mocks removed from 2 files; only 1 was actually cleaned
  - Rule: (new) — Cleanup assertions must be verified exhaustively; missed files hide dead code

## [fix/bars-seed-fold Round 5 | Fold index mechanism in bars query | 2026-08-13]
- Status: APPROVED (zero findings)

## [feat/market-calendar-adoption Round 5 | Stock market calendar adoption | 2026-08-18]
- Status: APPROVED (zero findings)

## [feat/kr-sitemap-scope Round 3 | Korean symbol sitemap scoping decision | 2026-08-18]
- Status: APPROVED (zero findings)

## [feat/asset-class-navigation Round 1 | 3-asset navigation architecture | 2026-08-19]
- Violation: `tsconfig.json` excluded `scripts/` directory from `"exclude"` field, so `npx tsc --noEmit` validated only main src/ but not seed/deploy scripts
  - Rule: Build validation must include all directories that execute on deployment (seeds, migrations, scripts)
  - Context: `seedEconomicEventAnalysis.ts` and `seedCalendarAnalysisBatch.ts` used stale siglens-core API (missing `region` parameter, wrong arity, missing exports from core 0.48.0). Removed `scripts` from tsconfig exclude list; scripts now validated alongside src/.
- Violation: `BriefingCard.knownSectors` unioned dynamic `signalSectors` into its allowlist, admitting US virtual theme names (양자, 우주) that can never appear in the briefing prompt
  - Rule: Allowlists must remain fixed or explicitly documented; dynamic union weakens intended guards
  - Context: Removed union; restored fixed allowlist to block fabricated sector names.
- Violation: Write-path context assertion (`if (price === 0 && volatility === null) return`) pinned only the degenerate case
  - Rule: Defensive assertions must cover all expected valid states, not only degenerate edge cases
  - Context: Expanded assertion to include the additional degraded but valid state (when analysis genuinely produced no meaningful data).

## [feat/asset-class-navigation Round 2 | 3-asset navigation architecture | 2026-08-19]
- Violation: `seedEconomicEventAnalysis.ts` scanned database with `UNANALYZED_SCAN_LIMIT = 20` cap; logged "Done" indistinguishably whether 20 rows were processed (limit hit) or fewer existed (true completion)
  - Rule: Pagination-capped loops must distinguish completion from pagination-limit-hit in logging/return state
  - Context: Changed logging to report `${processedCount}/${totalFound}` and exposed pagination signal to caller, enabling backfill restart from cursor.
- Violation: `MarketDataErrorNotice` displayed message "일부를 가져오지 못했어요" (partial-failure message) on the total-failure branch where NO data rendered at all
  - Rule: Error messages must distinguish and report the actual failure mode (total vs partial); mixed messages hide degradation
  - Context: Added `variant` prop (`'partial' | 'total'`) to MarketDataErrorNotice; renders appropriate message for each failure mode.

## [feat/asset-class-navigation Round 3 | 3-asset navigation architecture | 2026-08-19]
- Violation: Seed script's `failed` counter accumulated per attempt across all passes; closing tally counted attempts, not failing rows, and could exceed table size
  - Rule: Counters that track mutable state must reset per iteration/pass; accumulated totals hide actual state and make diagnostics unreliable
  - Context: Reset `failed = 0` at start of each pass; now final tally reflects actual failing rows processed, not cumulative attempts.

## [feat/asset-class-navigation Round 4 | 3-asset navigation architecture | 2026-08-19]
- Violation: Seed script exit code inconsistency — both abort path (`process.exit(0)`) and non-zero failure count (`process.exit(0)`) returned 0, while uncaught errors returned 1
  - Rule: Exit codes must consistently reflect success/failure state; mixed exit patterns hide errors in CI pipelines
  - Context: Changed abort and failure paths to `process.exit(1)`, success path to `process.exit(0)`.
- Operational lesson (cost: real session time): Multi-replacement script using only `assert content != original` guard silently tolerates individual failed replacements (e.g., when prettier reformatted target across lines). One replacement shipped unapplied, caught only by failing test.
  - Rule: Verify each replacement with targeted grep (e.g., `grep 'expected string' file`) instead of whole-file inequality check
  - Context: A component edit never applied; documented in team feedback.

## [perf/aws-cost-reduction Round 1 | ISR cache-handler refactor | 2026-08-19]
- Violation: `cache-handler/memStore.mjs` — `setEntry()` deleted the previous entry and decremented the byte budget BEFORE checking the per-entry size cap, so writing an oversized value to an already-cached key silently destroyed a valid existing entry instead of rejecting the oversized write
  - Rule: (new) Guard-Ordering — Validation checks must precede mutation; early-return before mutation prevents silent data loss
  - Context: Moved size-cap check before deletion and decrement. Added regression test verifying that oversized writes leave existing entries intact.
## [perf/aws-cost-reduction Round 3 | Code logic audit | 2026-08-20]
- Violation: Length cap applied AFTER regex instead of before, making cap useless against the quadratic blowup it was meant to prevent. Same code later called `String(value)` on untrusted object before capping, invoking arbitrary `toString`.
  - Rule: Validation must be applied in order (type check → size check → parse); size checks must precede regex to prevent quadratic blowup
  - Context: Moved `.substring(0, MAX_LEN)` BEFORE regex; added `typeof value === 'string'` check before `String(value)`.

## [W6a — symbol layout header | redesign-p1 | 2026-08-25]
- Violation: Suspense fallback header shell did not mirror the real header's row structure. Fallback was one row (109px) while the real header stacks to two below 640px (160px), so the fallback->real swap shifted content down 51px on cold first paint (15px at >=640px).
  - Rule: Layout fallbacks must structurally mirror the real layout to prevent reflow shock on hydration
  - Context: Fixed by mirroring `flex-col -> sm:flex-row` and matching control sizes. Measured vertical jump after: 0px at 320/375/414/640/768/1280/1920.
- Violation: Review round 1 filed a REQUIRED finding claiming the fallback's 3 icon placeholders caused Share/Settings to "visibly reposition" for guests. The reasoning about the icon count was right; the impact claim was measured FALSE — the cluster is right-aligned, so the real 2 icons already landed exactly on placeholders #2/#3.
  - Rule: Layout findings must state the measurement that would demonstrate the defect, not only the mechanism
  - Context: The change was still made, but for a different reason (fewer phantom placeholders for the majority guest case).

## [W6b — chart tab | redesign-p1 | 2026-08-25]
- Violation: A W6a change (giving the chart's timeframe bar `.symbol-container`) was itself the defect. The chart route's body is a full-bleed 2-pane split, so centring the bar put the TimeframeSelector at 961-1246 while the canvas is 0-894 and the rail 977-1584 — the control floated over the rail instead of over the chart it controls.
  - Rule: Layout fixes must verify the documented exception routes; a fix that makes one route consistent can break the documented exception route
  - Context: Reverted to full-bleed `px-4`.
- Violation: Contrast/hierarchy sweep produced 33 fake failures in light theme because `getComputedStyle().backgroundColor` returns `oklab(...)` under Tailwind v4 and a naive `rgb()` regex parsed it as near-black.
  - Rule: Contrast measurement must handle Tailwind v4's `oklab()` color space output; regex-based color parsing is unreliable
  - Context: Resolved by compositing through a canvas 2D context, sanity-checked with white + rgba(0,0,0,0.1) === 229. Real failure count was 2, both intentional chart-series legend swatches.
- Violation: Applied `LABEL_KO` to three files that shared a class string, then had to revert two of them. In `IndicatorSettingsModal` and `BacktestCaseCard` the governed content is already `secondary-400`, so `LABEL_KO` created an exact colour tie, whereas the original `secondary-500` was correctly dimmer than every content colour.
  - Rule: Class-name uniformity does not imply semantic role uniformity; check what each site actually governs before a blanket swap
  - Context: Reverted two of three replacements to restore correct hierarchy.
- Violation: Review round 3 filed a REQUIRED finding on the same wrong premise (that an eyebrow must out-rank its content). Rejected with structural evidence.
  - Rule: Label hierarchy: a quiet label may be out-ranked by its content (label/value pattern); an exact size+colour tie between two different levels is the defect
  - Context: Documented the rule in response to repeated finding.
- Violation: `<dialog>` centering: Tailwind preflight's `*, ::before, ::after { margin: 0 }` silently overrides the UA stylesheet's `dialog:modal { margin: auto }`, pinning every native modal to the top-left.
  - Rule: Native element defaults are overridden silently by Tailwind preflight; intent-matching requires explicit `@layer base` restoration
  - Context: Found only by measuring the rendered box ([0,0] vs [544,16] at vw 1600 x vh 857). Fixed once in `@layer base`.
## [W6c — /[symbol]/overall heading unification | redesign-p1 | 2026-08-25]
- Violation: Same file family, opposite direction: in `CrossLinkCards` the EMPHASISED current-page card (border-primary-500 + ring) had a DIMMER title (`secondary-100`) than its unemphasised siblings (inherited `secondary-50`). Emphasis and brightness pointed opposite ways.
  - Rule: Emphasis tokens (border-primary, ring) and text-colour tokens must align — bright emphasis + dim text is discordant
  - Context: Changed card title to inherit secondary-50 (or primary-text for current card) to align with emphasis.

## [W6c — WCAG defects the UI audit surfaced | redesign-p1 | 2026-08-25]
- Violation: The 상세 분석 switch was invisible in the light theme: track 1.03:1, white thumb on it 1.01:1. It is not exempt as "disabled" — when locked it stays clickable (opens the signup nudge), carries `cursor-pointer`, and sets no native `disabled`. Fixed with `border-border-control` on track and thumb; after: light 3.10/3.30/7.85, dark 3.74/3.57/8.41.
  - Rule: WCAG 1.4.11 Contrast (Graphics) — interactive control boundaries must meet 3:1 minimum, even in locked state if still clickable
  - Context: Applied `border-border-control` token to locked switch (now meets 3:1+ in both themes). Added unit test asserting locked state still clickable + meets contrast.

- Violation: Form-field and outline-button boundaries below 3:1 in both themes while `--color-border-control` (built for exactly this) went unused: ContactTextField, ContactTextareaField, ChatPanel's textarea, ReanalyzeButton.
  - Rule: (guideline) UI control boundary tokens (border-control) must be used wherever 1.4.11 contrast is required; boundaries using other tokens (border-secondary, border-primary) often fall short. Audit all interactive controls for 3:1 minimum.
  - Context: Applied `border-border-control` to all 4 controls. Measured after: all meet 3:1+ in both light/dark themes.

- Violation: The 분석 설정 popover title was an `<h2>` at 12px — smaller than every h3 on the page — and carried `tracking-wide` on Korean text, which the repo's own `typographyStyles.ts` doc comment forbids (Hangul has no case and wide tracking scatters the jamo).
  - Rule: (documented in typographyStyles.ts) Korean text must not use `tracking-wide` (or letter-spacing > 0); Hangul glyphs lack case, and tracking scatters jamo (consonant+vowel pairs). English-only or re-set tracking to normal.
  - Context: Removed `tracking-wide` from popover title. Restored heading hierarchy by using HEADING_SECTION token (now at 14px, outranks body + every h3).

## [W6c — audit-agent measurement traps | redesign-p1 | 2026-08-25]
- Violation: The same audit's first contrast resolver ignored element `opacity`, reading `disabled:opacity-40` buttons at 8.82:1 when they render at 2.26:1.
  - Rule: (new) Contrast measurement must incorporate element opacity into computed colour before reading; ignoring opacity masks actual rendered contrast. Apply opacity to RGBA before computing ratio.
  - Context: Updated resolver to factor element opacity: `finalAlpha = baseAlpha * elementOpacity`. Re-measured; now correctly reports 2.26:1 (dark) / 1.92:1 (light).

- Violation: A horizontal-overflow check is a false negative by construction unless `body { overflow-x: hidden }` is neutralised inside the measuring rig — the first pass reported 0 offenders purely because the body clipped them.
  - Rule: (new) Overflow/layout measurement in the browser DOM must temporarily neutralise document-level overflow (body/html overflow-x/y) that may be hiding the measured property. Measure with overflow neutralised, then restore.
  - Context: Audit script now sets `document.body.style.overflow = 'visible'` + `document.documentElement.style.overflow = 'visible'` before overflow scan. Re-measured; found 2 actual offenders previously hidden.

## [W6d — /[symbol]/news heading unification | redesign-p1 | 2026-08-25]
- Violation: Same defect class with the colour present — `MarketNewsDigest.tsx:83,109` used `text-sm font-semibold text-secondary-100`, the same colour AND same weight as its own h2 (which uses `HEADING_SECTION`), differing only by size.
  - Rule: A "has a colour class" check passes this; only comparing a heading against its own PARENT heading catches it
  - Context: Both moved to `cn('mb-2', HEADING_SUBSECTION)`.
- Violation: Lowering the card headline to `font-medium` created a NEW inversion one level down — the card's `<h4>` sub-labels were still `font-semibold`, so they out-weighed the headline above them.
  - Rule: After any weight/size/colour change, re-measure the level BELOW the one you touched, not just the one you fixed
  - Context: h4 moved to `font-medium` in `NewsList.tsx` and `MarketNewsCard.tsx` (2 sites). Contrast is unaffected by weight — measured 9.93:1 light / 11.26:1 dark before and after. Final ramp `/AAPL/news` light: h1 24/700 → h2 18/600 → h3 16/500 → h4 12/500.
- Violation: An automated import-inserting helper produced a duplicate `import ... from '@/shared/lib/typographyStyles'` (two statements, same module) because its dedupe check tested for the bare identifier, which the JSX it had already inserted also contained.
  - Rule: Dedupe automated import insertion by full module path + statement boundary, never by bare identifier
  - Context: oxlint has no `no-duplicate-imports` rule so CI would not have caught it; a UI audit did. Merged into one specifier list.

## [W6d — audit findings that were factually wrong | redesign-p1 | 2026-08-25]
- Violation: The SEO audit asserted that 5 JSON-LD `ItemList` headlines "are not behind a 더보기 control for the news list". `NewsList.tsx:339` has exactly such a control (`visibleCount` grows by `PAGE_SIZE`).
  - Rule: Audit claims about the ABSENCE of a control must be checked against the component source, not inferred from the rendered page
  - Context: The finding's substance survived (initial DOM and JS-less HTML render only 5, and Google does not click buttons) but its stated evidence did not.

## [fix/visitor-diagnostics-effective-now Round 2 | privacy policy effective date sync | 2026-09-10]
- Status: APPROVED (round 2, zero findings)
  - Development note: Two self-inflicted errors caught in this round, neither shipped.
    1. `git checkout -- <file>` destroyed uncommitted work. While falsification-testing (forcing three columns back to null to test the fixture), reverted the scratch edit with `git checkout --`, which restored the file to HEAD. That silently discarded the actual feature edit too, since it was uncommitted. Detected by grepping for the removed constant afterwards; the edit had to be re-applied. Lesson: save intended content first (stash/copy) rather than assuming `git checkout --` only undoes the most recent tweak.
    2. Anchored-replace assert used a string that did not match the text just written (missing backticks around an identifier). The assert fired before the file write, so nothing was corrupted — assert doing its job. Worth logging as evidence that the "anchor + assert, never line-slice" rule prevents data corruption.

## [feat/share-plain-language Round 2 | persist plain-language prose in share snapshot | 2026-09-05]
- Violation: RECOMMENDED — Whitespace-only `plain` input passed server validation. Server relied on client-side `trim()` instead of enforcing at the trust boundary (`assertValidInput.ts`).
  - Rule: (guideline) Input validation at server trust boundaries must not assume client filtering. Validate the actual constraint (trimmed + non-empty) server-side, do not delegate to client.
  - Context: Added `plain.trim().length > 0` check in `assertValidInput.ts`. Server now rejects whitespace-only strings before they reach business logic.

## [PR #796 Round 3 review fix | seo/index-footprint-recovery | 2026-09-11]
- Violation: SUGGESTION — Unreachable `throw` in `resolveAboutContent` due to incomplete type enforcement on markdown map keys.
  - Rule: Maps with enum discriminant keys should enforce all cases; dead code throws indicate type-safety gap.
  - Context: Typed map with required default-locale key instead of dead-code throw.

## [PR #798 | seo/ymyl-wording-fg-fixes | 2026-09-11]
- Violation: Non-component helper `priceSourceFor` returned inline object types without an explicit return type.
- Rule: CONVENTIONS.md — explicit return types on non-component functions; named interface instead of inline object type.
- Context: `fetchDailyCloses.ts` endpoint/field selector for ETF vs index symbols; fixed with `PriceSource` interface.
- Violation: Terminology rename applied partially — "종합 결론"→"종합 분석" left headings reading "종합 분석 결론" / "Overall Analysis Conclusion" (word duplicated) in 2 keys × 4 locales.
- Rule: When renaming a term across catalogs, sweep every locale for the old word in compound phrases, not only exact matches of the old term.
- Context: `OverallFactsSummary.9a8ae8` and `de4a87` headings; unified to "종합 분석 요약" matching the existing `sectionLabel`.
- Violation: Glossary key renamed instead of added, dropping locked terminology still produced by upstream AI prompts.
- Rule: `messages/glossary.json` is also consumed by `db/scripts/translateContentLocale.ts` for stored AI content; before renaming/removing a key, grep `@y0ngha/siglens-core` prompts for the old term and keep it if still emitted.
- Context: core overall/fundamental/financials prompts still emit "종합 결론"; restored the old entry alongside "종합 분석".

## [chore/offline-build Round 1 | offline pre-push build | 2026-09-11]
- Violation: New env-gate helper `isOfflineBuild()` placed in `src/shared/lib/` despite identical-purpose sibling `isE2E()` living in `src/shared/api/e2eEnv.ts`. Both consumed together by `src/shared/db/client.ts`. Category siblings must colocate.
  - Rule: FF.md Cohesion 2-C — when adding an env-gate or feature-flag helper, search for siblings in the same category and colocate in the same file. Placing duplicates of the same category in different directories obscures their relationship and makes future changes diverge.
  - Context: Moved `isOfflineBuild` to new `src/shared/api/offlineBuild.ts` alongside the existing `e2eEnv.ts` pattern.

## [PR #800 | chore/offline-build | 2026-09-11]
- Violation: BLOCKER — Offline/kill-switch gate covered FMP, Neon, and Upstash but not Yahoo Finance (KR market data via `createYahooClient`). Disabling the app Redis client made `getOrSetCache` call the live Yahoo fetcher on every local build.
  - Rule: (new) Offline/kill-switch gate must cover every external host reachable from the guarded code path, not only the services explicitly named in the task description. Incomplete coverage creates silent fallbacks to live services during offline builds.
  - Context: Extended gate to guard Yahoo Finance client creation in addition to FMP/Neon/Upstash. Verified by disabling gate and confirming prerender blocks.

- Violation: Implementation lesson — Guarding inside a third-party library's injected `fetch` hook can cause HANG instead of graceful failure. `yahoo-finance2` `quote()` method goes through crumb/cookie logic before fetching; a throwing fetch handler there leaves the build stuck (`/ko/market/kr` exceeded 60s prerender timeout ×3), while `chart()` degrades gracefully.
  - Rule: Put kill-switch guards ABOVE third-party client libraries, not inside their transport hooks. Guards inside library code risk hanging if the library has pre-fetch initialization steps. Verify with real build, not only unit tests.
  - Context: Wrapped Yahoo client instantiation in a Proxy that rejects method calls before entering library logic; kept fetch-level guard as backstop. Verified real build no longer times out.

- Violation: Implementation lesson — External package `@y0ngha/siglens-core` creates its own Upstash clients from `process.env.UPSTASH_REDIS_REST_*` in `readUpstashConfig()`, bypassing the app-level offline gate.
  - Rule: When implementing a service gate, grep all dependencies for direct env readers of that service and ensure env blanking/override reaches them. External packages may initialize clients from env without routing through app gates.
  - Context: Fixed by blanking `UPSTASH_REDIS_REST_*` environment variables in pre-push build command. Verified Next.js `loadEnvConfig` does not override preset-empty env vars.

## [feat/agent-tool-analysis-context Round 2 | Agent tool analysis context | 2026-09-14]

## [feat/agent-tool-analysis-context Round 2 | Agent tool analysis context | 2026-09-14]
- Status: APPROVED (zero findings)

## [feat/economy-calendar-tz Round 2 | economy calendar UTC timezone | 2026-09-14]
- Violation: FMP economic-calendar `date` field ("YYYY-MM-DD HH:mm:ss") was assumed to be ET wall-clock time across etTimeUtils, /economy calendar grid, KR indicator cards, and DB column comment (`date_et`); live FMP data from authoritative known-time events (Fed decision 18:00 UTC, CPI 12:30 UTC) proves it is UTC. /economy grid displayed release times 4-5 hours wrong for months.
  - Rule: External API field semantics must be verified against known reference events, not inferred from comment consensus or existing code patterns
  - Context: R1 review argued for ET treatment based on code/DB-comment consensus; R2 resolved by authoritative live check against known event times. Root cause: timezone assumption for an external API field was never validated; tests encoded the same wrong assumption, so unit coverage verified nothing. Fixed by normalizing all consumption points (etTimeUtils, grid, card indicators, DB comments) to treat `date` as UTC.
- Violation: FMP economic-indicators endpoint called without `to` parameter returns stale rows ending 2025-12-01 (9 months old) with no error signal; fixed by passing `to=today`
  - Rule: External API results must be validated for staleness/completeness when the API offers filtering parameters (date range, limit) — bare calls may degrade silently to cached or partial data
  - Context: Added `to` parameter to FMP economic-indicators fetch, ensuring fresh data is returned. Issue discovered during production verification of /economy route.
- Status: APPROVED (Round 2, zero findings)

## [PR #823 | feat/ai-conversation-switch-no-skeleton | Post-approval suggestions | 2026-09-15]
- Violation: SUGGESTION (accepted) — pending navigation signalled only visually via `aria-busy` state; no announcement to screen readers
  - Rule: WCAG 2.1 — Dynamic state changes that affect application state must announce to assistive technology; visual-only signalling creates screen-reader blind spot
  - Context: Added always-mounted `role="status"` sr-only live region in Sidebar with i18n key `widgets.agent-chat.Sidebar.navigating` (4 locales + hash). Live region now announces navigation state to assistive technology.

- Finding: Review suggested using LocaleLink instead of raw `<a>` + `router.push` for in-app navigation
  - Status: REJECTED — false positive; LocaleProvider's `hrefBase=SITE_URL` makes LocaleLink emit absolute siglens.io URLs (cross-origin full navigation), breaking ai.siglens.io in-app conversation switching pattern

## [PR #823 | feat/ai-conversation-switch-no-skeleton | Round 5 | 2026-09-15]
- Finding: Reviewer claimed Tailwind v4 has no `aria-busy:` variant as a blocker. Compilation with @tailwindcss/node v4 verified both `aria-busy:cursor-progress` and `aria-[busy=true]:cursor-progress` generate valid CSS. v4 `aria-*` is a functional variant for any attribute.
  - Status: REJECTED — false positive; Tailwind v4 supports aria-* variants

- Violation: src/widgets/CLAUDE.md cross-widget dependency edge list omitted agent-chat → layout entry
  - Rule: CONVENTIONS.md — Architecture documentation must mirror implementation; cross-widget dependency edges must be registered
  - Context: Added agent-chat → layout edge to documented cross-widget dependency graph.

## [PR #839 Round 2 | fix/seo-live-audit | 2026-09-18]
- Violation: New derived value in component prop composition lacking unit test. Dataset JSON-LD `temporalCoverage` field changed from hardcoded literal to computed value derived from stats (`${periodStart}/${periodEnd}`). Composition logic inside a private builder function `buildJsonLdNode()`, but no test verified the composed value with distinct start/end values or the removal of `dateModified` field.
  - Rule: (new) Derived values computed and composed into component props must be tested at the composition point, not left to visual rendering tests. When a prop receives a computed value, unit tests must verify the computation and its effects (field additions, removals, transformations).
  - Context: Added `src/app/[locale]/backtesting/__tests__/page.jsonld.test.tsx` which spies on the JsonLd component's `data` prop, locates the Dataset node by `@type`, and asserts: 1) composed temporalCoverage value matches expected start/end, 2) dateModified field was removed. Test catches both the computation correctness and field deletion without running visual renders.

## [fix/seo-b-copy-jsonld Round 1 | seo/index-footprint-recovery | 2026-09-15]
- Violation: RECOMMENDED — loadMarketSignals loaded CachedMarketDataProvider 3 times per request without request-scope deduplication → redundant Data Cache reads
  - Rule: (new) RSC data loaders used in multiple places within one request must wrap with React cache() to eliminate redundant fetches from the same provider call
  - Context: Server-cached providers like CachedMarketDataProvider return the same data; calling them multiple times per request wastes the cache boundary. Fixed by wrapping loader in React cache(). Scope parameter removed (was defeating cache key). Verified: getMarketSummary, getMarketNotice, getMarketCalendar now deduplicate to single provider call per request.

## [fix/seo-cls-sitemap-polish Round 4 | PWA banner Polish | 2026-09-18]
- Status: APPROVED (zero findings)

## [feat/hub-briefing-ssr-seed Round 3 | briefing cache surface stability | 2026-09-18]
- Status: APPROVED (zero findings)
## [PR #827 | feat/ai-provider-fallback-core-170 | 2026-09-15]
- Violation: BLOCKER — agent provider fallback decided per turn, not per step. Stalling DeepSeek re-costs the 90s stall timeout every step of a multi-step turn, creating cascading retries within a single inference request.
  - Rule: Core logic — retry/fallback state must be sticky across all steps of a multi-step operation; re-evaluating fallback on every step doubles timeout costs.
  - Context: Changed fallback decision to set `state.fallbackUsed` on first timeout, then skip re-evaluation on subsequent steps. Fallback now remains sticky for the entire inference session.

## [fix/seo-internal-links Round 1 | SEO internal linking strategy | 2026-09-18]
- Violation: New nullable `Date` column (`seo_analysis_snapshots.first_generated_at`) was threaded through read path but `unstable_cache` JSON round-trip rehydration in `getSnapshotStatic.ts` was not extended to it — sibling fields `generatedAt`/`updatedAt` are rehydrated there with JSDoc explaining exactly this failure mode. On cache hit, field was a string while declared type said `Date | null`.
  - Rule: (new) When adding new Date fields to cached query results, extend JSON round-trip rehydration logic alongside all sibling Date fields; cache round-trip creates type mismatches if rehydration is selective. JSDoc on sibling fields already documents the failure mode.
  - Context: Fixed by rehydrating new field and adding unit test covering both populated row and `null` row on cache hit.

- Violation: New i18n key (`widgets.layout.footer.symbols`) placed in `shared.seo` namespace and consumed by client-rendered `Footer`, leaked that server-only namespace into every client payload.
  - Rule: i18n namespace containment — server-only namespaces (shared.seo) must not be consumed by client-rendered components; use client-permitted namespaces (widgets.layout). Namespace pollution increases payload and masks content scope.
  - Context: Moved key to `widgets.layout` namespace before use. Existing guard (`clientKeyCoverage`) now correctly rejects shared.seo in client code.

## [fix/symbols-copy-and-names Round 2 | /symbols 표기·문구 | 2026-09-18]
- Status: APPROVED (지적 없음)

## [feat/hub-ai-prewarm Round 1 | SEO prewarm hub phase | 2026-09-18]
- Violation: Fire-and-forget cache write race — core's `run*` does not await its cache SET, so a single immediate read-back could report a false "key mismatch"
  - Rule: (new) When verifying a write whose SET is fire-and-forget (core does not expose the promise, so it cannot be awaited), the read-back must retry — a single immediate read races the pending SET and reports a false mismatch
  - Context: Fixed with a retry read-back (4 attempts, 400ms apart) to ensure the cache write is complete before proceeding
- Violation: No per-target timeout — the phase deadline is only checked BETWEEN targets, so one hung target holds the Redis lock past TTL
  - Rule: (new) Long-running loops must have per-iteration timeouts; deadline checks between iterations allow a single hung iteration to hold resource locks past their TTL
  - Context: Fixed with `HUB_UNIT_TIMEOUT_MS` (45s) via `Promise.race` on individual target operations

## [feat/hub-ai-prewarm Round 2 | SEO prewarm hub phase | 2026-09-18]
- Violation: Three sibling test files exercised the real LLM/Redis hub path, protected only accidentally by a global fetch stub
  - Rule: (new) Test isolation — test files must explicitly mock external dependencies; accidental global stubs provide false isolation
  - Context: Fixed by adding `vi.mock('../hubs', ...)` to all three sibling test files
- Violation: The hub phase `batchDeadline` was computed BEFORE the hub phase, so the deadline slice did not account for hub phase latency
  - Rule: (new) Order-of-operations — Derived deadlines/budgets must be computed AFTER dependent phases complete; pre-computing a deadline before a consuming phase makes that phase erode its own budget
  - Context: Fixed by computing `batchDeadline` after the hub phase returns

## [feat/hub-ai-prewarm Round 3 | SEO prewarm hub phase | 2026-09-18]
- Violation: `counts.durationMs` calculation silently broke after moving `batchDeadline` computation. It had been back-derived as `clock.now() - (batchDeadline - BATCH_DEADLINE_MS)` and now measured only the symbol loop, while the Redis lock is held for hub+symbol combined
  - Rule: (new) Code-movement regression — derived values that depend on moved code must be re-derived or tracked independently; back-derived calculations break silently when their source moves
  - Context: Fixed by introducing a separate `batchStartedAt` timestamp, making `durationMs` a direct `clock.now() - batchStartedAt` calculation
- Violation: Regression test for `durationMs` was vacuous — it asserted `durationMs >= HUB_ELAPSED_MS` (90s), but the symbol loop alone consumed 120s of simulated clock, so it passed even with the broken expression
  - Rule: (new) Regression tests — regression tests must assert equality or tight bounds, not >= checks; loose bounds can be satisfied by unrelated setup, masking the bug being tested
  - Context: Rewritten to assert equality with total elapsed time, verified against old code via revert-check

## [feat/hub-ai-prewarm Round 4 | SEO prewarm hub phase | 2026-09-18]
- Status: APPROVED (zero findings)

## [feat/hub-briefing-ssr-seed Round 2 | 허브 브리핑 SSR seed | 2026-09-18]
- Development note (self-inflicted, caught before commit): wrote `src/entities/market-summary/__tests__/briefingStaticCache.test.ts` with the Write tool without checking whether it existed. It did — the overwrite deleted 7 existing tests (150 lines) and the review approved that diff without flagging the deletion. Caught afterwards by reading `git status` (the file showed `M`, not `??`). Restored with `git checkout --` and the 2 new seed tests appended in the existing file's style. Lesson: a `M` in `git status` for a file believed to be new means something was overwritten — and "tests still pass" does not detect deleted tests.

## [feat/hub-briefing-ssr-seed Round 3 | 허브 브리핑 SSR seed | 2026-09-18]
- Status: APPROVED (zero findings)

## [PR #849 | feat/agent-precomputed-data | 2026-09-19]
- Violation: `showScrollButton` (`MessageList.tsx`) was only ever updated from the `onScroll` handler. A streaming answer grows `scrollHeight` continuously without firing any scroll event, so a user who had scrolled away from the bottom never saw the ↓ scroll-to-bottom button appear during streaming.
  - Rule: (new) A piece of UI state derived from container geometry (scroll distance) must react to every geometry-changing cause, not just the one event type (`scroll`) that happens to be wired up — content growth from streaming is a geometry change with no accompanying scroll event.
  - Context: Added a mount-only `useEffect` that attaches a `ResizeObserver` to the content wrapper div; its callback (not the effect body — this is an external subscription, matching `react-hooks/set-state-in-effect`) calls `setShowScrollButton` via a shared `isAwayFromBottom(el)` helper also used by `handleScroll`, so the two paths can't drift apart. Follows the existing `useIsClamped.ts` observer pattern (create in effect, `observer.disconnect()` on cleanup).


## [fix/portfolio-money-rounding Round 1 | get_my_portfolio 금액 반올림 | 2026-09-19]
- Violation: 금액(marketValue/costBasis/pnl)을 지표용 유효숫자 6자리 반올림(`roundNumber`)으로 처리해 1만 달러 이상에서 센트가, 100만 이상에서 일의 자리가 잘림 — value − cost ≠ pnl
  - Rule: (new) 금액은 통화 최소 단위(USD 2자리, KRW 0자리)로 반올림한다. 유효숫자 반올림은 크기에 따라 자릿수가 바뀌어 금액에 쓰면 안 된다
  - Context: 회원 실측에서 10,874.63달러가 10874.6으로 나와 모델이 "10,874.60달러"로 답함. `roundMoney`/`moneyDecimals` 추가
- Violation: `Number(x.toFixed(2))`로 반올림해 이진 부동소수 경계(150.005 → 150.00)에서 한 센트 틀림
  - Rule: (new) 금액 반올림에 `toFixed`를 쓰지 않는다 — 크기 기준 상대 엡실론 보정 후 `Math.round`(half-away-from-zero), 지수 문자열 왕복은 부동소수 잡음(1e-13)을 NaN으로 만들므로 금지
  - Context: 리뷰 라운드 1 지적. 부호 대칭·-0 정규화 포함

## [fix/seo-snapshot-desc-tab-prefix Round 1 | SEO description collision across symbol tabs | 2026-09-20]
- Violation: `buildSnapshotMetaDescription` in `src/shared/lib/seo.ts` prefixed only `${subject} — ` and clamped AI prose at `SEO_DESCRIPTION_MAX_LENGTH`. When two tabs' snapshots opened with the same long sentence, the clamp cut before they diverged, returning byte-identical descriptions across tabs. Measured in production 2026-09-20: `https://siglens.io/SOXS/overall` and `https://siglens.io/SOXS/fundamental` both returned 193-char descriptions.
  - Rule: Metadata fields derived from dynamic content must include a route/view discriminator in the prefix to prevent collision across different routes serving the same subject.
  - Context: Added `symbolTabDescriptionLabel(tab, assetClass, t)` helper with required `label` param; all 7 `generateMetadata` call sites under `src/app/[locale]/[symbol]/` now pass the tab-specific label, so prefix is `${subject} ${label} — `. Added unit test (`src/shared/lib/__tests__/symbolTabDescriptionLabel.test.ts`) asserting each tab's built title contains its label, because label key table and title builders pick catalog keys independently and both are `string` to the compiler.

## [fix/seo-snapshot-desc-tab-prefix Round 2 | not-found page SEO metadata inheritance | 2026-09-20]
- Violation: `src/app/[locale]/not-found.tsx` returned `generateMetadata` with only `title` and `robots`, so Next inherited the root layout's `description`: every non-existent URL shipped the home page's `<meta name="description">`. Measured on production 2026-09-20 on `/ZZZZZ`, `/nonexistent-page-xyz`, `/news/nosuchcat`.
  - Rule: Every `generateMetadata` export must explicitly set all metadata fields; unset fields inherit from parent layout, causing search engines to crawl duplicate `<meta>` with identical content across error boundaries.
  - Context: Fixed by populating `description` metadata field with already-translated 404 body copy (`app.home` key `not-found.03ecab`) with whitespace collapsed.

## [chore/deps-2026-09 Round 1 | 의존성 업그레이드 | 2026-09-24]
- Violation (R1 REQUIRED, fixed): oxlint 1.79+ `react/globals`를 `oxlint-disable-next-line`으로 억제했다(테스트 프로브가 렌더 중 모듈 변수에 `useQueryClient()`를 대입)
  - Rule: 새 lint 규칙이 테스트 헬퍼를 잡으면 억제 주석 대신 근본 수정 — Provider가 만든 값을 읽을 땐 `renderHook(() => useX(), { wrapper: Provider })`
  - Context: `src/app/__tests__/providers.test.tsx`의 `ClientCapture` 프로브 제거
- Violation (R1 REQUIRED, fixed): 프레임워크 메이저/마이너 업그레이드에서 **기본값이 뒤집힌 플래그**를 확인·언급 없이 넘겼다(Next 16.3: `validateRSCRequestHeaders`·`prefetchInlining`·`varyParams`·`optimisticRouting`·`appNewScrollHandler`)
  - Rule: (new) 프레임워크를 올릴 때는 구·신 `defaultConfig`를 diff하고, 뒤집힌 플래그 중 테스트·오프라인 빌드로 관측되지 않는 것(CDN·라우터·캐시 계약)은 프로덕션 빌드 + 실제 브라우저로 계약을 실증해 설정 파일 주석에 남긴다
  - Context: `next start` + Playwright로 RSC 요청 전수 캡처(RSC 헤더·`_rsc` 쿼리 동반, `text/x-component`, 307 0건). next.config.ts에 계약·재확인 요구 기록
- Pre-empted (not a review finding): client-s3 3.1138이 `@aws-crypto` 의존을 없애 Dockerfile의 해당 COPY가 이미지 빌드를 깨뜨리게 됨. PR CI는 Docker 빌드를 안 돌려 못 잡는다 — SDK를 올릴 땐 runner 수동 COPY 목록만 담은 격리 디렉터리에서 실제 요청을 보내 확인

## [chore/test-tooling-majors Round 1 | vitest 5·jsdom 30 | 2026-09-24]
- Violation (R1 REQUIRED, fixed): vitest 5가 `experimental.fsModuleCache`를 top-level `fsModuleCache`로 옮겼는데 옛 위치에 남겨 타입 에러 + 런타임 무시. 로컬 `yarn typecheck`가 0건으로 나와 놓쳤다
  - Rule: (new) 의존성 업그레이드 후 typecheck는 `*.tsbuildinfo`를 지우고 돌린다 — `incremental: true`가 업그레이드 전 진단을 재사용해 새 타입 에러를 숨긴다(이번에 0건 → 실제 2건)
  - Context: 설정을 top-level로 이동, 캐시 삭제 후 typecheck 0건·jest-dom 매처 타입 탐침 재확인

## [fix/set-state-in-effect Round 1–2 | react/set-state-in-effect 6곳 정리 | 2026-09-24]
- Violation (orchestrator check, fixed): `useTheme`을 useSyncExternalStore로 바꾸며 스냅샷이 localStorage를 다시 읽게 되자, 저장이 막힌 환경(사파리 비공개)에서 고른 테마가 표시상 `system`으로 되돌아갔다 — 옛 코드는 `setState(next)`라 유지됐다
  - Rule: (new) state를 외부 스토어 구독으로 바꿀 때는 "쓰기가 실패하는 경로"에서 옛 in-memory 값이 하던 역할을 목록화하고, 그 경로를 옛 코드 기준 테스트로 고정한다(옛 코드 통과·새 코드 실패를 대조)
  - Context: 저장 실패 시에만 쓰는 모듈 변수 `unsavedPreference` + 테스트
- Violation (R1 REQUIRED/recommended, fixed): 리팩터가 새로 만든 로직(재발화 가드 `firedNavRef`, 결착 후 1회 이동·입력 초기화, 입력 시 취소, `explicitTab` 우선순위, 하이드레이션 server snapshot, 라벨 정규화)에 테스트가 없어 가드를 지워도 259개 테스트가 전부 통과했다
  - Rule: (new) 동작 보존 리팩터는 "기존 테스트가 통과한다"로 끝내지 말고 **새로 생긴 분기마다 변이를 넣어 죽는 테스트가 있는지** 확인한다 — 없으면 추가
  - Context: 변이별 FAIL→PASS 확인한 테스트 6건 추가, MISTAKES #10을 oxlint 1.79+ 기준 패턴으로 갱신(useEffectEvent 회피는 더 이상 통과하지 않음)
- Violation (R2 recommended, fixed): 테스트 제목이 다루지 않는 경로(로케일 전환에 따른 toLocalePath 정체성 변경)를 주장 — 로케일을 실제로 전환하도록 수정. MISTAKES #10의 의도 플래그 지침이 PR 자체의 두 패턴과 모순 — 소비 위치 기준으로 정리

## [PR #869 claude-review R1 | fix/set-state-in-effect | 2026-09-24]
- Violation (Blocker, fixed): 리팩터로 setState만 렌더 중 조정으로 옮기면서 남은 ref 정리 effect를 핸들러 앞에 두고, `requestSubmit`(useCallback)을 useRef 선언들 사이에 끼워 CONVENTIONS "Custom Hook Declaration Order"를 깼다
  - Rule: CONVENTIONS Custom Hook Declaration Order — 훅 일부를 옮긴 뒤에는 남은 조각(effect·handler)이 순서 규칙상 제자리에 있는지 다시 본다. effect 간 실행 순서에 의존하면 묶음 안에서 순서를 유지하고 이유를 주석으로 남긴다
  - Context: ref 정리 effect를 effect 묶음 맨 앞으로(restoreFocus effect가 triggerRef를 읽어 순서 의존), requestSubmit을 커스텀 훅 뒤로
- Violation (Blocker, fixed): 순수 헬퍼 `resolveTypedTarget`·`normalizeLabel`을 훅 파일에 정의(MISTAKES #18) — `lib/resolveSubmitTarget.ts`·`lib/normalizeLabel.ts`로 이동하고 테스트 추가
- Question (answered, comment only): `?ticker=`만 바뀌는 히스토리 이동은 구독이 알리지 않아 스스로 재렌더되지 않는다(이전 구현과 같은 한계) — 주석을 단정 대신 사실대로 정정

## [PR #852 claude-review R3 (APPROVED, suggestions) | ai.siglens.io/about | 2026-09-19]
- Suggestion (fixed): `runPlayback` in src/views/ai-about/lib/replayPlayer.ts caught every error silently, not only cancellation
  - Rule: MISTAKES.md — catch blocks must not swallow errors without logging
  - Context: cancellation now rejects with a `PlaybackCancelled` Error subclass; other errors are logged with console.error; test added
- Suggestion (fixed): JSDoc in src/app/ai/[locale]/about/page.tsx claimed every link out of the page leads to `/`, but the "more on SIGLENS" links go to siglens.io
  - Rule: MISTAKES.md §15.6 — comment accuracy
  - Context: reworded to the real reason (no account-specific content; ways into the chat go to `/`)
- Suggestion (fixed): unused `BankIcon` re-export added to the widgets/agent-chat barrel
  - Rule: do not widen a slice's public surface with exports nobody imports
  - Context: removed
- Suggestion (fixed): `useCanAnimate` reduced-motion change subscription had no test
  - Context: added src/views/ai-about/hooks/__tests__/useCanAnimate.test.tsx (initial value, change event, unsubscribe on unmount)

## [feat/symbol-chat-to-ai-host Round 1–2 | 종목 챗봇 폐지 → ai.siglens.io | 2026-09-20]
- Violation: Removed the `hideView` hidden mount on the news/fundamental/financials/congress/options tabs believing it existed only to publish chatbot context; it also kept `useRegisterShareable` running, so the header Share button would report "unavailable" whenever snapshot prose was shown
  - Rule: (new) Before removing a "mounted but hidden" component, list every hook it runs before its early return (share registration, analytics, prefetch), not only the one its comment names
  - Context: hidden mount restored; comments now name Share registration; tests assert the widget stays mounted with hideView and registers a shareable
- Violation: Moving fallbackAnalysis into the `@/entities/analysis` barrel broke src/__integration__/analysisFlow.test.tsx, which partially mocks that barrel — only the full suite caught it
  - Rule: (existing memory lesson) when adding exports to a barrel, grep for `vi.mock('<barrel>'` partial mocks
  - Context: the mock now forwards the real isFallbackAnalysis
- Violation: A test still mocked a deleted export (`SymbolLayoutFloatingChat`) and the new floating-link wiring had no composition-level test
  - Context: mock removed; layout test asserts AskAiFab receives the asset name and locale prefix
- Violation: The mobile floating button showed only a star icon, which reads as "favorite"
  - Context: sparkle icon + short visible label ("AI에게 묻기") on mobile

## [feat/siglens-about-redesign Round 1–2 | siglens.io /about redesign | 2026-09-24]
- Violation (pre-review, caught during implementation): `@/widgets/agent-chat` barrel imported into `src/views/about/AboutPage.tsx` (server-side view), leaking ~46 agent-chat client-side message keys into the route's `messages/_meta/clientKeys.json`
  - Rule: A view on one host must not import another product's widget barrel for a leaf utility (icons): the i18n extractor follows the import graph and attaches that barrel's client message keys to the route. Move the shared piece to `shared/` and import it directly.
  - Context: Moved icons to `src/shared/ui/StrokeIcons.tsx` and imported directly; barrel import removed. Verified clientKeys.json no longer includes agent-chat keys.

## [PR #871 CI e2e | feat/siglens-about-redesign | 2026-09-24]
- Violation: `page.locator('script[type="application/ld+json"]', { hasText: '"FAQPage"' }).toHaveCount(1)` returned 0 — `<script>` element text is not queryable with Playwright `hasText` filter
  - Rule: (new) Playwright `hasText` filters cannot query script element content; inline JSON requires `page.request.get()` + text assertions on SSR HTML
  - Context: Fixed e2e/specs/legal.spec.ts test to read `/about` with `page.request.get()` and assert response `toContain('"@type":"AboutPage"')` / `toContain('"@type":"FAQPage"')`, matching the pattern in e2e/specs/market-fear-greed.spec.ts

## [feat/google-ads-conversion Round 1–2 | Google Ads conversion tracking | 2026-09-24]
- Violation (R1, required): `src/features/agent-chat/hooks/useAgentStream.ts` — ad conversion tracking was added inside the public `send()` method, but `retry()` replays an HTTP-stage failure by calling `send()` again, so one logical question recorded the `chatQuestion` conversion twice. Comment above the tracking call claimed retry was excluded; reality did not match.
  - Rule: (new) When adding a side effect (analytics/tracking) to a public entry point, check every internal caller that re-enters that entry point (retry/replay paths). Side effects must be decoupled from the re-entrant path by splitting the entry point into an untracked internal method and a public method that applies the side effect, then calls the internal method. No test asserted the conversion count across retry.
  - Context: Split into an untracked internal `submit()` and a public `send()` that applies tracking then calls `submit()`; `retry()` now replays via `submit()` instead of `send()`. Retry test asserts the conversion fires exactly once; verified it fails if retry is reverted to `send()`.
- Status (R2): APPROVED (zero findings)

## [PR #873 CI + claude-review | feat/google-ads-conversion | 2026-09-24]
- Violation (CI failure): New client component `src/app/_components/GoogleAdsTag.tsx` imported `usePathname` from `next/navigation` directly; the repo-wide guard `src/shared/i18n/__tests__/useAppPathname.test.ts` fails on any non-allowlisted raw `usePathname` import.
  - Rule: (new) Components must use `useAppPathname` (locale prefix stripped) unless the file is deliberately added to `ALLOWED_RAW_PATHNAME_USERS` with a reason. Scoped test runs do not execute this guard — run the full suite once before push.
  - Context: The component only needs a route-change key, so it now uses `useAppPathname`; behavior is unchanged.
- Violation (caught by full suite while applying review Suggestion): Importing `SITE_HOST` from `@/shared/lib/seo` into `src/shared/config/googleAds.ts` (read at module load) broke `src/app/[locale]/account/__tests__/page.test.ts`, whose partial `vi.mock('@/shared/lib/seo')` lacks `SITE_HOST`; 25 of 60 tests mocking that module omit it.
  - Rule: (new) A widely imported config module must not read values from a frequently partial-mocked module at load time; keep the literal and guard against drift with a test that compares against the real constant.
  - Context: Reverted to the `'siglens.io'` literal with a comment; `src/shared/config/__tests__/googleAds.test.ts` asserts it equals `SITE_HOST`.

## [PR #872 Round 1 | feat/symbol-views | 2026-09-24]
- Violation: scripts/update-popular-cryptos.ts added visit-driven crypto candidates (from outside the hand-maintained CRYPTO_CANDIDATE_POOL) to POPULAR_CRYPTOS, which would break the existing invariant test `CRYPTO_CANDIDATE_POOL contains all current POPULAR_CRYPTOS symbols` as soon as the script's output was committed. Same class as the earlier dashboardScope/KR_CATEGORY_IDS issues in this PR: a new data source feeding a config list without checking every existing test-enforced invariant over that list.
  - Rule: (new) When a script gains a new path that appends to a config list, grep tests for invariants over that list and verify by applying the script's output to the real file and running the suite (dry run).
  - Context: Fixed with scripts/lib/cryptoPoolInsert.ts (pure anchor insert into the pool) + main writes the pool first. Lesson: when a script's new path appends to a config list, grep tests for invariants over that list and verify by dry-running the script's output against the test suite.

## [claude/siglens-email-login-redirect-jbr2s1 Round 4 | locale-prefixed guest-only path test coverage | 2026-09-25]
- Finding: RECOMMENDED (skipped as false positive) — reviewer requested a test for locale-prefixed guest-only `next` parameter (e.g., '/en/login?next=%2FAAPL')
  - Status: REJECTED — false positive; test coverage already exists at the assertion level. The existing test matrix includes locale-prefixed paths in the full parametrized test list, covering '/en/login?next=%2FAAPL' and '/ko/signup' alongside non-prefixed variants.
  - Rule: When adding path-based tests, grep the existing test matrix before marking coverage gaps; locale-prefixed and locale-free variants must both be present in the parametrized test list.
  - Context: Verified by reading the test assertions in src/entities/auth/__tests__/proxy.test.ts; the locale prefix is not a separate orthogonal dimension requiring additional test cases — it is already covered by the route parameter variations.


## [claude/siglens-analysis-technique-review-wvfffz Round 2 | AI chat tools pullback classification & budget | 2026-09-25]
- Violation: RECOMMENDED — src/app/api/ai/chat/tools/getBarsIndicators.ts: 4-way classification written as nested ternary (ternary inside TRUE branch of another ternary)
  - Rule: FF.md Readability 1-E — no nested ternaries
  - Context: Extracted `classifyPullback()` with early returns to eliminate nesting.
- Violation: RECOMMENDED — src/app/api/ai/chat/tools/__tests__/getBarsIndicators.test.ts: new variable-length field (`pullback.measured`) added to budget-trimmed tool result without testing its interaction with the budget trimmer
  - Rule: (new) Tests — a new field inside a size-budgeted payload must have a test exercising its interaction with the budget logic
  - Context: Added overflow test comparing quiet vs lit reading; verifies more bars trimmed, field and newest bar intact.

## [perf/crawl-html-compression R1 | Cloudflare cache-rule documentation out of sync with code change | 2026-09-26]
- Violation: docs/architecture/CDN_CACHING.md prescribed "강한 ETag ON" (Cloudflare should respect strong ETags) while the PR set `generateEtags: false` in next.config.ts without updating the documentation. The toggle ON was itself part of the root cause since Cloudflare does not compress strong-ETag responses.
  - Rule: (new) When a code change invalidates a setting that an operator runbook prescribes, update the runbook in the same PR
  - Context: Updated docs/architecture/CDN_CACHING.md R1 to 강한 ETag OFF with the measured reason (strong ETag blocks Cloudflare compression; identity-filled cache served 209KB instead of 39KB gzip).

## [fix/washout-entry-verdict R1 | 눌림 판독 진입 판정(core 1.17.1) + 평균 회귀 스킬 digest 정합 | 2026-09-26]
- Violation: skills/strategies/mean-reversion.md — digest의 "near setup"절이 `trend: neutral`을 명시하지 않았다. A/B 측정 결과: near 판독이 prompt에 주입되면 AI가 trend bullish를 19/20 선택 → 스킬 규칙 위반(near는 정의상 neutral).
  - Rule: (existing) Skill digest는 분석 프롬프트에 주입되는 유일한 skill 정보 — digest의 모든 경우(setup/near/below/non-daily)가 prompt 소비자의 trend 결정을 정확히 가이드해야 한다. digest 변경 후 A/B를 돌려 near 판독의 trend이 규칙과 일치하는지 확인.
  - Context: digest의 near절에 "trend stays neutral" 명시 추가, 본문 MA200 아래 손실 꼬리 문구를 core 1.17.1의 재측정 수치로 정합. 실측 후속: washout enter 0/25→23/25, near 평균 회귀 trend bullish 19/20→2/20, washout 날 전체 trend bearish 88%→36%.
- Dependency: siglens-core #228 — 일봉 상승 추세 속 짧은 눌림(Williams %R ≤ -90)이면 룰 엔진이 enter 판정을 싣는다. 이 PR의 스킬 digest 수정과 함께 적용해야 수정이 완성된다. 분석 캐시(1Day) 키 변경 없음 — core 프롬프트 내용 변경만.

## [PR #878 | perf/crawl-html-compression | 2026-09-26]
- Violation: Tradeoff rationale for `generateEtags: false` was scoped to Googlebot only and stated an unverified generalization ("the only HTML leaving the edge with an ETag is the poisoned uncompressed variant"); browser measurement showed gzip-passthrough pages (`/AAPL`, `/NVDA/news`) keep a strong ETag, so real-user revisits do lose 304.
- Rule: (new) A tradeoff comment must cover every client class the setting affects (crawlers AND browsers), and each factual claim must be measured with that client's actual request headers
- Context: next.config.ts `generateEtags` comment — corrected the ETag-stripping claim and added the real-user revisit cost plus the Cloudflare "Respect strong ETags" OFF alternative that keeps 304.

## [PR #881 Round 1 | fix/seoptimer-audit-actions | 2026-09-27]
- Violation: CI e2e failure — `e2e/specs/seo-smoke.spec.ts` hard-coded `Crawl-delay: 60` while the unit test referenced the exported constant; lowering `AI_CRAWLER_CRAWL_DELAY_SECONDS` to 10 broke only the e2e. Root cause of the miss: when changing the constant, the implementer grepped src/ and docs/ but not e2e/.
  - Rule: (new) When changing a constant's value, grep its literal value repo-wide (src/, e2e/, docs/, scripts/), not only src/ and docs/ — e2e specs are not run by scoped unit tests, so a stale literal there only surfaces in CI. Prefer tests that import the constant over re-stating the literal.
  - Context: e2e now imports the constant from `@/app/robots`.
- Violation: After moving the confidence tooltip next to the section heading with `left-0 w-56`, the box anchored to the ⓘ button (~130px from the left) would overflow a 320px viewport. The tooltip's `relative` anchor was the ⓘ wrapper itself.
  - Rule: (new) When relocating an absolutely positioned popover, recompute its box against the narrowest supported viewport (320px) from its new anchor's offset; `left-0`/`right-0` choices that were safe at the old anchor can overflow at the new one.
  - Context: Moved the `relative` anchor from the button to the header row (the tooltip's immediate container), so the box now anchors to the section's left content edge rather than the button's position.

## [PR #883 | feat/portfolio-menu | 2026-09-27]
- Violation: CI e2e failure — moving the holdings add/edit/delete UI (PortfolioSection) from `/account` to `/portfolio` left 6 authed specs (`portfolio-holdings.spec.ts`, `portfolio-position.spec.ts`, `personalized-analysis.spec.ts`) navigating to `/account` for a form that no longer lives there, and using the stale region name `'보유종목'` (now `'보유종목 관리'` on `/portfolio`) and the stale h1 `'계정 설정'`/`'내 포트폴리오 위치'` (now `'포트폴리오'`). None of `typecheck`/`lint`/`vitest` caught this — the specs only fail live in CI under Playwright.
  - Rule: (new) When a UI section is relocated to a different route (not just a trigger/condition narrowed — see MISTAKES.md Tests §3, which covers only removed/narrowed triggers), grep e2e/specs/ for every helper and locator scoped to the old route (page.goto target, heading text, aria-label region name) and update them in the same PR. This is a distinct failure shape from a narrowed trigger: the whole navigation target moves, so page.goto, h1 text, and region names all go stale together.
  - Context: Updated `resetAaplHolding`/`addAaplHolding` helpers and heading assertions in all 3 specs to target `/portfolio`, `'포트폴리오'` (h1), and `'보유종목 관리'` (region). Verified via `yarn tsc --noEmit -p e2e/tsconfig.json` (specs cannot run locally — no DB/secrets in this harness) plus a full manual re-read against `PortfolioSection.tsx`/`page.tsx` source labels.
## [PR #882 Round 1 | fix/bot-analysis-parity | 2026-09-27]
- Violation: Claude-review R3 Blocker — UA-based concurrency bonus (BOT_STREAM_LIMIT_MULTIPLIER) became an abuse vector once bots trigger paid generation. Route reads User-Agent to classify as bot and apply higher concurrency limit; generic script clients match bot UA pattern.
  - Rule: (new) Request-based abuse vectors (rate-limit bypasses) must not read headers that generic clients also send; read-only token/fingerprint headers instead. UA header (User-Agent) is sent by all clients and can be spoofed — route should not use it for concurrent-request gating without explicit allowlist verification.
  - Context: Removed BOT_STREAM_LIMIT_MULTIPLIER so the route no longer reads UA; all clients now route through the same concurrency limit regardless of UA. Abuse vector closed.

- Violation: RECOMMENDED — format-check violations introduced during implementation (prettier/oxlint conflicts not resolved before push)
  - Rule: Run `yarn format:check` before committing code with editor or formatter changes. Format violations must be resolved with `yarn format:write` in the same commit.
  - Context: Caught by CI after implementation round; no formatter drift remains.

- Violation: Missing test coverage — congress regression test not created for new functionality
  - Rule: (new) When adding a new analysis path or consensus mechanism, include a regression test verifying the congress decision across multiple inputs. Test name should include "congress" or "consensus" to clarify its role in predicting regressions.
  - Context: Added regression test for bot congress decision logic verifying path selection consistency.

- Incident: Review subagent (sub-agent during review phase) ran formatter in write mode (`yarn format:write`) and then executed `git checkout -- <file>` on five files, silently wiping uncommitted edits to three of them (had to be rewritten manually).
  - Rule: (new) Review agents must remain read-only: no git operations, no formatter write passes, no file modifications. Before invoking a review agent on a branch with uncommitted work, back up the diff with `git stash` or `cp -r` to a temp directory. Recovery after `git checkout --` requires manual rewrite if the diffs were not backed up.
  - Context: Review agent invoked on branch with uncommitted changes; agent ran format:write then checkout without detecting the unintended destruction. Lesson: use `git stash` before review invocation, then restore with `git stash pop` after review phase completes.

## [claude/funny-turing-9cgfid Round 2 | dead-code + stale-comment cleanup | 2026-09-28]
- Violation (REQUIRED ×1): ARCHITECTURE.md cited views/symbol (pages layer) as an example of a widgets↔widgets cross-import exception. views/symbol is a pages-layer route, not a widget; it does not participate in the documented exception.
  - Rule: Documentation examples must reference actual code patterns that exist. When documenting an architectural exception, cite a real widget edge (one that the codebase actually exhibits), not a made-up example.
  - Context: Changed citation to fear-greed → chart, which are actual widgets that cross-import and are documented as a valid exception.

- Violation (RECOMMENDED ×1): ARCHITECTURE.md folder tree structure listed nonexistent `src/__tests__/fixtures/` directory. The adjacent line of the same section had just been edited in the same revision, indicating the deletion was missed during that edit pass.
  - Rule: Documentation structural lists (folder trees, examples, file inventories) must be kept synchronized with actual filesystem structure. When editing adjacent sections, spot-check for stale paths and delete them alongside the edit.
  - Context: Removed the nonexistent directory reference from the folder tree.

## [claude/funny-turing-9cgfid Round 1 review | barrel-removal codemod self-caught issues | 2026-09-28]
- Violation: Import-rewriting codemod treated an intentional mock seam as a barrel export and rewrote it to direct import
  - Rule: Mock seams (architectural re-exports created solely to enable test mocking of dependencies) must be preserved during automated rewrites. src/app/api/analysis/stream/runAnalysisBridge.ts re-exports core runAnalysis to allow route.test.ts to mock it independently from the full module. Barrel-removal codemods that rewrite re-exported symbols to their origin sources eliminate the mock seam.
  - Context: Orchestrator's review caught the broken pattern (route + tests now imported '@y0ngha/siglens-core' directly instead of through the seam). Reverted to seam re-export; added route to test allowlist so the seam is preserved through future codemod runs.

- Violation: Codemod dropped comments attached to vi.mock statements and factory properties
  - Rule: Automated code rewrites must preserve comments via full AST traversal. The implementation used getText(), which excludes leading trivia (comments). When rewriting mock statements or factory property definitions that bear explanatory comments, the comments were silently dropped.
  - Context: Orchestrator caught the missing comments during verification. Fixed by restoring trimmed comments from git HEAD followed by manual review of all removed comment lines. Ensured all factory properties that describe mocking intent now carry their comments through the codemod pipeline.

## [feat/core-detectors-consume Round 1 | feat/core-detectors-consume | 2026-09-28]
- Violation: new strategy skills gated on core signals told the model to "interpret only if listed in the detected-signal section", but core never renders those signal names (excluded from the confluence list; used only for gating)
  - Rule: (new) A skill's instructions must reference only prompt sections/fields that core actually renders for its trigger — verify against the consumed core version's prompt builder before writing "if listed in …" guards
  - Context: Reworded to "injected only when the engine detected …; derive the side from bar data / Market Reference".
- Violation: skill template criterion that is always true under its own trigger (close above MA120/200 on a new 52-week high) made a trend branch unreachable
  - Rule: MISTAKES Predictability — conditions must be falsifiable under the trigger that injects the skill
  - Context: Removed the criterion; neutral branch now "MA(200) falling or stack not met".

## [PR #856 merge-conflict resolution | master → feat/symbol-chat-to-ai-host | 2026-09-29]
- Violation: While merging master into a branch that deletes a whole slice (widgets/chat, features/symbol-chat, entities/chat-message), master had ADDED new test files inside those deleted directories (src/widgets/chat/__tests__/hooks/useChatBranches2.test.tsx, src/entities/chat-message/__tests__/localeEnvelope.test.ts which git relocated via directory-rename detection to src/entities/analysis/__tests__/lib/) and a new test (src/views/symbol/__tests__/ChartContent.overlayHighlight.test.tsx) importing from the deleted slice. The additions merged silently (no conflict marker), so only a repo-wide grep for the deleted module paths caught them.
  - Rule: (new) After merging base into a branch that deletes a slice, grep the whole repo for the deleted module paths/exports and check for files added inside deleted directories, not just the listed conflicts.
  - Context: deleted the orphan tests, repointed overlayHighlight test to @/entities/analysis and entities.analysis.fallback; also updated the controlBorderTokenGuard AnalysisPanel line key (master 1187 minus 2 lines removed by the branch = 1185).

## [claude/funny-turing-9cgfid Round 3 | exception-safety refactoring + line-number regression | 2026-09-28]
- Violation: Self-caught during implementation — edit shifted AnalysisPanel line numbers, breaking a line-number-keyed exception in src/__tests__/guards/controlBorderTokenGuard.test.ts before commit.
  - Rule: Line-number references in code/tests are fragile after refactoring. After non-trivial edits, run guards before committing to catch such breakages.
  - Context: Caught and fixed by running guards in pre-commit phase. Line number reference in controlBorderTokenGuard.test.ts corrected.

## [PR #890 Round 2 | dead-code + stale-comment cleanup | 2026-09-29]
- Violation: CI React Doctor error — replacing local `mounted` state with `useHydrated()` hid the hydration guard from the analyzer → `createPortal(document.body)` flagged as unguarded browser global
  - Rule: (new) React Doctor analyzer requires explicit `typeof document !== 'undefined'` guard to recognize browser-only code paths; extracting hydration guards into helper hooks (useHydrated, useIsMounted) breaks the analyzer's literal scope detection. When refactoring hydration checks, add explicit typeof guard in addition to helper-based extraction.
  - Context: Added explicit `typeof document !== 'undefined'` guard before `createPortal(document.body)` call in component body. Analyzer now recognizes the guard and does not flag document as unguarded.

- Violation: CI React Doctor error — touching a file re-exposes pre-existing findings under `--scope changed` due to handoff/start GET cookie side effect; the findings are by design (applied repo's existing inline react-doctor-disable convention to these routes)
  - Rule: Routes with intentional, documented side effects (handoff/start GET cookie in auth flows) use `/* @react-doctor-disable */` marker to suppress analyzer findings. When touching the file during cleanup, apply the existing convention inline rather than resolving the marked violations.
  - Context: Applied `/* @react-doctor-disable */` comment to the cookie side-effect code in handoff and start routes, matching the pattern used in sibling auth routes. Findings suppressed while preserving intended behavior.

- Violation: claude-review suggestion — `let` + `if` reassignment pattern in intlFormatCache (MISTAKES.md §14)
  - Rule: MISTAKES.md Coding Paradigm §14 — prefer ternary/conditional expressions (const) over imperative reassignment (let)
  - Context: Code already documented in MISTAKES.md as recurring pattern; no fix needed in this round.

- Violation: claude-review suggestion — inline options object type in truncate (MISTAKES.md §5.2)
  - Rule: MISTAKES.md §5.2 — inline type annotations must be extracted to named type aliases
  - Context: Code already documented in MISTAKES.md as recurring pattern; no fix needed in this round.

- Violation: claude-review suggestion — test-reset method exposed on production interface in singleFlight; repo convention requires separate `__reset*ForTests` exports
  - Rule: (new) Test utility methods must not be exposed on production interfaces. Separate `__reset*ForTests` exports (e.g., `__resetForTests`, `__resetCacheForTests`) allow tests to reset internal state without polluting the public API surface.
  - Context: The singleFlight utility exports a public `reset()` method on its production interface. Should refactor to separate `__resetForTests` export and remove reset from production interface, following the repo's established pattern.

## [PR #856 merge-conflict resolution round 2 | master barrel-removal refactor → feat/symbol-chat-to-ai-host | 2026-09-29]
- Violation: master landed a repo-wide barrel removal (all slice index.ts deleted; CLAUDE.md now forbids barrels). The branch had added a new barrel (src/widgets/ask-ai-fab/index.ts) and imports via barrels (@/entities/analysis, @/features/share, @/widgets/ask-ai-fab). A per-hunk "take master side, strip chat lines" resolver also dropped branch-only imports that sat in the same hunk (ShareableAnalysisProvider/useShareable in three widget tests), caught only by tsc.
  - Rule: (new) When resolving conflicts mechanically by taking one side, diff each hunk's other side for branch-only additions (imports, mocks) before discarding it; always follow with tsc. When base removes a convention (barrels), grep the branch's own new files for the old pattern too.
  - Context: deleted ask-ai-fab/index.ts, switched to deep imports, restored the share imports, updated controlBorderTokenGuard AnalysisPanel key to 1142, replaced CONVENTIONS.md example that referenced the deleted symbol-chat slice.

## [PR #892 Round 2 | feat/navigation-pending-ui | 2026-09-29]
- Violation: NavigationPendingProvider context value and startNavigation function recreated on every render (new object identity each render)
  - Rule: MISTAKES.md Coding Paradigm §10 — derived constants recreated on every render without memoization
  - Context: Wrapped both context value object and startNavigation callback with useMemo/useCallback respectively, enabling child useContext subscriptions to skip unnecessary re-renders.

- Violation: LocaleLink's onNavigate wrapper used `let cancelled` closure mutation pattern (`cancelled = true`) to signal cancellation
  - Rule: MISTAKES.md Coding Paradigm §5 — array/object mutation via direct assignment; MISTAKES.md §22 — missing unit tests for critical paths
  - Context: Replaced mutation with a callerCancelled() helper function; added missing tests for onNavigate delegation path and cancellation behavior.

- Violation: useUserTier hook carried redundant `!isError` guard alongside `isPending` check
  - Rule: MISTAKES.md Coding Paradigm §4 — leaving logic that has no effect; dead code filtering/checking
  - Context: Removed redundant `!isError` condition; `isPending` check already guards the error state.

- Violation: SymbolTabs pending-highlight branch lacked unit tests
  - Rule: MISTAKES.md Components §22 — incomplete test coverage for conditional branches
  - Context: Added unit tests asserting pending highlight renders when navigation is in-flight to the target timeframe.

- Violation: useTimeframeChange pending state cleared only when target matched current value; forced mid-switch timeframe change (logout → free tier) left spinner stuck indefinitely
  - Rule: (new) State reset paths must account for ALL ways a state machine can transition, not only the intended path. Forced transitions (policy-driven, tier-dependent) are as valid as user-initiated changes.
  - Context: Changed pending clear condition from equality check to range test: pending cleared whenever timeframe leaves its starting value (now handles logout→free forced change).

- Violation: Duplicated pending-slot UI structure (hidden spinners + label positioning) in two separate files
  - Rule: MISTAKES.md Coding Paradigm §6.9 — duplicated logic across multiple locations without shared source
  - Context: Extracted to shared/ui/PendingSlot component; both callsites now render unified structure via explicit import.

## [PR #893 Round 2 | feat/chart-overlay-item-toggles | 2026-09-30]
- Violation: CI e2e failure — e2e/specs/chart-overlays.spec.ts still asserted removed behavior (category toggle persisted in localStorage across reload); unit tests were updated to reflect new all-on default after reload, but the e2e spec was not synchronized
  - Rule: (new) When refactoring a feature's test suite to reflect behavior changes, all test layers (unit + e2e) must be updated simultaneously. Unit test updates without corresponding e2e assertions create CI failures where the contract is broken at the integration level while unit tests pass.
  - Context: Updated e2e spec to assert new all-on default after reload and added menu↔AI-panel sync e2e test case. Synchronized behavior across all test layers (unit + e2e).

## [PR #895 Round 1 | fix/fib-label-extraction | 2026-10-01]
- Status: APPROVED (claude-review suggestions applied)
  - Applied fixes: Extracted fib level label kind→text mapping into `formatFibLevelLabel` helper function in `src/widgets/chart/utils/fibLevelLabel.ts` with unit tests; extracted 'ABC ' and 'ext ' prefix constants as named exports for reuse.
  - Skipped (false positive): messages/ko.json key reordering — the canonical output of `node scripts/i18n/extract.mjs --write` does not constitute a violation; i18n extraction script defines the authoritative key ordering.

## [feat/level-right-extend Round 1–2 | chart overlay visibility toggle | 2026-10-01]
- Violation: toggle-visibility predicate in StockChart ignored hidden overlay keys (shown setting with no visible effect)
  - Rule: (new) UI state predicates filtering a key list must apply the filter predicate to all keys, not only to a subset. A "shown" setting that excludes a key from rendering but leaves it in the key check causes inconsistency between the control and the visible output.
  - Context: Fixed by applying hidden-key filter to toggle predicate logic; verified toggle now correctly hides/shows overlays.
- Violation: missing lifecycle/render tests for lightweight-charts series primitive
  - Rule: (new) Primitives wrapping third-party chart libraries that manage their own lifecycle (mount, update, unmount) must include integration tests verifying lifecycle methods are called at expected render boundaries. Lifecycle management without test coverage leaves render-order regressions undetected.
  - Context: Added tests covering series mount/update/unmount lifecycle for lightweight-charts integration.

## [Round 1 | claude/magical-sagan-56eoov (SEO prewarm reduction) | 2026-10-01]
- Violation: A new exported constant's JSDoc was inserted between an existing JSDoc block and its declaration, orphaning the old doc
  - Rule: JSDoc blocks must remain directly above their declarations; inserting new docs between them breaks the association
  - Context: src/shared/lib/seo.ts — moved the old JSDoc back directly above NOINDEX_SYMBOL_METADATA
- Violation: getBlockedSymbolMetadata still performed a snapshot DB read whose result could no longer change the outcome for the five tabs made always-noindex
  - Rule: Optimization — remove redundant operations that no longer affect the outcome
  - Context: Added isPrewarmTab and skip the read for non-prewarm tabs
- Status (Round 2): APPROVED (zero findings)

## [Round 1 | claude/magical-sagan-56eoov (news category cron ingestion + cacheNonEmpty) | 2026-10-01]
- Task: hub prewarm cron now ingests news categories before baking digests (3h gate, enrichment cap 8); ingestion extracted to `ingestMarketNewsCategory`; `cacheNonEmpty` promoted to shared and applied to `/news/[category]` list.
- Violation: A per-run work cap (enrichment limit 8) combined with a long re-run gate (3h flag) made the initial backlog drain extremely slowly (~50 cards → ~20h), with each partial drain also changing a downstream cache key (digest regeneration). Undocumented. Fix: ingestion returns `pending`; the long gate is set only when the backlog is empty, so the backlog drains on consecutive short-interval runs.
  - Rule: (new) when combining a per-run cap with a cooldown/gate, the gate must not engage while capped work remains (or the drain time = backlog/cap × gate must be documented and acceptable).
- Status (Round 2): APPROVED (zero findings)

## [Round 1 | claude/magical-sagan-56eoov-hub-data (hub data supply: cron ingestion, null/empty cache guards, briefing cooldown, digest A/B) | 2026-10-01]
- Violation: Time-budget comment claimed a cron unit doing ingest (capped) + analysis (8) + sequential translations (3) could fit 45s timeout; real worst case ~65-70s
  - Rule: (new) when a unit chains several capped LLM steps under a timeout, budget = sum of each step's worst case; document it next to the caps
  - Context: lowered caps (4, 1) and corrected the budget math in comments
- Violation: A target whose inner functions already revalidate the tag also returned 'generated', so the runner revalidated again (plus pointless Redis getdel)
  - Rule: (new) Optimization — remove redundant operations that no longer affect the outcome
  - Context: added HubTarget.selfInvalidating flag to prevent duplicate revalidation
- Violation: Hard-coded count ("eleven targets") in comment derived from config
  - Rule: MISTAKES.md §15 — magic numbers in comments must reference the constant
  - Context: replaced with reference to config length
- Status (Round 2): APPROVED (zero findings)

## [PR #900 Round 1 | claude/magical-sagan-56eoov-hub-data | 2026-10-01]
- Violation: CALENDAR_MAJORITY_FAILURE_DIVISOR duplicated in two economy modules synced only by comment
  - Rule: MISTAKES.md Coding Paradigm §6.9 duplicated logic
  - Context: extracted constant to economyCalendarConstants and imported by both modules
- Violation: cache-key-participating option (digest `reasoning`) written as literal at three call sites (action, cron, SSR peek) that must agree
  - Rule: cache-key components shared by writer and reader live in one constant
  - Context: extracted DIGEST_REASONING constant (now false per user decision). Single source of truth for cache participation.

## [Round 1 | fix/news-ingest-firehose-gate | 2026-10-01]
- Violation: (production logs, not review) drain-until-empty termination condition never terminated for fast feeds (`stock`/`crypto` receive 10–50 new articles per 10 minutes while the cron enriches at most 8 per run), so `pending` stayed 26–42 and the gate never engaged (re-ingest + digest regeneration every ~10 min)
  - Rule: (new) A drain-until-empty termination condition must be bounded when the source keeps producing — add a sufficiency condition (here: enriched >= the consumer's input cap, 25) so a continuously refilling queue cannot defeat the cooldown
  - Context: `ingestMarketNewsCategory` now returns `enriched`; `ingestCategoryBeforeDigest` marks the gate when `pending === 0 || enriched >= MAX_AGGREGATE_NEWS_ITEMS`
- Violation: (review round 1, recommended, fixed) three comments went stale/overstated after the rule change (limit JSDoc contradicting new rule; "result used only for logging"; "won't change the screen" overclaim instead of stating the up-to-3h lag tradeoff)
  - Rule: comments describing a rule must be updated in the same change that alters the rule; state tradeoffs instead of claiming no effect
- Status (Round 2): APPROVED
