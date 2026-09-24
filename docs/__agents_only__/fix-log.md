
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

## [feat/visitor-metrics Round 1 | visitor presence tracking | 2026-09-02]
- Violation: `src/app/api/presence/route.ts` handler declared an invariant in comments — "aggregation failure must not break user screen" — and wrapped `repo.recordVisit()` in try/catch. But `getDatabaseClient()`, which throws when `DATABASE_URL` is unset, sat OUTSIDE that try block. One failure mode on the same code path bypassed the stated containment, returning bare framework 500 instead of the deliberate log-and-204.
  - Rule: (new) A try/catch that guards one call on a path does not guard the path. When code states a containment invariant, every call on that path that can throw must be inside it — including setup and client-construction calls, which are easy to overlook because they look infallible.
  - Context: Moved `getDatabaseClient()` and repository construction inside the try block, returned early on failure so a dead DB does not consume the module-scope `lastPrunedDate` day marker (which would have suppressed retention pruning for the rest of that day). Regression test added and verified to fail without the fix.

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
- Violation: CI FAILURE — `i18n extract drift`: `messages/_meta/skips.json` line numbers shifted when source file was edited with comment insertions, invalidating skip markers without regenerate.
  - Rule: After source file edits that shift lines in code with skipped i18n literals, regenerate skip markers by running `yarn i18n:extract --write` before push; skip positions become stale and extract drifts.
  - Context: Regenerated with `yarn i18n:extract --write` (idempotent). Root cause: earlier review-fix commit edited source with skipped literals; extract was not re-run. Same drift occurred on sibling branch `seo/ymyl-wording-fg-fixes` in this session.

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

## [PR #813 | feat/agent-tool-analysis-context | Post-approval suggestions | 2026-09-14]
- Violation: getDescriptor(profile) computed twice in one object literal
  - Rule: MISTAKES.md Rule 2 — Identical values queried or computed multiple times in a single function
  - Context: Hoisted duplicate computation outside object literal.
- Violation: Agent bars tool sliced raw detectCandlePatternEntries instead of using core selectLastCandlePatternEntries like the chart markers and analysis prompt
  - Rule: (new) Sibling consumers must use identical data selection logic; inconsistent data selectors cause derived systems to diverge
  - Context: Updated agent bars tool to use selectLastCandlePatternEntries, aligning with chart markers and analysis prompt.

## [PR #814 | feat/agent-data-tools-wiring | Post-approval suggestions | 2026-09-14]
- Violation: Magic number 13 (ISO date-hour slice end) duplicated in three files
  - Rule: MISTAKES.md Rule 15 — Hardcoded literals in function names or calculations
  - Context: Centralized ISO_DATE_HOUR_SLICE_END constant to shared/config/time.ts, updated all three call sites.
- Violation: countsBySector object mutation with for...of
  - Rule: MISTAKES.md Rule 104 — Array/object mutation via push/splice or direct property assignment
  - Context: Rewrote with Object.groupBy + Object.fromEntries for immutable construction.

## [feat/economy-calendar-tz Round 2 | economy calendar UTC timezone | 2026-09-14]
- Violation: FMP economic-calendar `date` field ("YYYY-MM-DD HH:mm:ss") was assumed to be ET wall-clock time across etTimeUtils, /economy calendar grid, KR indicator cards, and DB column comment (`date_et`); live FMP data from authoritative known-time events (Fed decision 18:00 UTC, CPI 12:30 UTC) proves it is UTC. /economy grid displayed release times 4-5 hours wrong for months.
  - Rule: External API field semantics must be verified against known reference events, not inferred from comment consensus or existing code patterns
  - Context: R1 review argued for ET treatment based on code/DB-comment consensus; R2 resolved by authoritative live check against known event times. Root cause: timezone assumption for an external API field was never validated; tests encoded the same wrong assumption, so unit coverage verified nothing. Fixed by normalizing all consumption points (etTimeUtils, grid, card indicators, DB comments) to treat `date` as UTC.
