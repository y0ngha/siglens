
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

## [PR #564 | fix/fmp-cache-and-earnings-gate | 2026-06-04]
- Violation: Redis 캐시 키(buildBarsRawKey)가 GetBarsOptions의 일부 필드만 포함(limit 누락) → 옵션 확장 시 서로 다른 요청이 같은 캐시를 반환할 충돌 위험
  - Rule: (신규) 캐시 키는 결과에 영향을 줄 수 있는 모든 입력 필드를 포함해야 한다 (cache key must cover every result-affecting input field)
  - Context: CachedMarketDataProvider.buildBarsRawKey에 limit 포함(Gemini 리뷰 반영). limit은 timeframe 종속이라 분할 없이 미래 충돌만 방지. (B1 entities/lib Date.now() 순수함수 위반은 MISTAKES §Architecture #0.7 / Tests #14에 이미 문서화되어 기록 생략.)
- Violation: getNextEarningsReport가 entities/lib에서 side effect(Date.now/DB/FMP) 포함 — 순수 함수 레이어 위반 (pre-existing, R3 Blocker)
  - Rule: MISTAKES §Architecture #0.7 — entities/{slice}/lib/는 순수 함수 전용
  - Context: PR #564 R3 claude 리뷰에서 Blocker로 지적. pre-existing이라 별도 PR로 분리(이슈 #565). nextEarningsReport.ts JSDoc에 TODO(#565) 링크를 남겨 추적. 이번 PR diff엔 미수정(scope = 캐시/gate).

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

## [PR #678 | agent/seo-index-quality-gate | 2026-07-08]
- Violation: The checked-in exit-signal hook allowlist omitted newly added agent names.
  - Rule: Tooling allowlists must be updated atomically with the agents they validate.
  - Context: Added `issue-agent` and `mistake-managing-agent` to `KNOWN_AGENTS` so their valid exit signals are accepted.


## [PR #690 | claude/mobile-ai-analysis-ui-42kyji | 2026-07-17]
- Violation: 첫 분석(서사 없음) 로딩을 AnalyzingBanner(광고 없음)에서 AnalysisProgress로 교체하면서 `isFreeUser`를 전달하지 않아, 기본값 `true`로 인해 Pro 사용자에게도 로딩 중 AdBanner가 노출됐다. 같은 파일의 기존 AnalysisPanel 호출도 동일하게 미전달 상태였다.
  - Rule: 티어 게이팅 prop(isFreeUser 등)을 소비하는 컴포넌트를 렌더할 때, 게이팅 값을 명시적으로 전달해야 한다 — "안전한 기본값"에 의존하면 유료 티어에 무료용 표면(광고)이 새어 나간다.
  - Context: ChartContent에서 이미 destructure된 `tier`로 `const isFreeUser = tier !== 'pro'`를 계산해 AnalysisProgress·AnalysisPanel 두 호출 모두에 전달. claude[bot] 리뷰 Blocker 반영.

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
- Violation: `MarketSummaryPanel.test.tsx` mock of `MarketDataErrorNotice` destructured only `onClose` prop, swallowing the new `variant` prop added in R2
  - Rule: Test mocks must mirror the full component API; destructuring only-used props masks regressions when new props are added
  - Context: Updated mock to destructure both `onClose` and `variant`, preventing future prop additions from silently passing broken mocks.
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
- Violation: Nine `<h2>` on the route carried NO colour class, so they inherited `body { color: var(--color-secondary-50) }` and rendered at the h1's brightness. Consequence: seven `<h3>` cross-link card titles rendered bigger AND brighter than two `<h2>` that outrank them. Root cause is invisible in source review — "no colour class" does not look like a defect; only measuring the computed colour of the rendered heading exposes it. Fixed by routing every h2/h3 through the existing `HEADING_SECTION` / `HEADING_SUBSECTION` tokens. Measured after: exactly three groups, H1 x1 / H2 x12 / H3 x17, strictly descending on size, weight and prominence, zero ties.
  - Rule: (new) Heading color hierarchy — every heading must inherit or explicitly apply a semantic colour token; headings without colour classes inherit default body text weight and render indistinguishable from body content
  - Context: Applied HEADING_SECTION to all h2s, HEADING_SUBSECTION to all h3s. Measured contrast after: all boundaries distinct.

- Violation: Same file family, opposite direction: in `CrossLinkCards` the EMPHASISED current-page card (border-primary-500 + ring) had a DIMMER title (`secondary-100`) than its unemphasised siblings (inherited `secondary-50`). Emphasis and brightness pointed opposite ways.
  - Rule: Emphasis tokens (border-primary, ring) and text-colour tokens must align — bright emphasis + dim text is discordant
  - Context: Changed card title to inherit secondary-50 (or primary-text for current card) to align with emphasis.

- Violation: Review round 1 filed a recommended finding on ONE file hardcoding a literal byte-identical to `HEADING_SECTION`. Grepping the literal's colourless prefix showed the finding was the tip of a larger one — 26 sites use `text-lg font-semibold tracking-tight` with no colour class at all. Lesson: when a reviewer reports a single instance of a token-vs-literal drift, grep the literal (and its prefixes) before fixing just the reported line.
  - Rule: (guideline) Reviewer reports of individual style drift must trigger a full grep of the literal (and key prefixes) to surface all instances before fixing only the reported line; single-instance fixes hide systemic drift
  - Context: Grepped `text-lg font-semibold tracking-tight` across codebase; found 26 sites. Fixed all 26 to use design tokens.

## [W6c — WCAG defects the UI audit surfaced | redesign-p1 | 2026-08-25]
- Violation: The 상세 분석 switch was invisible in the light theme: track 1.03:1, white thumb on it 1.01:1. It is not exempt as "disabled" — when locked it stays clickable (opens the signup nudge), carries `cursor-pointer`, and sets no native `disabled`. Fixed with `border-border-control` on track and thumb; after: light 3.10/3.30/7.85, dark 3.74/3.57/8.41.
  - Rule: WCAG 1.4.11 Contrast (Graphics) — interactive control boundaries must meet 3:1 minimum, even in locked state if still clickable
  - Context: Applied `border-border-control` token to locked switch (now meets 3:1+ in both themes). Added unit test asserting locked state still clickable + meets contrast.

- Violation: Form-field and outline-button boundaries below 3:1 in both themes while `--color-border-control` (built for exactly this) went unused: ContactTextField, ContactTextareaField, ChatPanel's textarea, ReanalyzeButton.
  - Rule: (guideline) UI control boundary tokens (border-control) must be used wherever 1.4.11 contrast is required; boundaries using other tokens (border-secondary, border-primary) often fall short. Audit all interactive controls for 3:1 minimum.
  - Context: Applied `border-border-control` to all 4 controls. Measured after: all meet 3:1+ in both light/dark themes.

- Violation: A child element overrode its parent's `text-ui-warning-text` (the on-tint TEXT token) with `text-ui-warning/90` (the GRAPHICS token), giving 3.56:1 on 12px text. Same trap the codebase already documents for `ui-*` vs `ui-*-text`.
  - Rule: MISTAKES.md already documents: never mix `ui-*` (graphics/background tokens) with `text-ui-*-text` (text-on-tint tokens). Tokens are semantically paired; override breaks the pairing. This is a repeat of documented guidance.
  - Context: Changed child to inherit `text-ui-warning-text` from parent (or re-apply if override necessary). Contrast now 8.2:1+ on 12px.

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
- Violation: A heading whose `className` contains NO colour token inherits `body { color: var(--color-secondary-50) }` — the brightest tier — so it renders at or above its own parent heading's prominence. Found at `NewsAiSummary.tsx:136,160`. **Inheriting the brightest colour ALWAYS passes a contrast check**, so a contrast sweep structurally cannot detect this: a 225-element both-theme sweep reported 0 failures while the defect was live.
  - Rule: Colourless headings are a HIERARCHY defect, not a contrast defect, and need their own detector — extract every `<h[1-6] className="...">` literal and flag any whose class list contains none of `text-secondary-` / `text-primary-` / `text-ui-` / `text-chart-` / `text-white` / `text-grade` / `sr-only`
  - Context: SECOND occurrence — W6c fixed nine colourless h2 on `/[symbol]/overall` for the identical reason. Detector caveat: the regex cannot see `className={SOME_CONSTANT}`, which is how `widgets/fundamental/**` and `widgets/financials/**` hide six more instances behind per-file `HEADING_CLASS_NAME` constants. Fixed the two in this route's scope; the other six are logged per-wave.
- Violation: Same defect class with the colour present — `MarketNewsDigest.tsx:83,109` used `text-sm font-semibold text-secondary-100`, the same colour AND same weight as its own h2 (which uses `HEADING_SECTION`), differing only by size.
  - Rule: A "has a colour class" check passes this; only comparing a heading against its own PARENT heading catches it
  - Context: Both moved to `cn('mb-2', HEADING_SUBSECTION)`.
- Violation: A single reviewer finding on one file was the tip of a repeating shape. Grepping the reported literal's prefix showed eight sites sharing the identical `mb-2 text-sm font-semibold` h3 pair, one per `*AiSummary` component.
  - Rule: When a reviewer reports one instance of token-vs-literal drift, grep the literal AND its prefixes before fixing only the reported line
  - Context: SECOND occurrence — the same lesson was recorded in W6c. Fixed the two in scope; logged six for W6e/W6f/W6h rather than editing unaudited routes.
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
  - Round 1 finding (fixed): `docs/superpowers/specs/2026-09-02-visitor-metrics-design.md` §14.3–14.5 described the removed privacy-policy effective-date gate as the current design. Specification documented behaviour that implementation no longer contained — stale documentation left after the gate code was deleted. Fixed by retitling §14.4 "(철회됨)" with explicit "do not reintroduce" warning, correcting §14.5's deletion steps, and adding §14.6 recording the archival of the gate.
  - Development note: Two self-inflicted errors caught in this round, neither shipped.
    1. `git checkout -- <file>` destroyed uncommitted work. While falsification-testing (forcing three columns back to null to test the fixture), reverted the scratch edit with `git checkout --`, which restored the file to HEAD. That silently discarded the actual feature edit too, since it was uncommitted. Detected by grepping for the removed constant afterwards; the edit had to be re-applied. Lesson: save intended content first (stash/copy) rather than assuming `git checkout --` only undoes the most recent tweak.
    2. Anchored-replace assert used a string that did not match the text just written (missing backticks around an identifier). The assert fired before the file write, so nothing was corrupted — assert doing its job. Worth logging as evidence that the "anchor + assert, never line-slice" rule prevents data corruption.

## [feat/share-plain-language Round 2 | persist plain-language prose in share snapshot | 2026-09-05]
- Violation: RECOMMENDED — Whitespace-only `plain` input passed server validation. Server relied on client-side `trim()` instead of enforcing at the trust boundary (`assertValidInput.ts`).
  - Rule: (guideline) Input validation at server trust boundaries must not assume client filtering. Validate the actual constraint (trimmed + non-empty) server-side, do not delegate to client.
  - Context: Added `plain.trim().length > 0` check in `assertValidInput.ts`. Server now rejects whitespace-only strings before they reach business logic.

## [PR #796 Round 3 review fix | seo/index-footprint-recovery | 2026-09-11]
- Violation: BLOCKER — Two new asset-coverage surfaces (`/about` ko body text and `messages/ko.json` `shared.seo.about.description`) added but not registered in the existing sync guard `src/app/__tests__/supportedAssets.test.ts` `SURFACES` constant.
  - Rule: New route surfaces and canonical content strings must be added to per-surface guard lists (SURFACES, legal route e2e, proxy allowlists) before merge; omission creates silent drift between guard scope and actual surfaces.
  - Context: Added both to SURFACES; verified test fails if removed.
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
- Violation: JSDoc for `getDatabaseClient()` listed only the DATABASE_URL-unset condition and omitted the two new branches added in this round (throws when offline, null condition in `tryGetDatabaseClient`).
  - Rule: MISTAKES.md — API docs must stay in sync with implementation branches; stale JSDoc hides new code paths from maintainers.
  - Context: Updated JSDoc to document both branches (DATABASE_URL unset, offline mode active).

## [PR #799 | chore/core-1.0.4-prompt-currency | 2026-09-11]
- Violation: BLOCKER — `YahooFinancialStatementsProvider` added a new `reportedCurrency` field and threaded it through three mapper functions (`mapIncome`, `mapBalance`, `mapCashFlow`). Only the income-statement test asserted `reportedCurrency: 'KRW'`; the balance-sheet and cash-flow tests used `toMatchObject` without including the new field. Dropping the field or hardcoding `'USD'` in a Korean symbol test stayed green.
  - Rule: When a new field is threaded through sibling mapper functions, every sibling's unit test must assert it with a value that differs from the default. Tests using structural matchers (`toMatchObject`) without the new field silently tolerate omission bugs — the field may not be passed at all, and the test cannot tell.
  - Context: Fixed by asserting `reportedCurrency: 'KRW'` in both balance-sheet and cash-flow test cases. Verified by hardcoding `'USD'` in the `mapBalance` implementation and seeing the test fail as expected. Ensures all three mappers now have explicit currency field assertions.

- Violation: SUGGESTION — `value?.trim() || null` reported-currency normalization was implemented three times: once in `reportedCurrencyOf` (financialStatementsClient.ts), once inline in `fundamentalClient.ts`, and once inline in `yahooFundamentalMap.ts`. Reuse was impractical due to different module dependencies.
  - Rule: MISTAKES §1 — Extract repeated normalization patterns into a shared helper in `src/shared/lib/`; do not repeat the same pattern across three files, even if each site has slightly different dependencies.
  - Context: Extracted `normalizeReportedCurrency` to `src/shared/lib/reportedCurrency.ts` with unit tests covering null/whitespace/uppercase normalization. Updated all three call sites to use the helper. Verified: `yarn test src/shared/lib` passes, all consumers green.

- Violation: SUGGESTION — `submitNewsAnalysisAction` computed `assetClass` via `resolveAssetClass` and `currency` via a separate `currencyForSymbol` call. Sibling actions (`runFundamentalAnalysisAction`, `runOverallAnalysisAction`, `chatAction`) all use `resolveMarketProfile` to fetch both descriptor values atomically via `getDescriptor`.
  - Rule: Derive related descriptor values (asset class, currency, region, etc.) from one resolution path; separate resolution calls may drift if the underlying mappings diverge.
  - Context: Unified `submitNewsAnalysisAction` to use `resolveMarketProfile` + `getDescriptor`, matching the pattern of siblings. Single resolution point reduces risk of state divergence.

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