- Violation: FMP economic-indicators endpoint called without `to` parameter returns stale rows ending 2025-12-01 (9 months old) with no error signal; fixed by passing `to=today`
  - Rule: External API results must be validated for staleness/completeness when the API offers filtering parameters (date range, limit) — bare calls may degrade silently to cached or partial data
  - Context: Added `to` parameter to FMP economic-indicators fetch, ensuring fresh data is returned. Issue discovered during production verification of /economy route.
- Status: APPROVED (Round 2, zero findings)

## [PR #823 | feat/ai-conversation-switch-no-skeleton Round 1 | 2026-09-15]
- Violation: SUGGESTION — `aria-busy:opacity-60` state styling incomplete. Missing cursor and text color indicators for busy state.
  - Rule: DESIGN.md mistake 4 — aria-busy state must include all three visual indicators: opacity, cursor, and secondary text color.
  - Context: Enhanced to `aria-busy:cursor-progress aria-busy:text-secondary-400` alongside existing opacity.

- Violation: SUGGESTION — delete-active redirect handler and navigation handler both called navigate(), duplicating responsibility.
  - Rule: MISTAKES.md Cohesion — Extract repeated navigation patterns into a shared handler to eliminate duplication.
  - Context: Extracted `startNavigationTo(href)` helper. Both redirect and navigate paths now call it instead of duplicating navigate logic.

## [PR #823 | feat/ai-conversation-switch-no-skeleton | Post-approval suggestions | 2026-09-15]
- Violation: SUGGESTION (accepted) — pending navigation signalled only visually via `aria-busy` state; no announcement to screen readers
  - Rule: WCAG 2.1 — Dynamic state changes that affect application state must announce to assistive technology; visual-only signalling creates screen-reader blind spot
  - Context: Added always-mounted `role="status"` sr-only live region in Sidebar with i18n key `widgets.agent-chat.Sidebar.navigating` (4 locales + hash). Live region now announces navigation state to assistive technology.

- Finding: Review suggested using LocaleLink instead of raw `<a>` + `router.push` for in-app navigation
  - Status: REJECTED — false positive; LocaleProvider's `hrefBase=SITE_URL` makes LocaleLink emit absolute siglens.io URLs (cross-origin full navigation), breaking ai.siglens.io in-app conversation switching pattern

## [PR #823 | feat/ai-conversation-switch-no-skeleton | Round 2 | 2026-09-15]
- Violation: useHideOnScrollDown hook had only 2 consumers but was placed in shared/hooks, creating maintenance overhead for a single-feature pattern
  - Rule: MISTAKES.md Components Rule 15 — Shared hooks must serve generic/cross-feature patterns; feature-specific hooks with 2 or fewer consumers must live in their feature/widget layer
  - Context: Moved useHideOnScrollDown to widgets/layout/hooks and exported via widgets/layout barrel. Verified consumers import from new location.

- Violation: setState called directly in effect body for disabled branch condition without early return for non-disabled path
  - Rule: MISTAKES.md Components Rule 10 — Derived state updates in effect must either branch conditionally before effect runs, or return from effect body before setState; avoid setState in effect main body
  - Context: Refactored to add early return when disabled flag is true; setState now only executes for enabled state path.



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

## [feat/agent-confluence-sr-tests | siglens-wt-confluence | 2026-09-15]
- Violation: `useEffectEvent` (notifyNavigated) in src/widgets/agent-chat/Sidebar.tsx declared after derived values and handlers
  - Rule: MISTAKES.md Components Rule 17 — All hook calls must be declared before derived variables and handlers. Strict ordering: useState/useRef → useQuery/useMutation/custom hooks → useCallback/useMemo → derived variables → handlers → useEffect
  - Context: Moved `useEffectEvent` to correct position right after `useOnClickOutside`. Part of recurring pattern on this feature: ChatShell useState placement, Sidebar hook ordering, handlers positioning.

## [fix/seo-b-copy-jsonld Round 1 | seo/index-footprint-recovery | 2026-09-15]
- Violation: RECOMMENDED — loadMarketSignals loaded CachedMarketDataProvider 3 times per request without request-scope deduplication → redundant Data Cache reads
  - Rule: (new) RSC data loaders used in multiple places within one request must wrap with React cache() to eliminate redundant fetches from the same provider call
  - Context: Server-cached providers like CachedMarketDataProvider return the same data; calling them multiple times per request wastes the cache boundary. Fixed by wrapping loader in React cache(). Scope parameter removed (was defeating cache key). Verified: getMarketSummary, getMarketNotice, getMarketCalendar now deduplicate to single provider call per request.

## [PR #838 | fix/node24-icu-hydration | Post-approval suggestions | 2026-09-18]
- Violation: ~300-char ICU hydration guard logic duplicated in Dockerfile builder and runner stages; risk of updating only one during maintenance
  - Rule: CONVENTIONS.md — Extract duplicated logic/constants to a single source; both stages must call the same script
  - Context: Extracted to `scripts/assert-icu-locale.mjs` and called from both stages. Added `.gitignore` allowlist entry for `/scripts/**` exception.

## [fix/seo-meta-description-markdown Round 2 | fix/seo-meta-description-markdown | 2026-09-18]
- Violation: single-marker italic regexes (`/\*(.+?)\*/g`, `/_(.+?)_/g`) lacked lookaround boundaries, so two unrelated `*` or `_` in a sentence were treated as a pair and the text between them was deleted (e.g., `BRK_A와 BRK_B` → `BRKA와 BRKB`, `250*2 … 100*3` → `2502 … 1003`). The function's output feeds `<meta name="description">`, making the truncation visible to search engines.
  - Rule: MISTAKES.md Pattern Matching #20.5 — regex patterns must use lookaround boundaries to match intended text only; unguarded inline delimiters across multiple potential markers cause false phrase boundaries and unwanted deletions
  - Context: Fixed with lookaround boundaries (non-whitespace inside, no word char / same marker outside) plus regression tests in `src/shared/lib/stripSnapshotMarkdown.ts`.

## [fix/seo-cls-sitemap-polish Round 4 | PWA banner Polish | 2026-09-18]
- Status: APPROVED (zero findings)

## [feat/hub-briefing-ssr-seed Round 3 | briefing cache surface stability | 2026-09-18]
- Status: APPROVED (zero findings)
## [PR #827 | feat/ai-provider-fallback-core-170 | 2026-09-15]
- Violation: BLOCKER — agent provider fallback decided per turn, not per step. Stalling DeepSeek re-costs the 90s stall timeout every step of a multi-step turn, creating cascading retries within a single inference request.
  - Rule: Core logic — retry/fallback state must be sticky across all steps of a multi-step operation; re-evaluating fallback on every step doubles timeout costs.
  - Context: Changed fallback decision to set `state.fallbackUsed` on first timeout, then skip re-evaluation on subsequent steps. Fallback now remains sticky for the entire inference session.

- Violation: SUGGESTION — `providerFallback: true` comment repeated identically at 7 prewarm configuration sites; configuration intent is explicit but duplication hides the shared policy.
  - Rule: CONVENTIONS.md — repeated hardcoded patterns must be extracted to shared constants; duplication obscures intent and creates consistency drift.
  - Context: Extracted shared constant `PREWARM_PROVIDER_FALLBACK = true` in `src/shared/config/prewarm.ts`; all 7 sites now reference it. Single source of truth for fallback policy.

## [fix/seo-internal-links Round 1 | SEO internal linking strategy | 2026-09-18]
- Violation: New nullable `Date` column (`seo_analysis_snapshots.first_generated_at`) was threaded through read path but `unstable_cache` JSON round-trip rehydration in `getSnapshotStatic.ts` was not extended to it — sibling fields `generatedAt`/`updatedAt` are rehydrated there with JSDoc explaining exactly this failure mode. On cache hit, field was a string while declared type said `Date | null`.
  - Rule: (new) When adding new Date fields to cached query results, extend JSON round-trip rehydration logic alongside all sibling Date fields; cache round-trip creates type mismatches if rehydration is selective. JSDoc on sibling fields already documents the failure mode.
  - Context: Fixed by rehydrating new field and adding unit test covering both populated row and `null` row on cache hit.

- Violation: New i18n key (`widgets.layout.footer.symbols`) placed in `shared.seo` namespace and consumed by client-rendered `Footer`, leaked that server-only namespace into every client payload.
  - Rule: i18n namespace containment — server-only namespaces (shared.seo) must not be consumed by client-rendered components; use client-permitted namespaces (widgets.layout). Namespace pollution increases payload and masks content scope.
  - Context: Moved key to `widgets.layout` namespace before use. Existing guard (`clientKeyCoverage`) now correctly rejects shared.seo in client code.

## [fix/symbols-copy-and-names Round 1 | /symbols 표기·문구 | 2026-09-18]
- Violation: `as Record<string, TickerDisplayName>` 캐스트에 보증 주석이 없었다. 몇 줄 아래 형제 함수 `getKoreanNames`의 동일한 캐스트에는 있다.
  - Rule: MISTAKES.md TypeScript §7 + §6.7 — safe-cast 보증 주석은 필수이고, 같은 규칙이 형제 호출부 중 한쪽에만 적용되면 안 된다.
  - Context: `flatMap`이 `readonly [string, TickerDisplayName][]`만 만든다는 근거를 주석으로 남겼다.

- Violation: `unstable_cache`가 빈 결과를 24시간 캐시할 수 있었다. 하위 리더(`getTickerDisplayNames`·`getCryptoAsset`)가 DB 실패를 삼키고 빈 값을 성공처럼 돌려주기 때문에, 순간적인 실패 한 번이 하루짜리 품질 저하가 된다(stale-while-revalidate라 만료 후 첫 요청도 옛 값).
  - Rule: (신규) 캐시 래퍼는 "정상적으로 비어 있음"과 "실패해서 비어 있음"을 구분해야 한다. 하위 리더가 에러를 삼키면 캐시 경계에서 던져야 한다 — 거부된 promise는 캐시되지 않는다.
  - Context: `readSymbolNames`가 이름을 하나도 못 모으면 던지고, `loadSymbolNames`가 그것을 잡아 빈 맵으로 떨어뜨린다. 이름은 사라져도 링크는 남는다.

- Violation: 페이지 `<h1>`이 `<title>` 문자열을 그대로 써서 검색용 꼬리표(`— 미국·한국 주식과 암호화폐`)가 화면에 찍혔다.
  - Rule: (신규) 검색 결과용으로 쓴 제목 문자열을 화면 헤딩으로 재사용하지 않는다.
  - Context: `app.symbols.page.heading` 키를 따로 두고 h1·가시 브레드크럼·BreadcrumbList `name`이 그것을 쓴다. `<title>`만 꼬리표를 유지한다.

- Violation: (recommended) TTL 리터럴이 `24 * SECONDS_PER_HOUR`로 재계산돼 있었고 페이지는 같은 값을 `86400`으로 하드코딩했다. `SECONDS_PER_DAY`가 이미 있다.
  - Rule: MISTAKES.md §15 — 같이 움직여야 하는 두 값에 공통 출처가 없으면 드리프트한다.
  - Context: TTL은 `SECONDS_PER_DAY`에서 파생하고, 페이지의 `revalidate` 리터럴과의 일치는 소스를 읽는 parity 테스트가 고정한다(Next가 `revalidate`를 정적 분석해 import를 못 쓴다).

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

- Violation: Three `[...messages].reverse().find(...)` calls in `MessageList.tsx` mutated a spread copy to find the last matching message, instead of the non-mutating ES2023 method that does the same lookup directly.
  - Rule: `docs/conventions/CONVENTIONS.md` — prefer immutable array methods (`arr.toReversed()` over `arr.reverse()`, etc.); `.findLast()` is already established in the repo (`src/views/symbol/utils/technicalFacts.ts`).
  - Context: Replaced all three call sites with `messages.findLast(m => m.role === ...)`.

## [PR #849 Round 2 | feat/agent-precomputed-data | 2026-09-19]
- Status: fixed (both findings already documented in MISTAKES.md §0.5 and Coding Paradigm #17)

## [PR #849 Round 3 | feat/agent-precomputed-data | 2026-09-19]
- Status: fixed (finding already documented in MISTAKES.md §0.8)
- Rejected: [Suggestion] move getBarsIndicators derived-metric helpers to entities/bars/lib — reviewer marked non-blocking and pre-existing pattern in the same directory; a ~300-line move is a separate refactor, out of this PR's scope.

## [fix/portfolio-money-rounding Round 1 | get_my_portfolio 금액 반올림 | 2026-09-19]
- Violation: 금액(marketValue/costBasis/pnl)을 지표용 유효숫자 6자리 반올림(`roundNumber`)으로 처리해 1만 달러 이상에서 센트가, 100만 이상에서 일의 자리가 잘림 — value − cost ≠ pnl
  - Rule: (new) 금액은 통화 최소 단위(USD 2자리, KRW 0자리)로 반올림한다. 유효숫자 반올림은 크기에 따라 자릿수가 바뀌어 금액에 쓰면 안 된다
  - Context: 회원 실측에서 10,874.63달러가 10874.6으로 나와 모델이 "10,874.60달러"로 답함. `roundMoney`/`moneyDecimals` 추가
- Violation: `Number(x.toFixed(2))`로 반올림해 이진 부동소수 경계(150.005 → 150.00)에서 한 센트 틀림
  - Rule: (new) 금액 반올림에 `toFixed`를 쓰지 않는다 — 크기 기준 상대 엡실론 보정 후 `Math.round`(half-away-from-zero), 지수 문자열 왕복은 부동소수 잡음(1e-13)을 NaN으로 만들므로 금지
  - Context: 리뷰 라운드 1 지적. 부호 대칭·-0 정규화 포함

## [feat/ai-about-page Round 1–2 | AI about page design spec | 2026-09-19]
- Violation: Sibling JSDoc (`AI_ROBOTS_BODY` in src/proxy.ts) stated the locale home was the AI host's only public surface after `/about` became public; the neighbouring comment on `aiSitemapXml` had been updated but this one was missed
  - Rule: MISTAKES.md Documentation §15.6 — Comment accuracy; when documentation neighbours are updated, all related neighbours must be checked for stale references
  - Context: Corrected JSDoc to reflect that `/about` is now also public. Pattern of stale comment adjacent to updated one.

- Violation: Page test suite covered only the default locale; failed to test /en route with non-default language href
  - Rule: (new) i18n-enabled pages must test at least one non-default locale route to verify href and translations are not locale-specific
  - Context: Added test covering /en locale with href assertions for the non-default language variant.

- Violation: Helper function `raw` (forwarding i18n keys) did not start with `t`, so scripts/i18n/extract.mjs did not recognize calls — `yarn i18n:extract --write` silently deleted 25 keys only referenced through that helper
  - Rule: (new) i18n helper functions forwarding i18n keys must be named `t…` (e.g. `tRaw`) for extract.mjs pattern match /\bt\w*(\.(rich|markup|raw))?\('key'/; any other naming defeats extract, causing deletion of "orphaned" keys when --write is run
  - Context: Renamed `raw` → `tRaw`; re-ran `yarn i18n:extract --write` to restore deleted keys.

- Violation: Running `yarn i18n:translate --locale X` to translate ~140 new keys re-translated 1,633 existing en keys on master branch (1,612 ko keys lack hash entries in messages/_meta/hashes.json, causing re-translation when hash lookup fails)
  - Rule: (new) Do not run `yarn i18n:translate` on branches adding only new keys; instead add en/ja/zh translations by hand (following recent commit patterns) and verify with `yarn i18n:verify`, or check `--dry-run` count first to avoid cascading re-translation of approved keys
  - Context: Learned when attempting to batch-translate new keys; the hash cache is incomplete on master, making re-translation too risky. Used manual additions for this batch.

## [PR #852 claude-review R1 | ai.siglens.io/about | 2026-09-19]
- Violation: Function return type written as inline object type duplicating existing interface AiSeoCopy
  - Rule: CONVENTIONS.md — named return types + MISTAKES.md TypeScript §5 — reuse existing interfaces instead of duplicating shape inline
  - Context: Moved AiSeoCopy to shared/config/aiHost.ts and reused it in the return type annotation
- Violation: Four small components in one file declared inline prop types without named interfaces
  - Rule: CONVENTIONS.md — Props interface must be declared above each component, not inline on the component parameter
  - Context: Extracted *Props interfaces (AboutCopyBlockProps, AboutCtaProps, AboutStatProps, AboutHeroProps) and declared above their respective components
- Violation: Playback state machine (wait/play) defined inside useEffect instead of at module level
  - Rule: MISTAKES.md Components §14.5 — State enums and state machines must be module-level, not inside hooks; useEffect is for effects, not state definitions
  - Context: Extracted to module-level lib/replayPlayer.ts with explicit PlaybackContext enum and unit tests
- Violation: Hook order violation — useRef declared after a custom hook, and derived values declared after an effect
  - Rule: MISTAKES.md Components §17 — Strict hook order: useState/useRef → useQuery/custom hooks → useCallback/useMemo → derived variables → handlers → useEffect
  - Context: Reordered all hooks and derived values in the component to match the established order
- Violation: Module-level beforeAll outside describe block in test file
  - Rule: MISTAKES.md Tests §3 — All setup functions must be inside describe() scope, never at module level
  - Context: Wrapped beforeAll and test suite in a describe() block
- Violation: Decorative accent colour on ~10 elements (icon boxes, arrows, chip borders, source tags, caret, labels) across 2 components
  - Rule: DESIGN.md accent-color guidelines — accent colour reserved for primary actions, links, focus states, and active indicators only; max 2 per viewport. Decorative accents weaken visual hierarchy and waste the primary-action signal
  - Context: Removed primary-* classes from decorative elements (icon boxes, arrows, chip borders, source tags, caret, labels). Added UI review checklist item: grep new .tsx files for `primary-` and justify each use against DESIGN.md rules
- Violation: New pure/helper module lib/aboutContent.ts with no colocated unit test
  - Rule: MISTAKES.md Components §22 / DESIGN.md checklist §6 — All new pure/helper modules must include colocated unit test file
  - Context: Added lib/aboutContent.test.ts with tests covering the module's exports and edge cases
- Suggestion (fixed): Magic delay numbers (300, 900, 350, 120 ms) in the replay playback steps had no constant names
  - Rule: MISTAKES.md §15 — Hardcoded numbers in function bodies must be named constants with clear intent
  - Context: Named FIRST_START_MS, NEXT_START_MS, AFTER_TYPING_MS, TOOL_GAP_MS, BEFORE_ANSWER_MS in src/views/ai-about/lib/replayPlayer.ts

## [PR #852 claude-review R2 | ai.siglens.io/about | 2026-09-19]
- Violation: A render test listed in the implementation plan (AboutCtaBar, plan Task 3) was never written; the plan task was silently skipped
  - Rule: (new) Before requesting review, diff the plan's test list against the test files actually created
  - Context: Added src/views/ai-about/ui/__tests__/AboutCtaBar.test.tsx (title, href, header-hidden translate class)
- Violation: Pure helper `groupLines` mutated objects already stored in its result (`last.items.push`); `parseReplayLine` built its result with push
  - Rule: MISTAKES.md Coding Paradigm §21 — pure calculations use reduce/flatMap, not imperative push
  - Context: groupLines rewritten with reduce; parseReplayLine rewritten with split + flatMap (src/views/ai-about/lib/replayScript.ts)
- Violation: `isLocale(x) ? x : DEFAULT_LOCALE` repeated across three ai route files
  - Rule: MISTAKES.md §1 — check for / extract a shared helper instead of repeating logic
  - Context: Added resolveLocale() to src/shared/i18n/locales.ts and used it in app/ai/[locale]/{page,about/page,c/[id]/page}.tsx
- Violation: New content width (max-w-4xl) on the ai host with no entry in the DESIGN.md width convention
  - Rule: DESIGN.md §폭 규약 — a new width value must be documented with its reason
  - Context: Added a row for ai host /about (max-w-4xl, 2-column card grid; chat surfaces stay max-w-3xl)
- Violation: The sticky CTA bar repeated the hero h1 sentence on the same first screen
  - Rule: (guideline) Chrome copy that sits next to a headline should add information, not echo it
  - Context: Bar copy changed to "로그인 없이 무료로 바로 물어볼 수 있어요" (views.ai-about.cta.title, all four locales)

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

## [fix/seo-snapshot-desc-tab-prefix Round 1 | SEO description collision across symbol tabs | 2026-09-20]
- Violation: `buildSnapshotMetaDescription` in `src/shared/lib/seo.ts` prefixed only `${subject} — ` and clamped AI prose at `SEO_DESCRIPTION_MAX_LENGTH`. When two tabs' snapshots opened with the same long sentence, the clamp cut before they diverged, returning byte-identical descriptions across tabs. Measured in production 2026-09-20: `https://siglens.io/SOXS/overall` and `https://siglens.io/SOXS/fundamental` both returned 193-char descriptions.
  - Rule: Metadata fields derived from dynamic content must include a route/view discriminator in the prefix to prevent collision across different routes serving the same subject.
  - Context: Added `symbolTabDescriptionLabel(tab, assetClass, t)` helper with required `label` param; all 7 `generateMetadata` call sites under `src/app/[locale]/[symbol]/` now pass the tab-specific label, so prefix is `${subject} ${label} — `. Added unit test (`src/shared/lib/__tests__/symbolTabDescriptionLabel.test.ts`) asserting each tab's built title contains its label, because label key table and title builders pick catalog keys independently and both are `string` to the compiler.

## [fix/seo-snapshot-desc-tab-prefix Round 2 | not-found page SEO metadata inheritance | 2026-09-20]
- Violation: `src/app/[locale]/not-found.tsx` returned `generateMetadata` with only `title` and `robots`, so Next inherited the root layout's `description`: every non-existent URL shipped the home page's `<meta name="description">`. Measured on production 2026-09-20 on `/ZZZZZ`, `/nonexistent-page-xyz`, `/news/nosuchcat`.
  - Rule: Every `generateMetadata` export must explicitly set all metadata fields; unset fields inherit from parent layout, causing search engines to crawl duplicate `<meta>` with identical content across error boundaries.
  - Context: Fixed by populating `description` metadata field with already-translated 404 body copy (`app.home` key `not-found.03ecab`) with whitespace collapsed.

## [feat/agent-discovery + feat/agent-kr-signal-scan R1–R5 | 에이전트 종목·코인 발굴 + 미연결 도구 배선 | 2026-09-20]
- Violation (R1, required): `AGENT_PROMPT_VERSION` 범프와 `AGENT_TOOL_SPECS` 설명 변경에 `docs/PUBLIC_API.md` 변경 행을 추가하지 않았다 (siglens-core)
  - Rule: core MISTAKES.md — 모든 공개 API·프롬프트 버전·툴 설명 변경은 같은 커밋에 날짜 행을 남긴다
  - Context: 리뷰어가 같은 누락이 앞선 세 PR(refactor/cheap-jobs R1, feat/agent-adaptive-depth R1, feat/agent-require-refetch R2)에도 있었다고 지적. 2026-09-20 행 두 개 추가
- Violation (R3, required): `DashboardScopeId`/`DASHBOARD_SCOPES`에 `'crypto'`를 추가하자 화면 없는 scope가 `src/app/api/cron/seo-prewarm/hubs.ts`의 `marketBriefingTargets()`에 자동 편입됐다. 그 함수는 `Object.values(DASHBOARD_SCOPES)`를 돌며 `runBriefing()`(실제 LLM 호출)을 부른다 — 아무도 읽지 않는 크립토 브리핑을 매일 밤 생성하는 비용 회귀
  - Rule: (신규) 공유 유니온·레지스트리 레코드를 넓히면 그 레지스트리를 일반적으로 순회하는 **모든** 코드에 새 멤버가 조용히 편입된다. 순회 지점에서 id를 하드코딩해 거르지 말고, 레코드에 능력 플래그를 두어 다음 멤버가 **결정을 하도록** 강제한다
  - Context: `DashboardScope.hasHubPage` 필드 신설(us·kr true, crypto false), 프리웜이 그걸로 필터. 기존 `hubs.test.ts`는 기대 개수를 `Object.keys(DASHBOARD_SCOPES).length`에서 **직접 파생**해 이 회귀에 구조적으로 눈이 멀어 있었다(그 테스트는 "빠진 표면"만 잡도록 의도된 것). 변경 파일만 대상으로 한 되돌림 검증도 이 파일을 건드리지 않아 못 잡았다 — 테스트를 `PAGE_SCOPES` 상수 기준으로 바꾸고 "화면 없는 scope는 프리웜에 없다"를 따로 단언
- Violation (R3, recommended): 같은 확장으로 `'crypto'`가 페이지 전용 Server Action 3종(`getSectorSignalsAction`, `getMarketSummaryClientAction`, `submitMarketBriefingAction`)의 유효 입력이 됐다. 셋 다 `isDashboardScopeId`만으로 검증해, 네트워크로 직접 부르면 화면 없는 scope의 시세 조회·브리핑 생성을 시킬 수 있었다
  - Rule: (신규) 네트워크에서 직접 호출 가능한 Server Action은 "앱이 아는 값인가"가 아니라 "이 진입점이 다루는 값인가"로 좁힌다
  - Context: `isPageDashboardScopeId`(= `hasHubPage`) 신설 후 세 액션에 적용
- Violation (R4, recommended): 가드를 좁히면서 다른 참조 지점의 주석이 낡았다 — `src/app/api/analysis/stream/route.ts`가 여전히 `isDashboardScopeId`를 가리켰다
  - Rule: MISTAKES.md §15.6 — 주석 정확성. 가드·상수를 바꾸면 그것을 설명하는 다른 자리도 같은 커밋에서 갱신한다
  - Context: 주석을 `isPageDashboardScopeId`로 정정
- Note: 배선 4건(뉴스 카테고리 다이제스트, 시장 브리핑 peek, 공포·탐욕 `comparisons`, 종목 자체 공포·탐욕)과 R3 수정 2건은 각각 되돌림 검증을 거쳤다 — 소스를 원복하면 해당 테스트가 실패한다

## [chore/deps-2026-09 Round 1 | 의존성 업그레이드 | 2026-09-24]
- Violation (R1 REQUIRED, fixed): oxlint 1.79+ `react/globals`를 `oxlint-disable-next-line`으로 억제했다(테스트 프로브가 렌더 중 모듈 변수에 `useQueryClient()`를 대입)
  - Rule: 새 lint 규칙이 테스트 헬퍼를 잡으면 억제 주석 대신 근본 수정 — Provider가 만든 값을 읽을 땐 `renderHook(() => useX(), { wrapper: Provider })`
  - Context: `src/app/__tests__/providers.test.tsx`의 `ClientCapture` 프로브 제거
- Violation (R1 REQUIRED, fixed): 프레임워크 메이저/마이너 업그레이드에서 **기본값이 뒤집힌 플래그**를 확인·언급 없이 넘겼다(Next 16.3: `validateRSCRequestHeaders`·`prefetchInlining`·`varyParams`·`optimisticRouting`·`appNewScrollHandler`)
  - Rule: (new) 프레임워크를 올릴 때는 구·신 `defaultConfig`를 diff하고, 뒤집힌 플래그 중 테스트·오프라인 빌드로 관측되지 않는 것(CDN·라우터·캐시 계약)은 프로덕션 빌드 + 실제 브라우저로 계약을 실증해 설정 파일 주석에 남긴다
  - Context: `next start` + Playwright로 RSC 요청 전수 캡처(RSC 헤더·`_rsc` 쿼리 동반, `text/x-component`, 307 0건). next.config.ts에 계약·재확인 요구 기록
- Pre-empted (not a review finding): client-s3 3.1138이 `@aws-crypto` 의존을 없애 Dockerfile의 해당 COPY가 이미지 빌드를 깨뜨리게 됨. PR CI는 Docker 빌드를 안 돌려 못 잡는다 — SDK를 올릴 땐 runner 수동 COPY 목록만 담은 격리 디렉터리에서 실제 요청을 보내 확인
