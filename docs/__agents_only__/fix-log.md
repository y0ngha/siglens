
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
- Violation: `marketBriefingContextOf` JSDoc claimed "core's sanitizer normalizes `price: 0` sentinel for the cache key"; sanitizer only normalizes for the prompt, not the key
  - Rule: Documentation/comments must match actual implementation; mismatched claims hide behavioral gaps
  - Context: Corrected JSDoc to document what the sanitizer actually does (prompt normalization, not key normalization).
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
- Violation: The UI audit agent's first dark sweep reported 40 failures at 2.53:1, all fake — its tab was a background tab (`document.hidden === true`), which freezes `transition-colors` at their from-values. Also its first resolver ignored element `opacity`, making `disabled:opacity-40` buttons read 8.82:1 when they render at 2.26:1.
  - Rule: Contrast measurement in background tabs must call `getAnimations().finish()` to settle transitions; element opacity must be factored into computed contrast
  - Context: Corrected with settle + `getAnimations().finish()`; the same elements then resolved to 8.82:1.
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
- Violation: The UI audit's tab was a background tab (`document.hidden === true`), which freezes `transition-colors` at their from-values. One read returned dark-theme `rgb(244,244,246)` on a page whose body was light `rgb(22,24,29)`. Corrected with `document.getAnimations().forEach(a => a.finish())` before every read.
  - Rule: (new) Contrast measurement in background tabs must settle all CSS transitions before reading computed colours; background tab freezes transitions at from-values, producing false contrast reads. Use `getAnimations().finish()` to settle.
  - Context: Applied settle pattern to all 12 contrast reads in audit script. Re-measured all 40 controls; fake failures vanished, real failures revealed.

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
- Violation: The UI audit's first colour resolver seeded the backdrop at `el.parentElement`, so any element carrying its own background was measured against the wrong ground — it reported the 회원가입 button at 1.06:1 when it renders at 6.70:1.
  - Rule: Composite backgrounds from the document root down through the FULL ancestor chain, never starting at the parent
  - Context: The audit self-caught this mid-run and re-measured.

## [W6e — /[symbol]/fundamental + /[symbol]/financials heading unification | redesign-p1 | 2026-08-25]
- Violation: Seven per-file `HEADING_CLASS_NAME` constants in `widgets/fundamental/sections/**` plus one shared constant in `widgets/financials/sections/constants.ts` all carried `text-lg font-semibold tracking-tight` with no colour class. Using a named constant appears disciplined, but defining it per-file still means "the same hierarchy defined in many places" and defeats the shared token — hiding it from a token grep. Additionally, `ProfileCard` had drifted to `text-xl`, leaving it 4px from the h1 with an identical inherited colour.
  - Rule: Heading design tokens must be shared (one definition per hierarchy level, e.g. HEADING_SECTION for h2). Per-file constants re-implementing identical class strings defeat the shared-token intent and hide token usage from grep.
  - Context: Consolidated seven per-file constants to centralized HEADING_SECTION and HEADING_SUBSECTION tokens in `typographyStyles.ts`, applied uniformly to all routes.
- Violation: Colourless-heading scanner had a blind spot that under-reported by more than half: the pattern `<h[1-6]\s+className="..."` only matches when `className` is the FIRST attribute, so `<h2 id={headingId} className="...">` was invisible. UI audit found one such site (`financials/sections/EmptySectionCard.tsx`) that the scan had passed.
  - Rule: (new) Heading element scanner must capture the whole tag `/<(h[1-6])\b([^>]*)>/s` then search the attribute blob for `className="..."`. Regex pattern matching on tag start + early attributes misses tags where `className` is not the first attribute.
  - Context: Corrected pattern to `/<(h[1-6])\b([^>]*)>/s` + search within attribute blob. Re-scan went from 6 hits to 13. Residual known blind spot: `className={SOME_CONSTANT}` is still invisible and needs a separate grep (logged in this wave for W6e).
- Violation: Changing a real component's heading size without changing its loading skeleton: the ProfileCard h2 went 20px -> 18px while `app/[symbol]/fundamental/page.tsx:187`'s skeleton stayed 20px, which would have shifted 2px on swap.
  - Rule: (guideline) Skeletons are a second definition of the same visual and must move with the real component. After any heading size/weight change, verify the skeleton reflects the new dimensions.
  - Context: Updated skeleton height to match new ProfileCard h2 dimensions.
- Violation: Grade chips failed AA in light theme (A 4.37 / B 4.39 / C 4.31 / D 4.48, need 4.5 for 14px bold) because `globals.css` documented the tokens as "4.9~6.5:1" — a number computed on a WHITE CARD, while the chips actually render on their own `/10` tint. The documented ratio was measured against the wrong background.
  - Rule: Contrast measurement must use the ACTUAL rendered background of the measured element, not a theoretical or alternate background. When tokens are reused on different tints (chips on tinted cards vs text on card backgrounds), measure each combination separately and update token values if needed.
  - Context: Fixed with `--color-grade-*-text` variants, mirroring the existing `ui-*` / `ui-*-text` split. Measured after: all grade chips pass 4.5+ in both themes.
- Violation: Review round 1 rejected first fix for a colourless CTA heading. Response kept `text-2xl` and only added colour, reasoning that breaking the exact tie was enough. Reviewer MEASURED the two tokens against each other — `secondary-50` vs `secondary-100` is ~1.07:1 dark / ~1.12:1 light — and showed the colour cue is imperceptible, so at `sm:` and up the h2 still matched the h1's 24px with only weight separating them.
  - Rule: (guideline) Distinguishability review: "one ramp step apart" is not automatically "distinguishable". Adjacent ramp steps must be measured against each other before being relied on as the sole cue. When review identifies semantic overlap, adjust size OR weight, not only colour.
  - Context: Changed h2 to 20px (from 24px), aligning to a distinctly lower rank. Contrast measured: semantic separation now clear on both size and colour.

## [W6e — data-correctness bug surfaced by UI audit | redesign-p1 | 2026-08-25]
- Violation: Four statement sections built `const columns = displayRows.map(r => r.fiscalYear)`, and that same string was used as BOTH the visible column header AND the React key at four sites (`StatementTable.tsx:106,145`, `FinancialTrendChart.tsx:237,263`). `fiscalYear` is not unique in the quarterly view — 2025 Q1–Q4 are all `"2025"`.
  - Rule: (new) A string used as both display label and React key has two independent correctness requirements, and the key requirement (uniqueness) is the silent one — it degrades data rather than the layout. Never reuse a non-unique display string as a React key; use a separate unique identifier.
  - Context: Reproduced on `/AAPL/financials`: clean annual = 5 columns with FY2025 revenue $416.2B; after toggling to quarterly = 8 columns labelled `2024, 2025, 2025, 2025, 2025, 2026, 2026, 2026`; after toggling back to annual = 10 columns where the "2025" column reads $124.3B (a QUARTERLY figure under an ANNUAL label), with real $416.2B pushed to the 4th "2025"; continued toggling grew to 15 columns. 354 React "two children with the same key" errors. Fixed at the source with one label helper instead of patching four `key=` props. Verification: captured console errors with in-page `console.error`/`console.warn`/`window.onerror` hook instead of reading Chrome's buffer (buffer persists across navigations and had served me a stale `ReferenceError` from hot-reload state two hours earlier).

## [W6f — /[symbol]/options + /[symbol]/congress heading and style rendering | redesign-p1 | 2026-08-25]
- Violation: The same section title "AI 옵션 분석" rendered FOUR different ways depending on data state — 18px with no colour class (inheriting body's secondary-50), 12px secondary-400 in bot-blocked branch, 12px in stale-notice branch, and 12px plain `<p>` in error branch whose `<section role="alert">` had no accessible name. Same `id="options-ai-analysis-heading"` but different element type, size, and colour across branches. A heading that changes size, colour, and element type depending on which data branch renders is invisible to any single-page audit — must enumerate the branches.
  - Rule: (new) Conditional branch coverage — When a component is gated on data shape, enumerate all rendering branches via fixture symbols that flip the gate, not by declaring branches unverifiable. A contrast sweep or heading audit that runs once sees only the active branch; multiple branches require multiple test conditions.
  - Context: Found by testing symbols where the hideView prop gates visibility. /CROX (no SEO snapshot prose), /SIEGY (non-optionable ADR + degraded congress path), /NVEC (zero congress trades) exposed AI view, empty states, and stale-data summary branch respectively.

- Violation: Expiration chips separated selected/unselected by hue only (blue vs neutral) with three colour-dependent cues (border, fill, text luminance deltas 2.03/1.17/1.14). While each cue individually passed WCAG contrast, the separation failed for colour-blind users — they perceive only brightness differences, which were below threshold for some cues.
  - Rule: (new) Colour-blind accessibility — A state indicator that separates only by hue fails for colour-blind users even when every individual cue passes contrast (WCAG 1.4.3). Independent cues (weight, shape, icon, border-style, pattern) must complement colour to ensure deuteranopia/protanopia distinction.
  - Context: Added font-semibold weight cue independent of hue. Border colour + weight + text weight now provide three independent signals.

- Violation: Turbopack served stale CSS for `globals.css` custom-property edits. File was correct on disk, `git diff` showed the change, tsc/oxlint passed, but `getComputedStyle(documentElement).getPropertyValue('--color-ui-success-text')` returned OLD value. `curl` of the served chunk returned OLD hash; `touch` did not help. Only `yarn clear:build` + dev restart picked it up. Earlier edits to the same file in the same session HAD recompiled (CSS syntax error took server to 500), so not always broken — goes stale at some point.
  - Rule: (new) Dev environment build cache — After editing a CSS token in globals.css or other hot-reload files, assert the token's OWN computed value BEFORE measuring anything downstream. Without that guard the conclusion becomes "the component fix didn't work", and the hunt goes into perfectly good component code. Symptoms: git diff correct, build passes, but runtime value stale.
  - Context: Added guard in audit script: read each token's computed value from documentElement before any measurements. If token value is stale, clear build cache and restart dev server before re-running audit. Caching issue is intermittent; may correlate with timing of stylesheet load vs property-value registration.
## [W6g/W6h — /[symbol]/fear-greed + /share/[id] | redesign-p1 | 2026-08-25]
- Violation: 색 없는 heading 스캐너의 오탐 하나를 규칙으로 굳혔다. `src/app/share/[id]/page.tsx`의 브레드크럼 h1은 **직접 텍스트 노드가 없고**(자식 span 넷이 각자 크기·굵기·색을 가짐) 상속색이 화면에 나타나지 않는다.
  - Rule: 스캔 조건은 "색 토큰 없음"만으로 부족하다 — **직접 텍스트 노드를 가진 heading**에만 적용한다
  - Context: 색을 얹으면 아무 데도 안 쓰이는 죽은 클래스가 된다. 코드에 근거 주석을 남겨 반복 지적을 막았다.
- Violation: 한 라우트의 h2를 고치자 그 컴포넌트를 공유하는 다른 라우트에 타이가 생겼다. fear-greed h2를 18/600/sec-100으로 올리니 `/share/[id]`의 브레드크럼 h1 티커 span(18/700/sec-100)과 크기·색이 같아졌고, 그 라우트엔 비교할 다른 h2가 없어 굵기만 남았다.
  - Rule: 공유 컴포넌트의 위계를 바꾸면 그 컴포넌트가 뜨는 **모든** 라우트에서 다시 재야 한다
  - Context: 공유 토큰을 다시 쪼개지 않고 h1 쪽을 `text-xl`로 올려 해결했다.
- Violation: 한 표현식에서 자초한 3단계 회귀. 각 단계가 개선처럼 보였다는 게 핵심이다.
  (1) 원래: 공유 링크 og/meta 설명이 `공포·탐욕 지수 42.73276474769012`인데 같은 페이지 본문은 `43`. 화면 컴포넌트는 이미 `Math.round`를 쓰고 메타만 예외였다.
  (2) 1차 수정: `typeof rawScore === 'number' && Number.isFinite(rawScore)` 가드로 반올림. 리뷰 통과.
  (3) 자체 의심: 대체한 코드가 `String(r.score ?? '')`라 값이 무엇이든 보여줬는데, 숫자만 받도록 좁히면 숫자 문자열일 때 점수가 통째로 사라진다 — 서식 버그를 정보 손실로 바꾸는 것.
  (4) 2차 수정: `typeof r.score === 'string' ? Number(r.score) : r.score`로 강제 변환 추가.
  (5) 그 2차 수정이 더 나쁜 결함을 만들었다: `Number('')`와 `Number('   ')`가 **0**이고 `Number.isFinite(0)`은 true라 폴백이 도달 불가가 되어, 빈 점수가 `공포·탐욕 지수 0`이라는 **없는 점수**로 나갔다. 리뷰가 실제 호출로 재현하고 상류까지 추적했다 — `isValidShareInput`은 `result`가 객체이고 65,536바이트 미만인지만 보며 docstring이 내용은 untrusted라고 명시한다. 즉 빈 문자열은 모든 계층에서 유효 입력이다.
  (6) 3차 수정: 강제 변환 전에 빈 문자열·공백을 제외.
  - Rule: `Number(x)`를 빈 문자열 가능성이 있는 값에 쓰는 건 파싱 위험이 아니라 **날조 위험**이다 — `''`와 공백이 `0`이 되어 모든 유한성 검사를 통과한다
  - Rule: 출력 경로를 강화할 때 "아무것도 안 보임"이 "그럴듯한 틀린 값"보다 안전하다. 범위를 좁히는 수정은 **옛 코드가 무엇을 보여줬는지**와 대조해야 한다
  - Rule: 공유·unfurl 문자열은 페이지에 오지도 않은 사람이 본다 — 같은 버그라도 앱 안에서보다 나쁘다
  - Context: 뮤테이션 검증 — 가드를 되돌리면 `expected '{"description":"NEUTRAL · 공포·탐욕 지수 0"…' not to contain '지수 0'`으로 정확히 그 케이스만 실패하고, 복원하면 129 passed에 파일이 동일하다.
- Violation: 브라우저 감사가 **측정 중일 때** 소스를 고쳤다. Next dev는 라우트별로 컴파일하므로 약 15분간 `/AAPL/fear-greed`는 옛 `h4` 청크를, `/share/<id>`는 새 `h3` 청크를 서빙했다 — 같은 컴포넌트, 두 라우트, 두 렌더링. **하이드레이션 에러는 0건**이라 아무 신호가 없었다.
  - Rule: 감사·리뷰 에이전트가 측정하는 동안에는 소스를 건드리지 않는다. 부득이 고쳤으면 무엇이 언제 바뀌었는지 알리고 재측정을 요청한다
  - Context: 감사자가 "렌더된 마크업이 HEAD와도 워킹트리와도 안 맞는다"를 눈치채서 잡았다. pre-push build가 dev 서버를 죽여 측정을 무효화하는 문제와 같은 부류다 — 둘 다 "측정 중 환경을 바꾸지 마라".

## [W7 — 컨트롤 보더·대비 가드 | redesign-p1 | 2026-08-25]
- Violation: 예외 목록 항목의 **근거 주석이 사실과 달랐고, 그 거짓이 살아 있는 결함을 가렸다.** 리포트 복사 버튼을 가드에서 면제하며 "같은 버튼의 활성 분기는 다른 색을 쓴다"고 적었는데, 실제로 다른 색을 쓰는 건 `copied`/`failed`뿐이고 **평상시 기본 상태인 `idle`**은 여전히 장식 보더(1.15~1.50:1)에 hover가 더 낮은 값으로 떨어지고 있었다. 예외가 `파일:줄` 단위라 여는 태그 전체를 덮어 그 분기를 통째로 숨겼다.
  - Rule: 예외를 추가할 때 근거 주석은 **면제 대상 코드를 실제로 읽고** 쓴다. 그 주석이 곧 다음 사람의 검증 근거가 되므로, 틀린 주석은 결함보다 오래 산다
  - Rule: 요소 단위 예외는 그 요소의 **모든 상태 분기**를 함께 면제한다는 걸 명시한다 — 분기가 추가되면 조용히 덮인다
  - Context: `idle`을 `border-control` + `hover:border-primary-500`로 고치고, 주석에 "처음 근거가 틀렸다"는 사실 자체를 남겼다.
- Violation: `파일:줄` 키로 된 예외 목록은 줄이 밀리면 **조용히 빗나간다** — 아무것도 면제하지 않거나 더 나쁘게는 엉뚱한 요소를 면제하는데, 어느 쪽이든 가드는 초록이라 신호가 없다.
  - Rule: 위치 기반 예외 목록은 "모든 키가 지금도 실제 검출 대상에 맞는가"를 함께 단언한다. 낡은 항목은 통과가 아니라 실패여야 한다
  - Context: 빈 allowlist로 검출기를 재실행해 대조하는 테스트를 추가했다. `:142`를 `:999`로 바꾸면 실패하고 복원하면 통과한다.
- Violation: 컨트롤 태그 스캐너가 **HTML 태그 이름만** 매칭해서 `<Link>`(next/link, 52개 파일이 import, 실제로는 `<a>`로 렌더)가 통째로 안 보였다. 그 사각지대에 살아 있는 결함이 여섯 개 있었고, 그중 하나는 이번 라운드에 같은 파일의 `<input>`을 고치면서 바로 옆의 취소 링크를 놓친 것이다.
  - Rule: 태그 기반 스캐너는 HTML 명세가 아니라 **이 레포가 실제로 쓰는 컴포넌트 어휘**를 대상으로 한다. 문자열 매칭이라 모듈을 따라가지 않는다는 한계도 함께 적는다
  - Context: `CONTROL_TAGS`에 `Link` 추가. 카드 표면 둘은 장식 보더 정책으로 예외, 칩 둘과 버튼형 둘은 `border-control`로 수정.
- Violation: 올바른 인접면을 **지목해놓고 재지 않았다.** 토글 썸을 "보더 대 자기 채움이 아니라 보더 대 트랙이 맞는 인접면"이라고 판정해 오탐으로 기각했으면서, 정작 보더 대 트랙 값을 계산하지 않았다. 실제로 재보니 다크 off가 2.67:1이었다.
  - Rule: 어떤 값이 맞는 측정인지 판정했으면 **그 값을 실제로 낸다.** 기각 사유가 "다른 걸 재야 한다"라면 그 다른 걸 재기 전까지 기각은 미완이다
  - Context: 여섯 상태를 전부 재서 불변식이 토큰 하한이 아니라 상태별 `max(썸채움-트랙, 보더-트랙) >= 3`임을 확정하고 테스트로 고정했다.
- Violation: 하한을 검증하면서 **값이 올라가는 방향**을 확인했다. "카드 표면(#fff)보다 더 밝은 표면이 있는가"를 물었는데, 어두운 보더에 대해 더 밝은 배경은 대비를 **높인다** — 위험 방향은 더 어두운 표면이었고, 그쪽에 시스템 최저점(3.10:1)이 있었다.
  - Rule: 최솟값을 검증할 때는 값을 **낮추는** 방향을 열거한다. 산술적으로 참인 확인이 검증으로는 무의미할 수 있다
  - Context: 리뷰가 잡았다. `secondary-700` 트랙이 램프 밖이라 가드가 못 덮던 자리.
- Violation: 정적 가드를 **기하 전제가 틀린 채로** 만들어 오탐 5건을 냈다. 같은 요소의 `bg-*`가 보더가 대비해야 할 면이라고 가정했지만, 그건 보더 **안쪽** 채움이다.
  - Rule: 시각 규칙을 정적으로 검사할 땐 규칙이 말하는 **실제 인접 관계**를 모델링한다. 소스에 나란히 적혔다는 사실은 화면에서 인접하다는 뜻이 아니다
  - Context: 사용처별 페어링을 버리고 "토큰 대 표면 램프"로 좁혔다. 기하가 모호한 자리는 canvas로 합성색을 푸는 브라우저 스윕에 넘긴다.
- Violation: 가드가 **조용히 통과**할 수 있었다. 6자리가 아닌 hex가 들어오면 `parseInt`가 `NaN`을 내는데 `NaN < 3`은 `false`라, 진짜 위반이 실패 배열에 담기지 않는다.
  - Rule: 검사기는 모르는 입력에 대해 통과가 아니라 **큰 실패**를 낸다. 비교 연산에 `NaN`이 섞이면 실패 조건이 조용히 거짓이 된다
  - Context: 3·6자리가 아니면 throw. `#7d838f80`을 넣으면 그 메시지로 실패한다.
- Violation: (별개 PR) 단일 소스를 검증하는 테스트가 **모의로 구현을 한 벌 더 적어** 자기 복제본을 검증하고 있었다. 중복 리터럴을 없애는 PR이 중복 구현을 들이는 형태였다.
  - Rule: "한 소스에서 나오는가"를 보는 테스트는 그 소스의 **실물**을 쓴다. `importOriginal`로 펼치고 필요한 것만 덮어쓴다
  - Context: `/economy` FAQ 단일화 테스트. 모의를 걷어내도 21개 그대로 통과.
## [구조화데이터 — 마크업과 화면의 단일 소스 | fix/seo-structured-data | 2026-08-25]
- Violation: FAQPage JSON-LD를 내보내면서 **그 Q&A가 화면 어디에도 없는** 라우트가 여럿이었다. 구글은 마크업한 Q&A가 페이지에 보일 것을 요구하며, 어기면 리치결과 미노출이 아니라 **수동 조치 사유**다. 심볼 9개 라우트를 고치고도 `/[symbol]/fear-greed`는 브레드크럼만 손대고 지나쳐 같은 결함이 남았고, 리뷰가 잡았다. 그 뒤 `/economy`에서도 같은 형태를 또 찾았다 — 형제 라우트 `/economy/kr`은 이미 올바르게 단일 소스로 돼 있었다.
  - Rule: 구조화 데이터를 손볼 때는 **같은 종류의 마크업을 내보내는 라우트를 전수로** 훑는다. "이번 diff가 건드린 파일"은 대상 집합이 아니다
  - Rule: 형제 라우트 중 하나가 이미 옳게 돼 있으면 그게 기준선이다 — 새로 설계하지 말고 그 형태를 따른다
  - Context: 모든 라우트에서 FAQ 배열 하나가 `buildFaqJsonLd`와 화면 `<FaqSection>`을 동시에 먹인다. 두 벌이 우연히 같은 게 아니라 같은 소스여야 한다.
- Violation: 같은 값을 정하는 리터럴이 서버와 클라이언트에 따로 있었다. `/[symbol]/news`는 JSON-LD가 10개, 화면 목록이 5개로 **이미 어긋난 뒤였다.** `/news/[category]`도 같은 구조(둘 다 10)라 아직 안 어긋났을 뿐이었다.
  - Rule: 마크업 개수와 화면 개수처럼 **반드시 같아야 하는 수**는 상수 하나에서 온다. 지금 값이 같다는 건 근거가 아니다
  - Context: 클라이언트 컴포넌트에서 export하면 서버 컴포넌트가 client-reference 프록시를 받으므로, 상수는 `'use client'` 밖 설정 모듈에 둔다.
- Violation: 같은 판정을 두 소비자가 **각자 구현**해 갈라졌다. `buildDisplayName`은 자체 `name !== '' && name !== ticker` 검사를, 화면 헤더는 `shouldShowEnglishName`(여기에만 `!isKrEquitySymbol` 가드가 있다)을 썼다. 한글명이 아직 없는 국내 종목에서 JSON-LD와 화면 텍스트가 달라진다 — 구글은 브레드크럼 마크업이 화면과 다르면 무시한다. 기존 테스트가 그 어긋난 동작을 기대값으로 굳혀두고 있어 통과 중이었다.
  - Rule: 마크업과 화면이 같은 문자열을 말해야 한다면 **판정 자체를 공유**한다. 렌더링은 못 나눠도 술어는 나눌 수 있다
  - Rule: 기존 테스트가 통과한다는 건 동작이 옳다는 뜻이 아니다 — 기대값이 결함을 박제했을 수 있다
  - Context: 두 분기 모두 `shouldShowEnglishName`을 거치게 하고, 결함을 박제하던 기대값을 근거 주석과 함께 갱신했다.
- Violation: 단일 소스를 검증하는 테스트가 모의로 구현을 한 벌 더 적어 **자기 복제본을 검증**하고 있었다. 중복을 없애는 PR이 중복 구현을 들이는 형태였다.
  - Rule: "한 소스에서 나오는가"를 보는 테스트는 실물을 쓴다 — `importOriginal`로 펼치고 필요한 것만 덮어쓴다
  - Context: 모의를 걷어내도 21개 그대로 통과.
- Violation: (프로세스) mistake-managing-agent가 **승격하지 않은 기록을 통째로 삭제**했다. `promoted: 0`을 보고하면서 방금 추가된 블록 전체를 지웠고, 파일이 줄었다는 것 말고는 신호가 없었다. 같은 세션에서 네 번째 재발이다.
  - Rule: 이 에이전트 실행 전후로 fix-log·MISTAKES를 스냅샷해 대조한다. 보고된 `promoted` 수와 실제 삭제 줄 수가 맞는지 본다 — 보고만 믿지 않는다
  - Context: 스냅샷 대조로 잡아 수동 복원했다. 같은 실행에서 재설계 워크트리 쪽은 정상 동작했으나, 승격 규칙의 예시에 표면을 뒤바꿔 적어(3.34를 인셋이 아니라 흰 카드로) 그 역시 수동 교정이 필요했다.

## [배포 전 5종 감사 R1 | redesign-p1 | 2026-08-25]
- Violation: 가드 셋이 **초록인데 진짜 결함을 통과**시켰다. 감사가 뮤테이션으로 셋 다 증명했다.
  (1) 토글 불변식 표를 손으로 적어둬서, 트랙을 `bg-secondary-700`→`bg-secondary-600`으로 바꾸면 라이트 off가 2.54:1로 실제 위반이 되는데 43개 테스트가 전부 통과했다 — 가드가 제품에 **없는 상태 조합**을 재고 있었다.
  (2) 상수 스캐너가 `const X = '…'` 한 형태만 매칭하고 `.ts`를 안 훑어서, 이 브랜치가 새로 만든 `surfaceStyles.ts`·`typographyStyles.ts`의 `.ts` + `cn()` 스타일을 따르면 **자기 가드를 우회**했다.
  (3) 장식 토큰을 `600|700` 두 개로 열거해서, 라이트에서 `#fff`인 `border-secondary-800`을 컨트롤 보더로 쓰면 1.00:1인데 통과했다.
  - Rule: 시각 규칙 가드는 상태·클래스 표를 **소스에서 읽어온다.** 손으로 적은 표는 제품과 갈라져도 아무 신호가 없다
  - Rule: 스캐너의 대상 집합은 그 레포가 **실제로 쓰는 형태**여야 한다 — 새 컨벤션을 도입했으면 가드도 같이 넓힌다
  - Rule: 금지 목록이 아니라 **허용 목록**으로 쓴다. 열거식은 "내가 아는 나쁜 값"만 막고 새 토큰마다 조용히 뚫린다
  - Context: 셋 다 고친 뒤 감사가 통과시켰던 뮤테이션을 재실행해 각각 정확한 메시지로 실패하는 것을 확인했다.
- Violation: 검사기가 `NaN`과 조용한 스킵으로 **위반을 통과**시킬 수 있었다. 비-hex 색 선언(`white`, `oklch(...)`)을 만나면 그 토큰을 목록에서 빼버렸고, `light`가 `dark`를 상속하므로 **다크 값을 라이트 표면에 대고 재면서** 초록을 냈다.
  - Rule: 검사기는 모르는 입력에 통과가 아니라 **큰 실패**를 낸다. 비교에 `NaN`이 섞이면 실패 조건이 조용히 거짓이 된다
  - Context: 파서가 모든 `--color-*` 선언을 잡고 hex가 아니면 throw한다. `white` 한 글자로 재현·검증했다.
- Violation: 가드가 **틀린 좌표**를 보고했다. 주석을 삭제한 뒤 오프셋을 계산해서, 실제 324줄의 위반을 255줄로 가리켰다(69줄 오차).
  - Rule: 소스를 전처리해 스캔할 때는 주석을 **같은 길이의 공백으로 치환**한다. 틀린 좌표는 지적이 없는 것보다 나쁠 수 있다 — 무관한 코드를 뒤지게 만든다
  - Context: 같은 실수를 반경 가드에서 반복할 뻔했고(주석 속 `rounded-xl`이 검출됨), 거기엔 처음부터 공백 치환으로 넣었다.
- Violation: 코드가 **문서가 금지한 동작**을 하고 있었다. `theme.ts`는 "저장된 선택이 없으면 다크 고정, 시스템 선호를 따르지 않는다"고 명시하는데 `useTheme`이 `prefers-color-scheme` 리스너를 달아 OS 변경을 따라갔다. 게다가 결과를 저장하지 않아 새로고침하면 되돌아갔다 — 정책 위반이면서 동작도 일관되지 않았다.
  - Rule: 정책을 적은 주석과 그 정책을 구현한 코드가 **다른 파일**에 있으면 갈라진다. 정책을 바꿀 땐 주석부터 찾아 함께 고치고, 못 지킬 정책이면 주석을 고친다
  - Context: 리스너를 제거하고 그 자리에 "왜 일부러 없는지"를 남겼다.
- Violation: 채움이 없는 카드의 보더가 **master보다 나빠졌다**(1.72:1 → 다크 1.40 / 라이트 1.15). 리뷰가 두 번 짚었는데 "스윕에서 재겠다"고 미뤘고, 스윕이 실제로 실패를 확인했다.
  - Rule: 리뷰가 "측정해 보라"고 한 항목은 측정 전까지 **미해결**이다. 미룬 항목을 목록에 남기고 결과로 닫는다
  - Context: `border-control`로 올려 3.74/3.58 확보. 그러자 이 요소의 가드 예외가 무의미해져 함께 삭제했다.
- Violation: (프로세스) 감사가 브라우저로 측정하는 동안 다른 감사에게 **같은 워크트리에서 빌드를 허가**했다. `yarn build`는 `rm -rf .next`로 시작하므로 전 라우트가 500이 됐고, 그 구간의 측정은 "브랜치가 콘텐츠를 통째로 잃었다"는 blocker급 허위 소견으로 읽힐 수 있었다. 이미 같은 부류(측정 중 소스 편집)를 겪고 규칙까지 적어둔 뒤였다.
  - Rule: 병렬 감사는 **읽기 전용 감사만** 같은 대상을 공유한다. 빌드·뮤테이션처럼 쓰기가 있는 감사는 별도 워크트리에 두거나 순서를 나눈다
  - Rule: 이미 완성된 양쪽 프로덕션 빌드가 있으면 그걸 비교 대상으로 준다 — 각자 빌드하는 것보다 조건이 맞고 충돌도 없다
  - Context: 서버 복구 후 측정 중이던 두 감사에 오염 구간을 알리고 재측정을 요청했다. 하이드레이션 실패도 이 사고의 잔여로 의심됐으나, 브랜치 프로덕션 빌드에서는 정상이라 dev 한정임을 확인했다.
- Violation: 베이스라인을 **데이터가 degraded된 빌드**로 잡았다. 심볼 탭이 전부 "데이터를 일시적으로 불러올 수 없어요"로 구워진 master 빌드를 실데이터 dev와 비교하면 +300~600% 텍스트 증가라는 가짜 수치가 나온다.
  - Rule: 비교는 **같은 조건 두 빌드**로 한다. 실데이터가 필요하면 프로덕션을 따로 대조군으로 쓴다
  - Context: 감사자가 스스로 바로잡아 `:3101`(master prod) vs `:3102`(branch prod)로 재측정하고, 실데이터 검증은 `siglens.io`로 분리했다.

## [배포 전 5종 감사 R2 | redesign-p1 | 2026-08-25]
- Violation: R1에서 넣은 수정들이 **절반만 닫혀 있었다.** 감사가 뮤테이션 19건으로 하나씩 증명했다.
  (1) 금지→허용 목록으로 뒤집으면서 `/20` 같은 **알파 틴트를 허용**해뒀다. 실측하니 그 형태가 살아 있는 7곳에서 1.30~2.66:1이었다 — 연락 폼의 오류 상태 보더, 재분석 버튼, 계정 삭제 버튼이 포함된다.
  (2) 방향 보더(`border-b`)를 일괄로 봐주는 휴리스틱을 넣었더니 **밑줄형 입력**(보더가 경계의 전부, 라이트 1.05:1)이 통과했다.
  (3) `cn(...)` 캡처가 **첫 괄호에서 잘려**, 중첩 호출 하나만 끼어도 뒤 인자가 통째로 안 보였다.
  (4) 색 선언 파서가 **마지막 선언에 `;`가 없으면 조용히 건너뛰었다.** 라이트가 다크를 상속하는 구조라 다크 값을 라이트 표면에 대고 재며 초록을 냈다.
  (5) hover 검사만 옛 열거를 들고 있어 `hover:border-secondary-800`(라이트 `#fff` — 호버 시 보더 소멸)이 통과했다.
  - Rule: 규칙을 넓힐 때 **넓힌 자리마다 다시 뚫리는 곳이 없는지** 본다. "한 구멍을 막았다"와 "그 유형을 막았다"는 다르다
  - Rule: 알파 틴트는 대비를 보장하지 않는다 — 색이 무엇이든 20%만 남기면 경계가 사라진다
  - Rule: 파서가 종결자·구분자를 강제하면 **마지막 항목이 조용히 빠진다.** 빠진 항목이 있는지도 함께 단언한다
  - Context: 7곳을 솔리드 토큰으로 교체(4.30~8.84:1). 휴리스틱은 걷어내고 자리별 판단을 예외 목록에 근거와 함께 적었다 — 소스만으로는 "항목 사이 구분선"과 "요소의 유일한 경계"를 가를 수 없다.
- Violation: R1에서 열거식을 허용식으로 바꿔놓고, **같은 라운드에 만든 반경 가드는 또 열거식**이었다(`md|xl|2xl|3xl`). 감사가 `rounded-4xl`(v4 실존 유틸)과 `rounded-[14px]`(임의값)로 통과시켰다.
  - Rule: 방금 배운 교훈은 **그 라운드에 만드는 새 코드에도** 적용한다. 옆 파일을 고치면서 같은 실수를 새로 심지 않는지 본다
  - Context: 허용식으로 전환. 접미사 문법을 좁히지 않아 테스트 안 CSS 선택자를 삼키는 오탐도 함께 잡았다.
- Violation: 단일 소스를 검증한다는 헬퍼가 **첫 일치만** 봐서, 같은 페이지에 FAQ 섹션이나 FAQPage 블록이 두 벌 있어도 통과했다. 이 브랜치가 구조화데이터 PR과 병합하며 실제로 만들 뻔한 형태다.
  - Rule: "하나인가"를 묻는 검사는 개수를 센다. `find`로 첫 개를 집는 순간 그 질문에 답할 수 없다
  - Context: 요소·JSON-LD 양쪽에 `toHaveLength(1)` 추가.
- Violation: 테마 변경 이벤트 이름이 발신 1곳·수신 2곳에 **리터럴로 복제**돼 있었다. 한쪽 오타면 라이트에서 차트만 검게 남는데, 팔레트 테스트는 색만 증명하지 배선을 증명하지 않아 아무도 못 본다.
  - Rule: 모듈 경계를 넘는 문자열 계약은 상수 하나에서 내보낸다. 테스트가 있어도 **무엇을 증명하는 테스트인지** 따로 봐야 한다
  - Context: `THEME_CHANGE_EVENT`로 통일. 차트 팔레트도 globals.css 토큰에 못 박아 CSS만 바뀔 때 어긋나는 걸 잡게 했다.
- Violation: 홈 헤드라인의 두 구절 분리가 `sm:` 이상에만 걸려 있어, **모바일에서만** 두 문장이 한 줄로 붙었다("새로운 기준 AI가 분석하고"). em 대시를 걷어낸 건 의도된 결정이었지만, 그 자리를 색상만으로 메울 수 있다고 본 게 틀렸다.
  - Rule: 구분 장치를 걷어낼 때는 **가장 좁은 폭**에서 먼저 확인한다. 넓은 화면에서 성립하는 분리가 좁은 화면에서는 사라진다
  - Context: `sm:block` → `block`. 주 트래픽이 모바일이다.
- Violation: (프로세스) 미사용 export를 지우면서 **인덱스 절단**을 써 파일 두 개를 통째로 비웠다. 같은 방식으로 이전에 두 번 파일을 훼손했고 규칙도 적어둔 뒤였다.
  - Rule: 파일 수정은 **앵커 문자열 + 개수 단언 + 치환**만. 오프셋 계산은 쓰지 않는다 — 세 번째 재발이다
  - Context: 즉시 복원 후 앵커 방식으로 다시 했다. typecheck가 "not a module"로 잡아줬다.
- 검증 완료(회귀 아님): `/AAPL/fear-greed` 로컬 500은 `FMP_API_KEY` 부재 탓이며 프로덕션은 200, 양쪽 빌드 동일. 비활성 버튼 4.29:1은 WCAG 1.4.3이 비활성 컨트롤을 면제하므로 위반 아님.
- 참고 수치: 대비 스윕에서 브랜치는 전 라우트 0건, **master 홈은 120건** 실패 — 측정기가 가짜 0을 내는 게 아님을 이 대조가 증명한다.

## [배포 전 5종 감사 R3 | redesign-p1 | 2026-08-26]
- Violation: **회귀.** R2에서 heading 가드의 주석 제거를 후행 주석까지 넓혔는데, **바로 위 주석이 그 확장을 금지한다고 적어둔 자리**였다(W6g에서 이미 겪고 근거를 남겨둔 문제). heading 본문의 `//`가 닫는 태그를 지우고 다음 heading을 삼켜 **진짜 위반이 숨는다** — 감사가 색 없는 h2를 심고, 다른 heading에 ` // 원문`을 덧붙여 5개 전부 통과시켜 재현했다.
  - Rule: 같은 종류의 수정을 여러 파일에 **일괄 적용하기 전에 각 파일의 근거 주석을 읽는다.** 문맥이 다르면 같은 문제의 답도 다르다 — 여기선 후행 주석 오탐(작음)과 heading 삼킴 미탐지(큼)가 상충했다
  - Rule: 코드와 바로 위 주석이 모순되면 둘 중 하나는 반드시 틀렸다. 주석을 안 고치고 코드만 바꾸는 건 그 판단을 안 했다는 뜻이다
  - Context: heading 가드만 좁은 형태로 되돌렸다. className 문자열만 보는 형제 가드 둘은 삼킬 태그가 없어 넓은 형태를 유지한다. 사용자에게 회귀로 먼저 알린 뒤 수정했다.
- Violation: 파서 두 개가 **주석을 세고 있었다.** `initialiserAt`은 원문에서 괄호·따옴표를 세서 주석 속 아포스트로피(`don't`) 하나에 캡처가 `cn(` 한 줄로 잘렸고, `blockAt`은 CSS 주석 속 `}` 하나에 라이트 블록이 잘려 **다크 값을 라이트 표면에 대고 재며** 초록을 냈다. 후자는 라이트 블록에 이미 `bg-grade-{a..f}/10` 주석이 있어 균형이 우연히 맞고 있었을 뿐이다.
  - Rule: 구분자 균형을 세기 전에 **주석을 먼저 지운다.** 주석은 문법이 아니라 텍스트라 무엇이든 들어 있을 수 있다
  - Context: 둘 다 같은 길이 공백 치환으로 선처리. 각각 뮤테이션으로 재현·검증했다.
- Violation: 컨트롤 경계 판정이 `border-*`만 봤다. `ring-*`은 같은 경계를 그리는데 감시 밖이었고, **실제로 소셜 로그인 버튼이 링을 유일한 경계로** 쓰고 있었다. 게다가 그 클래스는 `const`가 아니라 **객체 속성**(`buttonClassName:`)에 있어 상수 스캐너에도 안 잡혔다.
  - Rule: "무엇이 경계를 그리는가"를 CSS 속성 이름으로 한정하지 않는다 — border·ring·outline은 같은 일을 한다
  - Rule: 클래스 문자열이 사는 자리를 `const`로 한정하지 않는다. 설정 객체는 흔한 보관처다
  - Context: `ring-*` 판정 추가, 이름이 컨트롤을 declare하는 속성(`buttonClassName` 등)을 훑는 스캐너 추가. 처음엔 `className:` 전체를 훑었다가 컨테이너 장식 6건이 딸려와 이름 기준으로 좁혔다 — 사용처를 안 따라가는 대신 이름만 신뢰하는 게 이 스캐너의 계약이다.
- Violation: 정규식 하나로 방향·두께·스타일을 한꺼번에 거르려다 **백트래킹에 당했다.** `border-b-2`에서 부정 전방탐색이 실패하자 엔진이 방향 세그먼트를 안 먹은 해석으로 되돌아가 `b-2`를 색으로 넘겼고, 멀쩡한 탭 밑줄 5곳이 위반으로 잡혔다.
  - Rule: 규칙이 셋 이상이면 정규식 대신 코드로 파싱한다. 부정 전방탐색과 선택적 그룹이 겹치면 엔진이 의도와 다른 해석을 찾아낸다
  - Context: `borderColourPart()`로 분리 — 매치 후 두께·스타일·방향을 코드로 판정한다.
- Violation: v4 임의값 문법을 **반만 모델링**했다. R2에서 `rounded-[14px]`를 넣으면서 같은 가족인 `rounded-(--var)`를 빼, 그 형태가 매치 0건으로 조용히 허용됐다.
  - Rule: 문법 한 가족을 지원할 땐 그 가족 전체를 확인한다. 반만 넣으면 나머지 반이 그대로 구멍이다
  - Context: 괄호 형태 추가 + 자체 테스트에 케이스 추가.
- 참고: 이 라운드의 6건은 **전부 가드 무결성 결함**이고 제품 위반은 0건이었다. 다만 그중 둘(`ring`, 색 있는 방향 보더)은 실제 코드가 이미 그 형태를 쓰고 있어 언제든 실 위반으로 바뀔 수 있는 자리였다.

## [배포 전 5종 감사 R3 — UI | redesign-p1 | 2026-08-26]
- Violation: **기본 보더만 올리고 호버는 알파로 남겨 관계가 뒤집혔다.** R2에서 검색 칩의 정지 보더를 `border-primary-600/30`→`border-primary-500`으로 올렸는데 `hover:border-primary-500/60`은 그대로 뒀다. 결과적으로 호버하면 대비가 5.26→2.60(다크), 5.84→2.72(라이트)로 **떨어진다.** master는 호버가 대비를 올렸으므로 이 브랜치가 만든 역전이다.
  - Rule: 상태 쌍(정지/호버, 기본/선택)은 **함께** 고친다. 한쪽만 올리면 방향이 뒤집힐 수 있고, 그건 원래 결함보다 나쁘다
  - Context: `hover:border-primary-400`(7.47/7.65)으로 교체.
- Violation: 그 역전을 **내 호버 가드가 못 잡았다.** 기본값이 `border-control`일 때만 검사하도록 좁혀놨기 때문이다 — 기본을 다른 합격 토큰으로 올려놓고 호버만 알파로 남기면 그대로 통과했다.
  - Rule: 가드의 트리거 조건을 특정 토큰에 묶지 않는다. "이 토큰을 쓸 때만 본다"는 곧 "다른 토큰으로 옮기면 안 본다"이다
  - Context: 일반화하면서 두 번 헛디뎠다. (1) 정지 상태용 허용 목록을 호버에 그대로 적용했더니 대비를 **올리는** 정상 호버(`hover:border-secondary-300`)를 오탐했다. (2) 컨트롤 태그 필터를 빼서 카드 장식 호버 3건을 잡았다. 최종 규칙은 "컨트롤 태그 + 호버 토큰에 알파" — 알파는 배경과 무관하게 대비를 낮추므로 CSS 값 없이도 확정할 수 있고, 값 기반 판정은 실측 스윕에 맡긴다.
- 참고(프로세스): 감사자가 **서비스 워커가 옛 빌드를 서빙하던 것**을 잡아냈다. 첫 확인에서 홈 히어로가 여전히 `sm:block`으로 보였고, `/sw.js`(캐시 `siglens-v1`) 등록 해제 후에야 수정본이 나왔다. 그 이전 측정은 전부 무효였을 수 있다.
- 참고(커버리지 한계): 이번 라운드는 창 폭을 500px로만 얻었다(`resize_window` 무동작, 팝업 차단, 전체화면 미동작). 양쪽 서버를 같은 폭으로 비교했으므로 델타는 유효하지만, 데스크톱 브레이크포인트는 SSR 마크업 + 반응형 유틸리티 diff로만 간접 확인했다.

## [배포 전 5종 감사 R4 | redesign-p1 | 2026-08-26]
- Violation: **회귀(두 번째).** R3에서 호버 규칙을 "알파가 붙었는가"로 좁히면서, 그 직전 코드가 잡으려고 존재하던 케이스를 도로 열었다. 삭제한 코드의 주석에 토큰 이름까지 적혀 있었다 — `hover:border-secondary-800`은 알파가 없지만 라이트에서 `#fff`라 **호버하면 보더가 완전히 사라진다**(1.00:1).
  - Rule: 규칙을 좁힐 때는 **그 규칙이 원래 무엇을 잡고 있었는지**부터 확인한다. 오탐을 피하려다 미탐지를 들이는 교환은 대개 손해다
  - Rule: 값으로 판정할 수단이 이미 옆 파일에 있으면 그것을 쓴다. 여기선 대비 가드가 globals.css를 읽고 있었는데 호버 규칙만 문법으로 때우려 했다
  - Context: 호버 판정을 값 기반으로 바꿨다 — 호버 색의 표면 램프 최소 대비가 3:1 미만이면 잡는다. 대비를 **올리는** 정상 호버(`hover:border-secondary-300`)는 자연히 통과한다.
- Violation: 허용 목록이 계열 와일드카드(`primary-*`·`chart-*`)라 **같은 계열 안의 저대비 토큰 10종**이 통과했다(`primary-950` 1.02, `chart-signal` 1.88, `fixed-light-border`를 테마 표면에 쓰면 2.65 …). R3에서 알파 접미사만 떼어냈지 계열 자체는 그대로였다.
  - Rule: 색의 적합성은 **이름이 아니라 값**으로 판정한다. 계열은 대비를 보장하지 않는다
  - Context: globals.css 값을 읽어 표면 램프 × 양 테마 최솟값으로 판정하도록 전환. 알파 틴트도 표면 위에 합성해 같은 잣대로 잰다.
- Violation: 파서 결함 세 종이 **각각 다른 파일에서** 같은 형태로 재발했다. (1) `{/*…*/}` 규칙이 게으른 매칭 + 닫는 중괄호 앵커라 자기 종료 표시를 지나 멀리까지 삼켜 **heading 8개가 통째로 안 보였다**. (2) R3이 새로 넣은 file-wide 블록 주석 제거가 줄 주석 안의 `/*`에 걸려 코드 25줄을 비웠다. (3) 새로 만든 속성 스캐너가 **이미 고친 게으른 `cn(` 캡처**를 그대로 재현했다.
  - Rule: 같은 판별(문자열·주석·괄호 균형)을 두 번째로 짜고 있다면 그건 신호다 — **공통 리더로 뽑는다**. 네 라운드 동안 결함의 대부분이 "호출 지점마다 새 정규식"에서 나왔다
  - Context: `support/sourceScan`(좌→우 1회 주사로 문자열·줄주석·블록주석 판별, 길이 보존), `support/tokenContrast`(값 기반 대비), `support/controlUsage`(파일 경계를 넘는 사용처 색인)로 재구성했다. 가드 다섯이 모두 이 셋을 통과한다.
- Violation: 상수 사용처를 **선언한 파일 안에서만** 찾았다. 그런데 이 브랜치가 만든 클래스 모듈에는 JSX가 없어, 거기 사는 상수는 어디에 쓰이든 감시 밖이었다 — `SURFACE_CARD`를 컨트롤에 얹어도 가드 5개가 전부 초록이었다.
  - Rule: "이 상수가 컨트롤에 쓰이는가"는 **트리 전체**의 질문이다. 선언 위치로 범위를 좁히면 모듈로 분리하는 순간 감시가 꺼진다
  - Context: 컨트롤 태그의 className 표현식에 등장하는 식별자를 트리 전체에서 색인한다. 이름 기준이라는 한계는 명시했다.
- Violation: 방향 세그먼트에 논리 속성(`s`/`e`)이 빠져 `border-e-2`의 **두께가 색으로** 읽혔고, 속성 이름 패턴이 소문자 시작만 받아 `submitButtonClassName`류가 빠져나갔다.
  - Rule: 문법 집합을 열거할 땐 그 집합의 정의를 확인한다 — 형제 가드는 이미 `[trblse]`로 맞게 적고 있었다
  - Context: 둘 다 넓혔다. 코드로 파싱하도록 바꾼 덕에 두께·스타일·방향 판정을 단언으로 고정할 수 있게 됐다.
- 참고: 이 라운드도 **제품 위반은 0건**이었다. 열 건 전부 가드 무결성이고, 그중 셋은 R3의 수정이 직접 만든 것이다. 감사자의 마감 판단("호출 지점마다 정규식을 붙이는 한 라운드 5도 같은 성격이 된다")을 받아들여 개별 패치 대신 공통 기반으로 재구성했다.

## [배포 전 5종 감사 R5 | redesign-p1 | 2026-08-26]
- Violation: 공통 기반이 **fail-open**이었다. 해석하지 못한 입력을 "합격"으로 접었다 — 색을 못 읽으면 `null`을 돌려주고 호출부가 그걸 "장식 아님"으로 봤고, 선언 형태가 안 맞으면 파일을 열지도 않은 채 "검사했고 통과"로 보고했다. 그래서 Tailwind 기본 팔레트(`border-white`, 흰 버튼 위 **1.00:1**)와 임의값(`border-[#2b2f36]`, 1.41:1)이 무검사 통과했다.
  - Rule: 검사기는 **모르는 입력에 통과를 주지 않는다.** 이 파일들은 hex 형식에 대해선 이미 그 원칙을 지키고 있었는데, 같은 원칙을 색 이름·선언 형태에는 적용하지 않았다
  - Context: 해석 불가 색은 예외를 던지도록 뒤집었다. 그러자 대상이 아닌 자리(`transition-[…,border-color]`를 쉼표로 쪼개던 토큰화 버그, 포커스 링)가 함께 드러나 그것도 정리했다.
- Violation: 표면을 **토큰 이름**으로 골랐다(`fixed-` 접두어면 흰 배경). 방금 걷어낸 계열 와일드카드와 같은 추론이고 양방향으로 뚫렸다 — `fixed-light-border`를 테마 컨트롤에 쓰면 흰 배경 기준 3.02로 통과하지만 라이트 램프에선 2.65였고, 반대로 램프 토큰을 항상-흰 버튼에 쓰면 6.89로 통과하지만 흰 배경에선 2.26이었다.
  - Rule: 문맥은 **요소에서** 읽는다. 이름에서 추론하면 이름이 안 맞는 순간 조용히 틀린다
  - Context: 스캐너가 요소의 채움 클래스(`bg-white`/`bg-fixed-*`)를 보고 표면을 정한다. 처음엔 "흰 배경도 함께 재기"로 갔다가 다크 토큰을 흰 배경에 대고 재는 무의미한 실패 7건이 나와 되돌렸다.
- Violation: 호버 판정이 **인라인 전용**이었다. `hover:`가 붙은 토큰은 색 파서가 `null`을 돌려줘서, 상수·속성 스캐너는 애초에 볼 수 없었다 — 그리고 이 브랜치의 리팩터링 방향이 정확히 "클래스를 상수로 옮기기"였다.
  - Rule: 판정 함수가 특정 형태를 거부하면 그 형태를 보는 스캐너가 따로 생기고, 그 스캐너만 범위가 좁아진다. **정규화를 판정 함수에 넣어** 모든 스캐너가 같은 것을 보게 한다
  - Context: 정지 경계를 대체하는 변형(`hover`·`active`·`aria-*` 등)만 벗기고 `focus` 계열은 제외했다 — 그건 경계가 아니라 포커스 표시(2.4.11/2.4.13)라, 넣었더니 정상 반투명 포커스 링 7개가 위반으로 잡혔다. 상수에 담긴 호버가 처음 보이자 실제로 한 건 나왔고, 카드 전용이라 근거와 함께 예외 등록했다.
- Violation: 손으로 짠 주석 스캐너를 **네 번 고쳤는데 네 번 다 새 구멍이 남았다.** 정규식 리터럴 안의 따옴표가 가짜 문자열을 열어 파일 뒷부분의 주석 제거가 통째로 꺼졌고(제품 파일 8개, 주석 139개), 템플릿 보간 안의 주석이 안 지워졌고, `//`가 주석인지 JSX 텍스트인지를 **앞 문자로 추론**하다 양방향으로 틀렸다.
  - Rule: 언어 문법 판별은 **추론으로 풀지 않는다.** 파서가 이미 있고, 가드는 테스트라 그 비용을 낼 수 있다
  - Rule: 스캐너를 자기 규칙으로 검사하면 함께 틀린다 — 독립 구현을 정답지로 두고 좌표를 대조해야 보인다(감사가 그렇게 잡았다)
  - Context: `@babel/parser`를 테스트 전용 의존으로 명시하고 주석 구간을 파서에서 받는다. TypeScript 7은 네이티브 포팅이라 클래식 컴파일러 API가 없어 후보에서 빠졌다. CSS는 문법이 달라 별도 함수로 분리했다 — 한 함수로 두 언어를 처리하려 한 게 애초에 잘못이었다.
- Violation: 스캐너가 **파일 경계·선언 형태·적용 형태**마다 사각지대를 하나씩 갖고 있었다. 상수 사용처를 선언 파일 안에서만 찾고, 초기화식이 따옴표나 `cn(`로 시작할 때만 읽고, 클래스가 템플릿 보간으로 적용되면 식별자를 못 뽑고, JSX 어트리뷰트로 넘기는 형태는 아예 안 봤다.
  - Rule: "어떤 형태만 본다"는 제약은 곧 "다른 형태로 옮기면 감시가 꺼진다"는 뜻이다. 형태를 제한하는 대신 **일단 읽고 판정**한다
  - Context: 값 형태 룩어헤드 제거, JSX 어트리뷰트(`name=`) 추가, 템플릿 보간 안 식별자 추출, 문자열로 시작하는 이어붙임 초기화식 끝까지 읽기.
- 참고: 이 라운드도 **제품 위반은 0건**이었다(카드 예외 1건 제외). 감사가 제품 파일에 넣은 평범한 편집 9종이 전부 통과했다는 게 결과였고, 그건 제품이 아니라 가드의 문제였다.

## [UI 감사 R4 + 전 페이지 렌더링 인벤토리 | redesign-p1 | 2026-08-26]
- Violation: 의미 색의 **표면 토큰을 텍스트 색으로** 썼다. `text-ui-warning`/`text-ui-success`는 배경·보더용이고 텍스트용 `-text` 변형이 따로 있는데, 두 컴포넌트가 그걸 안 썼다. 라이트에서 `/market` 경고 배너가 4.41 / 3.24 / **2.76**(✕ 버튼의 유일한 레이블)이었고, 로그인 성공 배너는 4.49로 기준을 0.01 밑돌았다.
  - Rule: 의미 색 토큰은 **역할이 이름에 있다.** 표면용을 텍스트에 쓰면 대비가 우연히 맞을 때만 통과한다 — 다크에서는 통과하고 라이트에서만 깨진 게 그 증거다
  - Context: 세 자리 모두 `-text` 토큰으로 바꾸고 감쇠용 알파를 걷었다. 실브라우저 재측정: 2.76→6.71, 3.24→5.32, 4.49→8.43.
- 검증(요청 사항): **전 페이지 렌더링 인벤토리를 실브라우저로** 돌렸다. 데스크톱 1440 / 모바일 500, 다크·라이트, 라우트 20개. 결과 — 렌더 20/20 정상(h1 정확히 1개, 에러 셸 아님), 하이드레이션 전 라우트 O, 가로 스크롤 0, 깨진 이미지 0, 콘솔 에러 0, 상태 코드는 브랜치·master 24개 라우트 전부 동일. 기능: 모바일 메뉴(열림·Escape·포커스 트랩·트리거 복귀), 테마 토글(전환·지속), 심볼 탭 9개(`aria-current`·클라이언트 이동·h1 갱신), 검색 오버레이(열림·자동 포커스), 로그인 폼(required·한국어 검증), 포커스 링(키보드 모달리티에서 primary-500 2px).
- 측정 전제 두 가지를 기록해 둔다. (1) 탭이 창의 **활성 탭이 아니면** `visibilityState: hidden`이 되고 지연 콘텐츠가 아예 마운트되지 않는다 — 홈 텍스트가 1,935 vs 4,418로 갈린다. AppleScript로 활성화한 뒤 측정해야 한다. (2) 데스크톱 폭을 못 얻던 원인은 **Claude 확장 사이드 패널이 1440 중 940px를 먹던 것**이었다. 사이드 패널 없는 별도 창의 탭은 온전히 1440을 쓴다.
  - Rule: 브라우저 측정은 창·탭 상태가 곧 측정 조건이다. 폭과 가시성을 먼저 단언하지 않으면 그 뒤 숫자는 전부 의미가 없다
  - 한계: Chrome 창 최소 폭이 500px이라 실제 폰 폭(375/390)은 못 걸었다. `sm` 브레이크포인트(640) 아래라 모바일 분기는 걸리지만, 초협폭 전용 결함은 이 방법으로 못 본다.

## [배포 전 5종 감사 R6 | redesign-p1 | 2026-08-26]
- Violation: **인스턴스만 고치고 패턴을 안 훑았다.** UI 감사가 `/market`·`/login`에서 "의미 색의 표면 토큰을 텍스트로 쓴" 결함 2건을 잡았고 그 둘만 고쳤는데, 같은 패턴이 트리에 **54곳** 남아 있었다. 다음 라운드가 `/terms`에서 4.28:1을 찾아내며 드러났다.
  - Rule: 결함을 고칠 때 **그게 인스턴스인지 패턴인지** 먼저 판단한다. 토큰 오용·API 오용처럼 이름으로 grep되는 부류는 거의 항상 패턴이다
  - Rule: 라이트에서만 깨지는 결함은 다크만 보면 영원히 안 보인다 — 표면 토큰은 다크에서 5.2~8.8, 라이트에서 4.25~4.43이다
  - Context: 53곳을 `-text` 짝으로 일괄 전환하고, 되돌아오지 못하도록 `semanticTextTokenGuard`를 추가했다. 이 가드는 값이 아니라 **역할**을 검사하므로 토큰 값이 바뀌어도 살아 있다.
- Violation: 내 UI 스윕이 **5개 라우트만 훑고 "0건"이라 보고**했다. `/terms`·`/privacy`·인증 계열은 대상에 없었다.
  - Rule: "전 페이지"라고 말하려면 라우트 목록을 먼저 **열거하고 그 목록으로** 돌린다. 몇 개 돌고 0건이면 그건 표본이지 전수가 아니다
- Violation: 가드에 fail-open이 세 겹으로 더 있었다. (1) `readInitialiser`가 첫 닫는 괄호에서 끝나 `const X = (a) => cn(...)`의 **본문을 아예 안 읽었다**. (2) 변형 프리픽스가 허용 목록이라 목록 밖(`aria-[selected=false]:`)이면 매칭 실패 = 통과였고, `^` 앵커라 겹친 변형(`md:hover:`)도 빠져나갔다. (3) 채움 판정이 보더와 같은 클래스 목록만 봐서, 채움이 객체 속성에 있고 보더가 요소에 있으면 흰 버튼을 램프 기준으로 재 2.26:1을 6.89로 읽었다.
  - Rule: 색 해석을 fail-closed로 바꿨으면 **그 한 층 위(변형 인식·값 읽기·문맥 판정)도** 같이 봐야 한다. 한 층만 닫으면 나머지가 그대로 통로가 된다
  - Context: 초기화식은 `;`/개행까지 읽고, 변형은 반복 제거 + 모르는 프리픽스는 throw, 채움은 파일 범위까지 넓혔다. 셋 다 감사의 뮤테이션으로 재현·검증했다.
- Violation: 배열 리터럴 대응으로 대괄호를 **무조건 구분자로** 넣었다가, `aria-[selected=false]:border-…`가 세 조각으로 찢어져 판정 함수에 닿지도 못했다. "배열인지 추측"하는 휴리스틱을 넣었더니 `props['aria-selected']`가 섞인 className에서 판정이 뒤집혔다.
  - Rule: 토큰화 규칙에 추측을 넣지 않는다. 여기선 "대괄호 안에서도 따옴표는 언제나 구분자"라는 한 줄 규칙으로 두 경우가 동시에 풀렸다
  - Context: 이 수정 과정에서 배열 리터럴에 숨어 있던 필터 칩의 활성 보더(2.0~2.2:1)가 드러나 함께 고쳤다.
- 참고: 이번 라운드는 **제품 결함 2건**(`/terms` 텍스트 대비, 경제 필터 칩 보더)과 가드 구멍 3건이었다. R3~R5가 제품 0건이었던 것과 달리, 스캐너를 넓히자 곧바로 새 제품 결함이 나왔다 — 가드를 고치는 일이 곧 제품을 보는 일이라는 증거다.

## [배포 전 5종 감사 R7 | redesign-p1 | 2026-08-26]
- Violation: **패턴 교훈을 한 계열에만 적용했다.** R6에서 `ui-*`의 표면/텍스트 분리를 전수로 고쳤는데, 같은 분리를 가진 `grade-*`와 `chart-bullish/bearish`는 안 봤다. `trendUtils.ts`의 `[강세]`/`[약세]` 배지가 자기 `/10` 틴트 위에서 **라이트 3.99:1**이었다. 그 규칙은 globals.css에 적혀 있고 다른 컴포넌트 주석에도 반복돼 있으며, 같은 위젯의 형제 상수는 이미 준수하고 있었다.
  - Rule: "패턴으로 고쳤다"고 할 때 **패턴의 정의를 먼저 적는다.** 여기서 패턴은 `ui-*`가 아니라 "표면/텍스트 짝이 있는 모든 의미 색 계열"이었다
  - Rule: 규칙이 이미 문서·주석에 적혀 있다면 그건 **이미 한 번 배운 것**이다. 새로 발견할 게 아니라 전수로 적용됐는지 확인할 대상이다
  - Context: 실측으로 기하를 특정했다 — `chart-*`는 민 배경에서 4.53~4.89로 통과하고 **자기 틴트 위에서만** 3.99~4.23으로 실패한다. 30곳 중 틴트 위에 있던 배지만 고쳤다.
- Violation: 가드 구멍 7건이 더 있었고, 그중 셋은 **한 파일에서 고친 것을 옆 파일이 그대로 재현**한 것이었다. 새 텍스트 가드는 변형 제거가 없어 `hover:text-ui-danger`가 통과했고 — 바로 옆 보더 가드가 같은 커밋에서 고친 바로 그 결함이다.
  - Rule: 같은 판별을 두 번째로 짜고 있으면 **공용으로 뽑는다.** 이 세션에서만 세 번 재현됐다(주석 제거, 게으른 `cn(` 캡처, 변형 제거)
  - Context: `stripVariants`를 support로 옮겨 두 가드가 같은 구현을 쓴다. 임의 변형(`[&:hover]:`), 이름 붙은 group/peer(`group-hover/tog:`), 대괄호 안 콜론(`data-[state=open]:`)까지 한 곳에서 처리한다.
- Violation: **모르는 변형에 던지는 위치가 틀렸다.** 색이라고 확정하기 전에 던져서 `file:border-0`(폭)이나 `before:border-…`처럼 이미 레포에 있는 코어 변형까지 터졌다.
  - Rule: fail-closed는 **판정 대상에 대해서만** 적용한다. 대상이 아닌 입력에 실패를 내는 건 오탐이고, 오탐이 잦은 가드는 결국 꺼진다
- Violation: `fillOf`의 파일 단위 확대가 **보수적인 방향이 아니었다.** 흰 면이 램프보다 후한 토큰이 있어(`primary-800` 램프 2.18 vs 흰 면 8.72), 흰 면으로 바꿔치우면 램프에 앉은 컨트롤이 검사에서 빠졌다. 토글이 그 예다 — 썸만 `bg-white`이고 트랙은 램프다. 게다가 이 탐지만 주석 제거를 안 거쳐서, 주석 속 `bg-white` 한 줄로 파일 전체 판정이 뒤집혔다.
  - Rule: "보수적으로 잡았다"고 쓰기 전에 **어느 방향이 보수적인지 수치로 확인한다.** 직관이 반대인 경우가 있다
  - Context: 두 표면을 모두 재고 최솟값을 쓰도록 바꾸고, 탐지도 `blankComments`를 거치게 했다.
- Violation: (내 실수) 토큰화에서 대괄호 양끝을 무조건 떼어내 `[&:hover]:border-…`의 여는 괄호가 잘렸고, 변형 파서에 닿지 못했다. 배열 리터럴을 쪼개려던 정리 단계였다.
  - Rule: 토큰을 **다듬지 않는다.** 홀로 남은 `[`는 어떤 규칙과도 안 맞아 무해하지만, 잘린 토큰은 조용히 다른 뜻이 된다
- Violation: (내 실수) 사용처 색인이 `className`이라는 **이름 자체**를 담았다. 컨트롤이 `className={cn(className, …)}`로 프롭을 넘겨받는 형태가 흔해서, 트리의 모든 지역 `const className`이 컨트롤 보유로 잡혔다(장식 `<span>` 뱃지가 그렇게 검출됐다).
  - Rule: 이름 기반 색인에는 **전달 통로 이름**을 넣지 않는다. 그건 값이 아니라 배관이다
- Violation: 404가 **테마를 적용하지 않는다.** Next가 매칭 실패 경로를 `<html id="__next_error__">` 셸로 렌더할 때 루트 레이아웃의 `<head>`를 거치지 않아 부트스트랩이 실행되지 않고, 라이트를 고른 사용자가 완전히 어두운 404를 본다.
  - Context: `not-found.tsx`와 `global-error.tsx`에 스크립트를 직접 넣었다. 내 인벤토리 probe도 그 자리에서 `data-theme`이 `undefined`였는데, JSON에서 undefined 키가 빠져 눈에 안 띄었다 — **없는 값은 출력에서도 사라진다**는 걸 감안해야 한다.
- Violation: (프로세스, 중대) **측정 리그가 옛 빌드를 서빙하고 있었다.** 워크트리 체크아웃과 빌드를 `&&`가 아니라 `;`로 이어서, 체크아웃이 실패해도(내가 복사해둔 파일 때문) 빌드가 그대로 돌았다. 게다가 서버 부팅 뒤에 `.next`를 다시 만들어 청크가 404 나면서 인증 폼이 아예 마운트되지 않았다.
  - Rule: 리그를 세운 뒤 **서빙되는 바이트로** 대상 커밋을 확인한다. HEAD·타임스탬프가 아니라, 그 커밋에만 있는 문자열이 응답에 있는지 본다
  - Rule: 빌드 후에는 서버를 **반드시 재기동**한다. 부팅 시점 매니페스트와 디스크가 어긋나면 파일이 있어도 404가 난다
  - Context: 그 서버 위에서 내가 직접 돌려 "0건"이라 보고한 스윕도 함께 무효였다. 감사자가 깨끗하다고 보고하지 않고 막은 판단이 옳았다.

## [404 테마 — 범위 정정 | redesign-p1 | 2026-08-26]
- 정정: "404가 테마를 적용하지 않는다"를 라우트 전체 문제로 보고 `not-found.tsx`에 스크립트를 넣었는데, 실측해보니 **범위가 달랐다.**
  - 루트 미매칭 경로(`/foo/bar/baz`)는 레이아웃 그대로 렌더되고 `<head>`의 테마 스크립트가 정상 실행된다. 내가 넣은 스크립트는 거기서 **중복**이었다(실행 가능한 태그 2개).
  - `<html id="__next_error__">` 셸이 뜨는 건 `/news/[category]`처럼 **동적 세그먼트가 `notFound()`를 부르는** 경우다. 그 셸은 루트 레이아웃을 안 거치므로 스크립트가 RSC 플라이트 페이로드 안 문자열로만 남고 실행되지 않는다 — `not-found.tsx`에 넣어도 그 셸에는 렌더되지 않으므로 소용이 없다.
  - Rule: "이 페이지가 X를 안 한다"를 고치기 전에 **어느 렌더 경로에서** 그런지 가른다. 경로가 둘이면 수정도 둘이거나, 한쪽은 애초에 대상이 아니다
  - Context: 중복분은 걷어냈고, 루트 레이아웃을 실제로 **교체**하는 `global-error.tsx`에만 남겼다(거기선 자기 `<html>`을 쓰므로 반드시 필요하다).
- 남은 한계(프레임워크 동작): 동적 세그먼트의 `notFound()`가 만드는 에러 셸에서는 라이트를 고른 사용자가 어두운 페이지를 본다. master에는 테마 자체가 없어 회귀는 아니다. 고치려면 그 세그먼트가 `notFound()` 대신 레이아웃 안에서 자체 not-found UI를 렌더해야 하며, 이는 리디자인 범위 밖이다.

## [배포 전 5종 감사 R8 | redesign-p1 | 2026-08-26]
- Violation: **커밋 메시지에 사실이 아닌 것을 적었다.** R7에서 "변형 제거를 공용으로 뽑아 두 가드가 같은 구현을 쓴다"고 적었는데, 실제로는 보더 가드만 `stripVariants`를 import했고 텍스트 가드는 여전히 `^text-…$` 앵커였다. `hover:text-ui-danger` 하나면 그 가드가 통째로 무력화된다 — R7이 "고쳤다"고 기록한 바로 그 결함이다.
  - Rule: "공유했다"고 쓰기 전에 **import를 grep한다.** 한쪽만 고치고 양쪽을 고쳤다고 적으면, 다음 사람은 그 파일을 다시 안 본다
  - Rule: 커밋 메시지의 주장도 검증 대상이다. 코드보다 오래 남고 더 널리 읽힌다
- Violation: **측정 표면을 하나 빼고 결론을 냈다.** R7에서 `chart-*`가 "민 배경에서는 통과(4.53~4.89), 자기 틴트 위에서만 실패"라고 적고 30곳을 그대로 뒀는데, 그 범위는 `secondary-900`·`800`만 잰 것이고 **인셋 표면 `secondary-950`을 빼먹었다.** 넣으면 4.23/4.30으로 **민 배경에서도 미달**이다.
  - Rule: 표면 램프는 셋이다(950 인셋 / 900 본문 / 800 카드). 둘만 재고 "민 배경에서는 통과"라고 쓰면 그 문장이 근거가 되어 수정 범위를 잘못 정한다
  - Rule: 최솟값을 주장할 때는 **후보 전체를 열거해 보인다.** 내 출력에 950이 아예 없었는데도 결론에는 "민 배경"이라는 일반화가 들어갔다
  - Context: 31곳을 `ui-*-text`로 전환했다. 전부 텍스트 용도였고 아이콘 전용은 없었다. `ChartContent`의 오류 배너는 틴트 위에서 4.36이었다.
- Violation: 텍스트 가드가 `ui-*`만 보고 있었다. `grade-a..f`는 globals.css에 같은 분리와 근거("4.32~4.48 AA 미달")가 적혀 있는데 감시 밖이었다 — 되돌리는 편집이 모든 게이트에 안 보인다.
  - Context: `grade-a..d,f`를 추가했다(**`grade-e`는 존재하지 않는 토큰**인데 내가 확인 없이 넣었다가 테스트가 잡았다). `-text` 짝이 아예 없는 `chart-bullish/bearish`는 "텍스트에 못 쓰는 그래픽 전용"으로 따로 두고 대체 토큰을 함께 알려주게 했다.
  - Context: 등급 게이지는 예외로 뒀다 — 호는 SVG `stroke`(그래픽 3:1)이고 큰 글자는 `text-4xl font-bold`(36px)라 큰 텍스트 기준 3:1이다. 근거를 예외 목록에 함께 적었다.
- Violation: 불변식을 실제보다 엄격하게 적었다. "`-text`가 표면보다 대비가 **높다**"로 단언했는데, 다크에서는 두 토큰이 같은 값인 계열이 있다(분리가 라이트 전용). 참인 관계는 "낮지 않다"였다.
  - Rule: 불변식은 **관측을 보고** 적는다. 더 강하게 적으면 정상 상태가 실패로 잡히고, 그 실패를 없애려다 규칙 자체를 약하게 만들게 된다
- Violation: (작업 중 실수) 뮤테이션 복원에 `git checkout --`를 썼는데, 아직 커밋 전이라 **그 파일의 내 수정까지 되돌아갔다.** 가드가 곧바로 다시 잡아 드러났다.
  - Rule: 커밋 전 상태에서 뮤테이션을 되돌릴 때는 **파일 사본**으로 복원한다. `git checkout`은 HEAD로 되돌리는 것이지 뮤테이션만 취소하는 게 아니다

## [배포 전 5종 감사 R9 | redesign-p1 | 2026-08-26]
- 결과: **제품 결함 0건.** 11개 라우트/테마 조합 실측에서 렌더 대비 실패가 없었고, 측정기도 양성 대조(흰 배경 위 `#f7f8fa` 심은 것)로 검증됐다. 6건은 전부 가드 기전 문제다. R6~R8이 매 라운드 새 제품 결함을 냈던 것과 갈린다.
- Violation: R8이 보고한 **중첩 대괄호 결함을 내가 안 고쳤다.** 한 겹짜리만 처리한 채 다음 라운드로 넘겼고, `[&:not([hidden])]:`·`has-[[data-open]]:` 같은 평범한 Tailwind 형태에서 변형이 하나도 안 벗겨져 색 매칭이 실패하며 **조용히 통과**했다. 이 파일을 지나는 모든 가드가 동시에 눈이 먼다.
  - Rule: 감사가 보고한 항목은 **닫았는지 그 자리에서 확인**한다. "다음 라운드에 보겠다"는 건 닫힌 게 아니다
  - Context: 정규식을 버리고 깊이 계산으로 바꿨다. 정규식은 중첩을 표현할 수 없다는 걸 세 번째로 확인한 셈이다.
- Violation: 예외가 **이름보다 넓게 덮였다.** 보유 상수를 찾을 때 `source.indexOf(line)`으로 줄 텍스트를 다시 찾았는데, 같은 텍스트를 가진 **첫** 줄이 잡혀서 면제되지 않은 상수가 면제된 상수의 예외를 물려받았다. 감사가 줄 내용이 바이트 동일한 새 상수를 심어 증명했다.
  - Rule: 위치를 텍스트로 되찾지 않는다. 순회 중이면 **그 순회의 인덱스**를 쓴다 — 텍스트는 유일하지 않다
- Violation: 텍스트 유틸리티를 `text-`만 봤다. `placeholder-`·`caret-`·`decoration-`도 글자로 렌더되는데 감시 밖이었고, `placeholder-ui-danger`는 인셋 입력 배경 위에서 4.30:1이다.
  - Rule: "텍스트"의 정의를 접두어 하나로 좁히지 않는다. 같은 결함이 한 접두어 옆에 그대로 있다
- Violation: 규칙의 근거가 실사용을 못 덮었다. 불변식이 **5% 틴트 하나만** 검증했는데 실제로는 40%까지 쓰인다.
  - Context: 소스에 실제로 등장하는 알파를 쓰도록 바꿨다. 이 과정에서 두 번 잘못 좁혔다 — (1) 전 계열 알파를 한데 모아 **코드에 없는 조합**을 만들어 검사했고, (2) `bg-토큰/NN`을 전부 텍스트 표면으로 세어 글자를 안 얹는 자리(솔리드 버튼 `/90`, 막대 그래픽 `/60`)까지 포함했다. 최종 규칙은 "같은 클래스 목록에 `-text` 짝이 함께 있을 때만".
  - Rule: 근거를 넓힐 때 **실제로 함께 나타나는 것만** 짝지어야 한다. 데카르트 곱은 존재하지 않는 반례를 만들어낸다
- Violation: 문서가 강제되는 규칙과 **모순**됐다. `DESIGN.md`는 그래픽에 `text-chart-*`를 쓰라고 적고 "가격 델타 칩이 유일한 사용처"라고 했는데, 이 브랜치가 그걸 전부 바꾸고 가드로 금지했다. 가드의 안내 메시지도 그래픽 용도에 텍스트 토큰을 권하고 있었다.
  - Rule: 규칙을 코드로 강제하면 그 규칙을 적어둔 문서도 같은 커밋에서 고친다. 안 그러면 문서가 사람을 위반으로 안내한다
- Violation: Tailwind가 프로젝트 루트를 훑어 **문서에 예시로 적힌 클래스까지 CSS로 구웠다.** 금지한 유틸리티가 죽은 규칙으로 번들에 남아 있었다.
  - Context: `@source`로 범위를 `src/`로 한정했다. 문서가 번들을 바꾸면 안 된다.
- Violation: (내 실수) 불변식을 토큰마다 트리 전체를 다시 훑도록 짜서 16회 전체 스캔이 됐고 기본 5초 타임아웃을 넘겼다. **가드만 돌리면 통과하고 전체 스위트에서만 실패**해, 원인이 격리 문제처럼 보였다.
  - Rule: 파일 트리 스캔은 **한 번만** 하고 캐시한다. 그리고 "단독 통과, 전체 실패"는 격리 문제이기 전에 **비용 문제**일 수 있다

## [배포 전 5종 감사 R10 | redesign-p1 | 2026-08-26]
- 결과: **제품 결함 0건이 두 라운드 연속.** 15개 라우트 실측(전부 200/307, 에러 페이지 0)과 대비 측정이 깨끗해 R9의 0건이 유지됐다. 다만 R9가 "고쳤다"고 기록한 6건 중 **2건이 실물에 존재하지 않았다** — 하나는 무효(no-op)였고 하나는 아예 안 쓰였다.
- Violation: **없는 경로를 grep하고 그 빈 결과를 "0건"으로 읽었다.** R9에서 "빌드된 CSS에 `.text-chart-bullish` 규칙 0개"라고 보고했는데, 내가 훑은 `\.next/static/css/`는 존재하지 않는 디렉터리였다. 실제 CSS는 `\.next/static/chunks/`에 있고 거기엔 그 규칙이 **있었다.**
  - Rule: "0건"을 보고하기 전에 **측정기가 대상을 실제로 봤는지** 먼저 확인한다. 파일을 하나도 못 연 스캔과 위반이 없는 스캔은 출력이 같다
  - Rule: 경로를 손으로 적었으면 그 경로에 파일이 몇 개인지 함께 센다. 분모 없는 분자는 근거가 아니다
- Violation: **`@source`는 범위를 좁히지 않는다.** Tailwind v4에서 별도 지시어 `@source`는 스캔 경로를 **추가**할 뿐이고 자동 루트 탐지는 그대로 살아 있다. R9의 `@source './../../src'`는 아무것도 바꾸지 못했고, 그 커밋 **이후에** 만들어진 번들에도 문서 마크다운에서 나온 죽은 규칙이 그대로 있었다. 자동 탐지를 끄려면 import에 직접 `@import 'tailwindcss' source('...')`를 걸어야 한다.
  - Rule: 빌드 산출물을 바꾸는 수정은 **산출물로 확인한다.** 소스가 바뀐 것과 번들이 바뀐 것은 다른 사실이다
  - Context: 고친 뒤 직접 컴파일해 확인했다 — 죽은 규칙 149개(약 19KB) 제거, `text-green-400`·`text-red-400`·`text-chart-bullish` absent, 실사용 유틸리티는 전부 present. `src/` 밖에 `.tsx`/`.jsx`/`.mdx`가 하나도 없다는 것도 함께 확인했다(범위 축소가 안전한 근거).
- Violation: **커밋 메시지가 주장한 수정이 코드에 없었다.** R9 커밋이 텍스트 접두어를 `placeholder-`·`caret-`·`decoration-`까지 넓혔다고 적었지만 `TEXT_UTILITY_RE`는 그대로 `^text-(...)`였다 — `git log -S`로 확인하면 그 커밋은 해당 줄을 건드리지도 않았다. R8에서 같은 성격의 위반("공유했다고 적었지만 한쪽만 import")을 기록해 놓고 다음 라운드에 반복했다.
  - Rule: 커밋 메시지에 적은 각 주장을 **그 파일에서 한 번씩 grep한 뒤에** 커밋한다. 여러 건을 한 라운드에 고칠 때 하나가 조용히 빠진다
- Violation: 규칙을 **한 철자로만** 막았다. `semanticTextTokenGuard`는 className만 보는데, SVG `<text>`의 색은 `fill` 속성으로도 들어온다. 옵션 차트 두 곳이 같은 파일의 HTML 범례는 `-text`로 옮겨 놓고 차트 안 SVG 범례는 `var(--color-chart-bullish)`로 남겨 뒀다 — 가드가 초록인 채로.
  - Rule: 같은 규칙의 **다른 철자**를 함께 막는다. 하나만 막으면 나머지가 "가드가 통과했으니 괜찮다"는 신호를 받는다
  - Context: 가드에 SVG 스캐너를 붙였다(클래스 `fill-<토큰>`과 `fill={상수}` 경유 `var()` 둘 다). 두 철자 각각 뮤테이션으로 실제로 잡히는지 확인했다. `<rect>` 막대와 색칩은 그래픽이므로 `chart-*` 유지. `DESIGN.md`에도 같이 적었다.
- Violation: 알파 색인이 **줄 단위**로 짝을 찾아, 여러 줄에 걸친 클래스 목록과 클래스 맵 객체의 틴트가 근거에서 빠졌다. 틴트를 얹은 컨테이너와 그 위 글자는 거의 언제나 다른 줄에 있다.
  - Context: 초기화식 단위로 넓혔다(`readInitialiser` 재사용). 초기화식이 매치를 못 품으면 예전처럼 줄로 좁힌다 — 넓히다 코드에 없는 조합을 지어내면 가짜 실패가 되고, R9에서 이미 그 방향으로 두 번 잘못 좁혔다.
- Violation: (작업 중 실수) zsh에서 `${PIPESTATUS[0]}`로 종료코드를 잡으려 했다. zsh는 소문자 `pipestatus` 배열이라 **빈 문자열**이 나왔고, 출력도 비어 있어 게이트 결과를 못 읽는 채로 "통과"로 넘어갈 뻔했다.
  - Rule: 종료코드는 **파이프 없이** 잡는다 — 로그로 리다이렉트한 뒤 `$?`를 읽는다
  - Context: `oxlint`는 파이프로 넘기면 깨끗할 때 아무것도 안 찍는다. `--format=github`으로 진단 줄 수를 세어 0을 **수로** 확인했다

## [배포 전 5종 감사 R11 | redesign-p1 | 2026-08-26]
- 결과: **제품 결함 0건이 세 라운드 연속.** 이번 라운드의 최대 위험이었던 "스캔 범위 축소가 실사용 스타일을 떨궜는가"는 세 갈래 독립 검증에서 전부 0이었다 — 서빙 마크업 클래스 623개, 클라이언트 번들 692개, 서버 청크 697개 중 규칙 없는 토큰 0. master에만 있는 187개는 전부 `docs/`·`.agents/` 마크다운에서만 나오는 죽은 규칙이었고, `src/`에서 걸린 4개는 모두 **주석 안**이었다.
- Violation: **실패할 수 없는 테스트를 쓰고 그것으로 기능을 검증했다고 적었다.** R10에서 초기화식 스코프 짝짓기를 넣고 "교차줄 짝을 잡는다"는 테스트를 붙였는데, 단언한 값(`ui-warning`의 0.1)은 **같은 줄 짝도 내놓는 값**이었다. 감사가 기능을 통째로 제거하고 6/6 초록 + 알파 색인 바이트 동일을 보여 드러냈다.
  - Rule: 새 기전을 검증할 때는 **그 기전을 빼고 돌려본다.** 빼도 통과하면 그 테스트는 다른 것을 재고 있는 것이다
  - Rule: 트리에서 나온 값을 단언하면 그 값의 **출처가 여럿**일 수 있다. 기전을 붙들려면 그 기전만 통과할 수 있는 **합성 입력**을 쓴다
  - Context: 짝짓기 스캔을 파일이 아니라 **소스 문자열**을 받는 `tintPairsIn`으로 뽑고, 짝을 찾은 범위(`via: 'initialiser' | 'line'`)를 함께 돌려주게 했다. 테스트 셋으로 교체 — 교차줄 컨테이너/자식은 초기화식 경로로 잡히고, 서로 다른 초기화식의 배경·글자는 짝지어지지 않으며, 초기화식 밖 인라인 JSX는 줄 경로로 되돌아간다. 기능을 제거하면 첫 번째가 깨지는 것을 실제로 확인했다.
- Context(가드 밖 잔여 위험, 결함 아님): `chartColors.ts`는 lightweight-charts가 CSS 변수를 못 읽어 hex를 직접 들고 있다. 현재 값 5개는 토큰과 정확히 일치하지만 그걸 강제하는 것은 없고, 테스트는 같은 리터럴을 다시 단언할 뿐이다. 토큰만 바꾸면 차트 색이 조용히 어긋난다.

## [배포 전 5종 감사 R11 — 렌더·SEO | redesign-p1 | 2026-08-26]
- 결과: 22개 라우트 × 양 테마 = 44회 실측에서 **규칙 없는 클래스 0건, 가로 오버플로 0건, AA 실패 0건.** 스캔 범위 축소가 실사용 스타일을 떨구지 않았음이 브라우저에서도 확인됐다(정적 CSS diff와 다른 계측).
- Violation: **`<head>` 스크립트가 닿지 않는 렌더 경로를 "고칠 수 없다"로 닫아버렸다.** R8에서 동적 세그먼트 `notFound()`의 에러 셸(`<html id="__next_error__">`)에 테마 스크립트가 없다는 걸 확인하고 "프레임워크 동작·범위 밖"으로 기록했는데, 그 셸은 **본문이 통째로 클라이언트 렌더**(SSR 가시 텍스트 0자)라 컴포넌트 안에서 속성을 찍으면 적용된다. 확인한 것은 "스크립트가 실행되지 않는다"였고 결론은 "고칠 수 없다"였다 — 관측보다 넓은 결론이다.
  - Rule: "프레임워크 한계"로 닫기 전에 **그 경로가 무엇을 하긴 하는지** 본다. 안 되는 방법 하나를 확인한 것은 모든 방법을 확인한 것이 아니다
  - Context: `applyStoredTheme()`를 `theme.ts`에 두고 `not-found.tsx`에 클라이언트 폴백을 붙였다. 판정이 문자열(인라인)과 함수(번들) 두 벌로 존재하게 되므로, **양쪽을 실제로 실행해 결과를 대조하는** 테스트를 함께 넣었다 — 한쪽만 보는 테스트는 드리프트를 못 잡는다. 함수를 어긋나게 바꿔 실제로 깨지는 것을 확인했다.
- Violation: 그래픽 대비를 **불투명도까지 계산해서** 보지 않았다. OI 차트 Call 막대가 라이트 카드 위에서 `opacity 0.7` 때문에 2.85:1(3:1 미달)이었다. 다크에서는 통과라 다크만 보면 안 보인다 — 이 브랜치에서 세 번째 반복되는 "라이트에서만 깨지는" 유형이다.
  - Rule: 그래픽 대비는 **합성 후 색**으로 잰다. 토큰 값이 기준을 넘어도 알파가 얹히면 넘지 않는다
  - Context: 나란히 놓이는 Volume 차트가 이미 0.85라 그 값으로 맞췄다(3.70:1). 상위 OI 강조는 1.0과의 차이로 여전히 읽힌다.
- Context(결함 아님): 홈에서 `HowTo` JSON-LD와 "이용 방법" 3단계 섹션이 빠진 것은 사용자가 명시적으로 승인한 HowItWorks 제거다. Google이 HowTo 리치 결과를 폐지해 순위 영향은 없다.
- Context(측정 함정, 감사가 스스로 잡음): 크롬 창이 최소화돼 탭이 `visibilityState: hidden`이면 **스켈레톤이 무한히 멈춘다**(`/market`이 15초간 `.animate-pulse` 118개·363자). 스크롤로 페인트를 강제해야 풀린다 — hover로는 안 된다. 그리고 `animate-pulse`는 `infinite`라 `getAnimations().finish()`가 throw하므로, 그 요소의 중간 프레임을 재면 가짜 대비 실패가 나온다.

## [배포 전 5종 감사 R12 — 코드·테스트 | redesign-p1 | 2026-08-26]
- 결과: 귀속 확정. R11의 404 테마 수정이 **실제로 동작한다** — React 19는 하이드레이션 중 삽입한 인라인 `<script>`를 실행할 수 없고(fragment 파싱된 script는 already-started로 표시된다, react-dom 소스 확인), `setAttribute` 계측에서 그 라우트의 writer 집합이 `{applyStoredTheme}` 하나였다. R11의 관측은 숨김 탭 아티팩트가 아니라 진짜 결함이었다.
- Violation: **내 수정에 회귀 보호가 하나도 없었다.** 감사가 `<ThemeAttributeFallback />`과 그 import를 지우고 전체 스위트를 돌렸더니 10,474건이 전부 초록이었다 — 이 브랜치의 간판 수정이 아무 신호 없이 삭제 가능했다. R10·R11이 각각 한 번씩 잡은 "효과가 관측되지 않는 수정"이 이번엔 내 수정 자체에서 나왔다.
  - Rule: 수정을 끝내기 전에 **그 수정을 지우고 게이트를 돌린다.** 초록이면 그 수정은 보호되지 않은 것이고, 다음 리팩터링이 조용히 되돌린다
  - Context: 유닛(존재가 아니라 **속성이 찍혔는지**)과 e2e(에러 셸은 프로덕션 빌드에서만 재현된다) 두 층에 넣었다. 둘 다 폴백을 지우면 깨지는 것을 확인했다.
- Violation: **같은 대비 결함이 세 라운드 연속 다른 파일에서 나왔다.** 옵션 차트 막대(라이트 2.85), 재무 추이 막대(`fill-chart-bullish/70` → 2.64), 애널리스트 등급 밴드(`bg-ui-success/60` → 2.27). 매번 인스턴스만 고쳤고, 그때마다 "이 파일은 봤다"는 신호가 남았다. 공통 원인은 하나다 — **토큰 값은 기준을 넘는데 알파가 얹히면 넘지 않는다**, 그리고 그걸 보는 가드가 없었다.
  - Rule: 같은 결함이 두 번째 파일에서 나오면 그건 인스턴스가 아니라 **패턴**이다. 세 번째를 고치기 전에 가드를 먼저 쓴다
  - Context: `graphicAlphaContrastGuard`를 넣었다. 계산은 이미 `minContrastOverSurfaces`에 다 있었고 옆 가드가 안 쓰고 있었을 뿐이다. 두 되돌림 모두 정확한 수치·위치로 잡히는 것을 확인했다.
  - Context: 알파 하한이 `/85`인 것은 취향이 아니라 측정이다 — `/70`=2.64, `/80`=3.09(아슬), `/85`=3.34. `FearGreedGroupBar`가 이미 같은 이유로 같은 값을 쓰고 근거까지 적어뒀는데 다른 두 파일이 그 결정을 놓쳤다.
- Violation: **가드 범위를 접두어로 자르려다 274건짜리 가짜 실패를 만들 뻔했다.** 트리의 알파 색 유틸리티 283개 중 280개가 `bg-*`이고 그중 274개가 3:1 미만인데, 전부 글자 뒤 틴트라 그래픽 기준의 대상이 아니다. 처음 self-closing 휴리스틱으로 좁혔더니 이번엔 스켈레톤 자리표시자 44곳이 걸렸다 — 전부 중립 램프였다.
  - Rule: 가드 범위는 **문법이 아니라 의미**로 자른다. 예외 44줄은 규칙이 아니라 소음으로 읽히고, 가짜 실패가 몇십 건 나오는 가드는 즉시 무력화된다
  - Rule: 범위를 정하기 전에 **후보 전체를 세어 본다.** 세지 않고 규칙부터 쓰면 범위가 맞는지 알 수 없다
- Violation: (작업 중 실수, 스스로 잡음) 알파를 상수로 빼서 `` `fill-chart-bullish${ALPHA}` ``로 조립했다. Tailwind는 리터럴만 정적 추출하므로 그 클래스는 아예 안 구워진다 — tsc·lint·빌드 전부 통과하고 **화면에서만 색이 사라진다.**
  - Rule: 클래스 이름은 언제나 리터럴로 적는다. DRY보다 추출 가능성이 먼저다
- Violation: (반복) JSDoc 본문에 `bg-ui-*` 같은 축약을 쓰다가 별표-슬래시가 붙어 주석이 조기 종료됐고 파일이 통째로 파싱 불가가 됐다. 같은 함정에 두 번째로 걸렸다.
  - Rule: 주석 안에서 와일드카드를 쓸 때 슬래시가 뒤따르면 형태를 바꿔 적는다

## [배포 전 5종 감사 R12 — 렌더·SEO | redesign-p1 | 2026-08-26]
- 결과: 모바일 첫 커버리지. 15개 라우트 × 양 테마에서 가로 오버플로 0, 잘림 0, 헤더 가림 0, 글자 대비 실패 0(`/backtesting` 2,875개 노드 포함). SEO는 비교 가능한 전 라우트에서 무회귀 — `/news`·`/backtesting`·`/ZZZZNOTREAL`은 17개 필드 전부 동일하고 `/market`·`/economy`는 본문이 늘었다.
- **미해결(이번 PR 범위 밖으로 판단)**: 라이트 테마에서 **지표 색 112개 중 75개가 차트 배경(`#f7f8fa`) 위 3:1 미만**이다. 최악 1.36:1(Donchian·Keltner·StochRSI 등). 다크에서는 0건 — 팔레트가 다크 전용으로 튜닝됐고 라이트가 그대로 물려받았다. 캔버스라 **어떤 DOM 프로브도 못 본다**. 감사 12라운드 중 어느 것도 못 잡았고, 범례 점 하나(2.82:1)가 DOM에 노출돼 있어서 겨우 실마리가 잡혔다.
  - Rule: 캔버스·WebGL로 그리는 것은 접근성 스윕의 사각지대다. **소스의 색 상수를 배경 상수와 직접 대조**하는 것이 유일한 관측 경로다
  - 왜 지금 안 고치는가: `CHART_COLORS` 참조가 41개 파일 188곳이고, 테마 동기화(`useChartThemeSync`)는 크롬(배경·그리드·축)만 다시 칠한다 — 시리즈 색을 테마별로 주려면 접근자 도입 + 오버레이 훅 전반의 재도색 배선이 필요하다. 12라운드를 돈 브랜치의 간판 화면에 막판에 넣을 변경이 아니고, 넣으면 지금까지의 검증을 대부분 다시 해야 한다. master에는 라이트 테마가 없어 회귀도 아니며, 기본값이 다크라 옵트인 사용자에게만 해당한다.
  - 범례 점(`usePaneLabels`)만 어둡게 하자는 제안은 반려했다. 그 점은 **차트 선과 같은 색이어야 키로 기능**한다 — 점만 바꾸면 매핑이 깨진다. 팔레트와 함께 다뤄야 한다.
- Violation: 같은 ⓘ 기호가 화면마다 크기가 달랐다. `InfoTooltip`은 `min-h-6 min-w-6`인데 `SkillsShowcase`가 자체 버튼을 쓰며 그 최소치를 빠뜨려 모바일에서 10.4×12였다.
  - Rule: 공용 컴포넌트가 있는데 자체로 다시 만들면 그 컴포넌트가 담고 있던 결정(여기서는 최소 탭 크기)이 조용히 빠진다
- Violation: 떠 있는 안내의 닫기 버튼이 20×20이었다(WCAG 2.2 SC 2.5.8은 24×24). 단독 컨트롤이라 인라인 텍스트 예외가 적용되지 않는다. 글리프는 두고 히트 영역만 키웠다.
- Context(남은 한계, 결함 아님): 동적 세그먼트 404는 에러 셸의 SSR `<head>`에 스크립트를 넣을 수 없어, 라이트 사용자가 **첫 페인트에서 잠시 어둡다**. 다만 그 셸은 하이드레이션 전까지 본문이 비어 있어 실제로는 빈 화면의 색만 바뀐다. "테마가 아예 안 붙는다"에서 "하이드레이션 후 붙는다"로 좁혀진 상태다.
- Context(선재, 회귀 아님): 푸터·내비 링크가 20px 높이로 24×24 미만이다. master에서 동일함을 확인했다. 모바일을 이전 라운드에서 안 쟀기 때문에 이제야 보였을 뿐이다.
- Context(측정 한계, 감사가 명시): 크롬은 창 너비를 500px로 하한 clamp하고 백그라운드 탭은 resize를 무시한다. CDP device-metrics 도구가 없고 iframe은 앱 자신의 `X-Frame-Options: DENY`로 막힌다 — **390px는 측정 불가**였고 500px로 대체했다. 또 `/market`·`/terms`·`/AAPL/options` 등은 Suspense 경계가 하이드레이션 후에도 안 풀려 스켈레톤이 남았는데, **master에서도 동일**해 환경 문제다(그 라우트들의 대비 커버리지는 부분적).

## [이슈 #770 처리 — 라이트 차트 팔레트 | redesign-p1 | 2026-08-26]
- 배경: 라이트 테마에서 지표 색 112개 중 75개가 차트 배경(`#f7f8fa`) 위 3:1 미만(최악 1.36:1). 사용자가 "우리 사이드이펙트"라고 판단해 이번 PR에서 처리하기로 했다. 처음에는 범위 밖으로 미뤘던 건이다.
- Violation: **측정 지표를 잘못 골라 없는 결함을 만들 뻔했다.** 도출한 라이트 색들의 상호 대비비가 전부 1.0으로 나와 "색 구분이 사라졌다"고 결론 내려 했는데, 같은 배경에 3.5:1로 맞춘 색끼리는 휘도가 비슷해 대비비가 1.0인 것이 **당연**하다. 다크 팔레트도 같은 성질이다. 구분은 휘도가 아니라 색상이 나른다.
  - Rule: 대비비(WCAG)는 **배경 대비** 도구다. 두 전경색이 서로 구분되는지에는 쓸 수 없다 — 그건 지각 거리(ΔE)로 잰다
  - Rule: 새 지표로 대량 실패가 나오면 제품이 아니라 **지표**를 먼저 의심한다. 이 세션에서 두 번째다(첫 번째는 정규식으로 `oklab()`을 파싱해 가짜 실패 2,369건)
- Violation: 제약 없는 최적화가 **의미를 깨뜨렸다.** 최소 ΔE를 최대화하도록 색상을 자유 회전시켰더니 Donchian 중앙선이 빨강(`#de0101`)이 됐다 — 이 제품에서 빨강은 하락이다. Keltner 중앙선은 초록이 돼 상승과 충돌했다.
  - Rule: 색은 값이 아니라 **약속**이다. 자동 도출에는 계열 경계를 제약으로 넣고, 의미색(상승·하락)은 아예 고정한다
  - Context: 계열별 회전 범위를 묶고 다시 돌려, 전 색 3.49:1 이상 · 가격 pane 최소 ΔE 18.6을 얻었다(다크 팔레트의 같은 지표는 8.5라 오히려 더 잘 갈린다).
- Violation: 게터로 바꾸면서 **모듈 스코프 스냅샷 7곳**을 놓칠 뻔했다. `CHART_COLORS`가 접근 시점에 테마를 보게 만들어도, `const MAP = { x: CHART_COLORS.y }`처럼 모듈 로드 때 읽어 담아두면 그 값은 다크로 굳는다 — 라이트에서 그 색만 조용히 옛 값으로 남고, 타입도 테스트도 통과한다.
  - Rule: 값을 게터로 바꾸면 **그 값을 담아두는 모든 자리**를 찾아야 한다. 읽는 시점이 규약의 일부가 된다
  - Context: 전수 스캔으로 7곳을 찾아 전부 호출 시점 읽기로 바꿨다(`PERIOD_COLOR_MAP`, `TRENDLINE_DIRECTION_COLOR`, `MARKER_STYLE_MAP`, `VOLUME_LABELS`, 보정선 색 2개, FearGreed 라인 색).
- 설계 판단: 소비처가 41개 파일 188곳이라 접근자로 전부 바꾸는 대신 **게터**로 두어 기존 표기를 유지했다. 세션 중 테마 토글은 시리즈가 생성 시점의 색을 들고 있어 갱신되지 않으므로, 오버레이 훅 31개를 각각 배선하는 대신 **차트 생성 4곳**에 `useThemeVersion()`을 걸어 차트를 다시 만든다. 대가는 토글 순간 줌·스크롤 초기화이며, 로드 경로에서는 값이 변하지 않아 리마운트가 없다.
- Violation: (작업 중) 린트가 `useMemo has unnecessary dependency: themeVersion` 경고를 냈다. 게터 의존을 린터가 볼 수 없어서인데, 경고를 그냥 두면 다음 사람이 그 의존을 지운다 — 그러면 토글 시 범례 점만 옛 색으로 남는다. 근거를 적고 명시적으로 억제했다.
  - Rule: 경고를 남긴 채 넘어가지 않는다. `exit 0`은 경고 수를 말해주지 않는다
- 회귀 보호: `chartPaletteContrastGuard`가 (1) 양 테마 전 지표 색의 배경 대비 3:1, (2) 라이트의 색 구분이 다크보다 나빠지지 않을 것, (3) 라이트 오버라이드 키가 전부 다크에 존재할 것을 강제한다. 라이트 `bullish`를 다크 값으로 되돌려 `2.82:1`로 잡히는 것을 확인했다.
- 함께 처리(빌드 감사 R13): 죽은 토큰 `--color-chart-neutral` 삭제(소비처 0), 그리고 `@source not`으로 테스트 픽스처를 스캔에서 제외 — 가드 테스트가 검출기 증명용으로 적어둔 클래스 40개가 프로덕션 CSS로 구워지고 있었다.

## [홈 first-load 17.3KB 회귀 — 원인 귀속과 수정 | redesign-p1 | 2026-08-26]
- Violation: **내가 만든 전용 컴포넌트가 LCP 라우트에 17.3KB를 얹었다.** 404 에러 셸의 테마를 메우려고 `ThemeAttributeFallback`을 만들어 `not-found.tsx`에서 렌더했더니, turbopack이 not-found 경계가 끌고 오는 홈 위젯 묶음(tabs + SkillsShowcase, 16.8KB)을 "이 모듈을 포함한 판"과 "안 포함한 판" 두 벌로 갈라 내보냈고 홈이 **둘 다** 받았다. 274바이트짜리 컴포넌트의 대가로 홈 first-load +20,803 B, 스크립트 태그 18개 대 17개.
  - Rule: 새 클라이언트 모듈을 **모든 라우트가 지나는 경계**(not-found·error 바운더리)에 추가하면 그 경계가 끌고 오는 묶음 전체의 청킹이 바뀔 수 있다. 크기가 작다는 것과 비용이 작다는 것은 다르다
  - Rule: 번들 영향은 **빌드 산출물로** 확인한다. 소스 크기로 추정하면 두 자릿수 배로 틀린다
- Context(귀속을 실험으로 확정): 세 변형을 각각 빌드해 쟀다. (1) 컴포넌트 유지 = +20,803 B / 18 스크립트, (2) 컴포넌트 완전 제거 = +3,480 B / 17, (3) 이미 그 경계에 있는 클라이언트 컴포넌트에 효과만 얹기 = **+3,817 B / 17**. 테마 수정의 실제 비용이 17,323 B에서 337 B가 됐다.
- Context(효과 없던 시도 2종, 둘 다 바이트 동일): `next/dynamic`으로 폴백을 감싸기, `next/dynamic`으로 `TickerCategories`를 지연 로드하기. **서버 컴포넌트에서 `dynamic()`은 청킹을 바꾸지 않는다** — RSC가 이미 클라이언트 경계에서 분할하기 때문이다. 결과가 세 번 바이트 동일이라 처음엔 빌드 미반영을 의심했는데, 컴포넌트 제거 실험이 값을 바꾸는 것으로 빌드는 정상임을 확인했다.
  - Rule: 최적화가 "효과 없음"으로 나오면 먼저 **측정이 살아 있는지**를 다른 변형으로 확인한다. 바이트 동일이 반복되면 빌드가 안 먹었을 수도, 그 수단이 원리적으로 무효일 수도 있다
- 남은 설계 부채: 테마 적용이 `ContactDialog` 안에 있다. 관심사 분리로는 어색하고, 그 이유를 구현부에 길게 적어 두었다. 더 나은 자리는 "에러 셸에 항상 있는 레이아웃 컴포넌트"이며, not-found 트리가 재구성되면 다시 봐야 한다.

## [배포 전 5종 감사 R14 | redesign-p1 | 2026-08-26]
- 결과: SEO 0건(56회 페치, 두 번 독립 실행해 바이트 동일), 빌드 1건(경미), 코드·테스트 8건 — 그중 하나가 **블로커**.
- Violation(블로커): **내가 넣은 테마 재도색이 차트를 백지로 만들었다.** 차트 생성 효과의 deps에만 `themeVersion`을 넣었더니 차트는 다시 만들어지는데 `setData`를 부르는 효과와 오버레이 훅 31개는 안정적인 ref에만 의존해 재실행되지 않았다. 토글 한 번에 캔들·거래량·축이 전부 사라지고 새로고침해야 복구됐다. 감사가 jsdom 프로브(createChart 2회 대 setData 1회)와 크롬 실증으로 잡았다.
  - Rule: **부분만 다시 만들면 안 된다.** 어떤 자원을 재생성하면 그 자원에 기대는 모든 효과가 함께 다시 돌아야 한다. deps 하나만 바꾸는 수정은 그 조건을 만족하는지 확인하기 전에는 끝난 게 아니다
  - Rule: "색이 안 바뀐다"를 고치다 "아무것도 안 보인다"를 만들 수 있다. 고친 뒤 그 화면을 실제로 열어봤어야 했다 — 나는 팔레트 값만 확인하고 토글을 눌러보지 않았다
  - Context: 마운트 지점에서 `key={themeVersion}`으로 remount하도록 바꿨다. 훅 31개가 함께 다시 돌아 새 팔레트로 그린다. 대가는 토글 순간 줌·스크롤 초기화이며 지표 on/off는 localStorage라 살아남는다.
- Violation: 그 배선을 **아무 게이트도 지키지 않았다.** 감사가 테마 배선 전체(5개 파일의 import·훅·deps)를 삭제하고 돌렸을 때 10,484건이 전부 초록이었다. 모듈 스코프 스냅샷 제거 7곳을 전부 되돌려도 마찬가지였다.
  - Rule: 이 루프에서 네 번째다. **수정을 끝내기 전에 그 수정을 지우고 게이트를 돌린다.** 초록이면 보호되지 않은 것이다
  - Context: 두 층으로 넣었다 — `StockChart.test.tsx`가 `createChart`뿐 아니라 **`setData`가 다시 불렸는지**를 단언하고(그것만 봐야 백지 상태가 잡힌다), `chartThemeRemountGuard`가 실제 마운트 지점 4곳이 `key={themeVersion}`을 쓰는지 본다. 각각 기전을 무력화해 실제로 깨지는 것을 확인했다.
- Violation: **최적화 대상 집합을 잘못 잡아 결함을 만들었다.** 라이트 팔레트의 색 분리를 최적화할 때 가격 pane 키를 13개로 잡고 MA 3종(period5·120·200)을 빠뜨렸다. 그 셋은 이미 3:1을 넘어 "손댈 필요 없다"고 판단했는데, **분리 문제는 대비 문제와 다른 집합**이다. 감사가 가드의 키 목록 누락으로 지적했고, 넣어 재보니 라이트 최소 ΔE가 4.71(period120 vs actionEntry, 파랑 둘)로 다크 6.89보다 나빴다.
  - Rule: "이 값은 기준을 넘으니 대상이 아니다"는 **그 기준에 대해서만** 참이다. 다른 불변식의 대상 집합을 같은 논리로 줄이면 안 된다
  - Context: 16키 전체로 다시 최적화해 라이트 최소 ΔE 18.62를 얻었다(period5·120·200에 라이트 변형 추가, vwap 조정). 가드의 다크 기준선도 실제 값 6.89로 고쳤다 — 8.5는 좁은 집합에서 나온 수였다.
- Violation: 가드 문서가 **실제보다 강한 보증**을 약속했다. `sourceScanParity`가 "독립적으로 구현된 파서를 정답지로 둔다"고 적었지만 정답지와 피검사 스캐너가 같은 `@babel/parser`다. babel 자신의 오파싱은 원리적으로 못 잡는다.
  - Rule: 문서가 과장하면 다음 사람이 그만큼 덜 본다. 보증 범위를 좁게, 정확히 적는다
- Context: 가드 사각지대 하나를 닫았다 — `className={cn(..., CONST[x])}`처럼 상수로 들어오는 `bg-` 알파를 못 봤고, 그 안에 실제 프로덕션 막대가 있었다. self-closing 도형 태그의 className에 등장한 식별자를 모아 그 상수의 초기화식까지 훑게 했다. `/20`으로 바꿔 1.27:1로 잡히는 것을 확인했다.
- Context: 프로덕션 소비처가 없는 `trendlineDirectionColor`를 지웠다(테스트만 부르고 있었다). `@source not`은 `__tests__/` 디렉터리만 막아 `src/__integration__/`이 남았으므로 `*.test.*` 패턴을 함께 넣었다 — 규칙을 한 철자로만 막으면 나머지가 남는다는 것을 또 확인했다.

## [R14 접근성 감사 + 블로커 수정 실증 | redesign-p1 | 2026-08-26]
- 결과: **이 브랜치가 새로 만든 접근성 결함 0건.** major 3건은 전부 master에서 동일 수치로 재현되는 선재 결함이었다(1.37 / 1.81 / 동일 클래스 충돌). 14라우트 × 양 테마에서 글자 대비 실패 0, 헤딩 스킵 0, 이름 없는 포커스 대상 0, 탭 타깃 위반 0(20px 링크는 전부 간격 예외 충족).
- Context(선재이지만 고침): WCAG AA+가 이 작업의 명시 제약이라 넷을 고쳤다 — 인증 폼 포커스 링의 `/40` 알파 제거(1.78→통과), `.focus-glow`가 `@layer` 밖이라 Tailwind의 ring을 통째로 이기던 것(1.32:1, 글로우만 남음)을 ring과 함께 그리도록, 달력 오늘 셀의 선택 표시와 포커스 표시가 같은 값이라 포커스가 아예 안 보이던 것에 `ring-offset` 추가, 백테스팅 월 구분을 `<h2>`로(41,000자 페이지에 h1 하나뿐이었다).
  - skip link는 헤더 뒤에 있어 절약 탭 수가 0인데, 앞으로 옮기려면 레이아웃이 공용 대상 id를 갖고 각 페이지 `<main>`이 그걸 받아야 해 범위 밖으로 뒀다. 대신 `tabIndex={-1}`을 대상에 붙여 **링크가 적어둔 일은 실제로 하게** 했다(그전에는 해시만 바뀌고 포커스는 body에 남았다).
- Context(감사 자신의 계측 함정 6종): 백그라운드 탭이 트랜지션을 t=0에 얼려 포커스 링이 "없음"으로 읽히고, 네비게이션이 키보드 모달리티를 리셋해 145개 전부가 실패로 나오고, 진입 페이드가 `opacity:0`에 멈춰 인증 카드가 대비 스캔에서 통째로 빠지고, 자기가 포커스한 요소를 "변화 없음"으로 읽고, 라이브 `CSSStyleDeclaration`을 재읽어 before/after가 같아지고, 다른 에이전트가 창 포커스를 뺏어 키 입력이 죽었다. 전부 스스로 잡아 정정했다 — 안 잡았으면 가짜 결함 150건이었다.
  - Rule: 접근성 측정은 **모달리티·애니메이션·가시성 상태에 전부 의존**한다. 측정값이 "전부 실패"로 나오면 제품이 아니라 그 세 가지를 먼저 본다
- 블로커 수정 실증(지표 켠 상태): `/AAPL`에서 MA 5·20·60·120·200을 켜고 테마를 토글했다. 수정 전에는 토글 후 가격 pane이 색 구간 1개(전부 흰색 58,670px)로 백지였는데, 수정 후에는 **색 구간 4 → 34**로 늘고 캔들(`2,10,9`×5,446 / `14,5,5`×4,669)과 이동평균선(`14,11,0`, `2,12,5` 등)이 새 팔레트로 다시 그려졌다. 캔버스 14개·차트 루트 2개로 변동 없음(고아 캔버스 없음).
  - 이 경로가 중요한 이유: 팔레트에서 바꾼 76개 값 중 대부분이 **지표를 켜야 보이는 색**이고, period5·120·200은 이번 라운드에 새로 라이트 변형을 넣은 값이다. 기본 화면만 봤다면 고친 것의 대부분을 확인하지 않은 셈이 된다.

## [배포 전 5종 감사 R15 — 코드·테스트 | redesign-p1 | 2026-08-26]
- 결과: 가드 10종 전부 뮤테이션으로 검출 확인, 스냅샷 사냥 깨끗, remount 안전성 실증(React가 옛 서브트리 passive cleanup을 새 마운트 전에 실행 → `chartRef`가 새 차트로 정착, 옛 차트는 구독 해제). findings 6건 전부 minor.
- Violation: **폐기한 설계를 문서 4곳이 아직 지침으로 적고 있었다.** `useThemeVersion.ts:14`가 "이 값을 차트 생성 효과의 deps에 넣으면 된다"고 안내하는데, 그게 정확히 차트를 영구히 백지로 만든 방법이다. `useChartThemeSync.ts`와 `StockChart.tsx` 두 곳은 "리마운트 금지"라고 적고 있었다 — 지금은 리마운트가 규약이다.
  - Rule: 설계를 바꾸면 **그 설계를 설명하던 주석을 같은 커밋에서 고친다.** 가드는 `key` 제거는 잡지만 옛 주석대로 deps를 **추가**하는 건 못 잡는다 — 문서가 사람을 결함으로 안내한다
  - Rule: 이 루프에서 "문서가 강제되는 규칙과 모순" 유형이 세 번째다(DESIGN.md의 `text-chart-*`, `sourceScanParity`의 과장된 보증, 이번 건)
- Context: `useChartThemeSync`를 제거했다. remount가 그 일(크롬 applyOptions)을 포함해 더 많이 하므로 죽은 경로였고, 테스트 파일도 없었다. 호출 4곳과 훅 파일을 지웠다 — 생성 시점에 `getChartChrome()`으로 이미 테마별 크롬을 세팅하므로 동작 변화 없음.
- Context: `period200`의 라이트 오버라이드를 제거했다. 감사가 지적한 대로 **없는 편이 대비가 더 좋고**(3.72 대 3.50) 분리도 기준을 크게 넘는다(17.47 > 6.9). 방어하는 것이 없는 값이었다.
- Violation: 접근성 수정 4건과 헤딩 승격이 **전부 보호 없이** 들어가 있었다. 감사가 다섯을 동시에 되돌리고 전체 스위트를 돌렸을 때 10,486건이 비트 단위로 동일했다.
  - Context: 셋은 CSS 캐스케이드 속성이라 jsdom이 원리적으로 못 본다. `focusIndicatorGuard`를 만들어 소스에서 붙들었다 — `.focus-glow`에 링 레이어가 있는지, 인증 폼 포커스 링이 **합성 후** 3:1을 넘는지(토큰 값이 아니라 실측), 달력의 선택 표시와 포커스 표시가 갈리는지, 건너뛰기 대상에 `tabIndex={-1}`이 있는지. 넷 다 되돌려 실제로 잡히는 것을 확인했다(`/40` 알파는 1.62:1로 나왔다).
  - 백테스팅 헤딩은 `getByText`로는 태그를 되돌려도 통과하므로 **역할(role)**로 단언했다.
- Rule(새로): "유닛 테스트로 못 보는 수정"은 **보호를 포기할 이유가 아니라 다른 층을 쓸 이유**다. 캐스케이드·번들·렌더 산출물은 소스 가드나 산출물 검사로 붙들 수 있다.

## [차트 범례·패널 기하 3종 수정 | redesign-p1 | 2026-08-26]
- 배경: 지표 오버레이 감사가 모바일(500px)에서 세 결함을 보고했다 — 범례가 차트 전체(266×492)를 덮어 서브패널 라벨을 가림, 범례에 배경판이 없어 대비가 1.14:1까지 붕괴, 86px 가격 패널에서 MA·EMA·KC Middle이 0px인데 범례는 값을 표시. 셋 다 선재였지만 사용자가 범위 안으로 넣었다.
- Violation(감사의 인과 주장): **"z-order 때문"이 틀렸다.** 라이브러리 소스(lightweight-charts 5.2.0)를 직접 읽어 확인한 진짜 원인은 **pane stretch 분배**다. `ChartWidget._adjustSizeImpl`이 `stretchFactor * (전체/합)`로만 나누고 하한은 2px이며(`MIN_PANE_HEIGHT`=30은 구분선 드래그 경로 전용), 가격 pane은 생성 시 stretch 2·추가 pane은 1이라 몫이 `2/(2+N)`이다 — N=3이면 40%, 246px 차트에서 ~87px로 감사 실측 86px와 일치한다. 이 레포는 `setStretchFactor`를 한 번도 부른 적이 없었다.
  - Rule: 감사가 붙인 **원인**은 관측이 아니라 추정일 수 있다. 고치기 전에 그 인과를 소스나 실험으로 따로 세운다 — 틀린 원인을 고치면 증상만 옮겨간다
- Context: "0px"도 대체로 **측정 아티팩트**였다. `walkLine`이 반올림·하프픽셀 보정 없이 그려서, 같은 가격 범위를 218px에서 86px로 압축하면 이동평균선의 기울기가 1px/px 아래로 떨어져 **완전히 칠해진 픽셀이 안 생긴다** — 안티에일리어싱된 선은 그려지는데 정확한 RGB를 세는 프로브가 0을 반환한다. 감사 자신의 데이터가 이를 뒷받침한다(가장 평평한 MA(200)이 218px에서도 613으로 최저). 사용자 눈에 보이는 증상과 해법은 같다.
- 수정: (1) `usePricePaneStretch`가 가격 pane의 stretch를 `max(2, 서브패널수)`로 올려 **최소 절반**을 보장한다. N ≤ 2에서는 기본값이 더 커서 기존 배치가 바이트 동일(회귀 없음). (2) `overlayLegendLayout`이 DOM을 재지 않고 산술로 줄을 채우고, 가격 pane에 들어가는 줄까지만 자른 뒤 남은 수를 `+N` 칩으로 **명시한다** — 조용히 숨기지 않는다. 폭 상수는 전부 넉넉한 쪽으로 잡아 오차 방향을 "여백이 남음"으로 고정했고, `overflow-hidden` + `maxHeight`가 백스톱이다. (3) 범례에 **불투명** `bg-secondary-900` 배경판. 알파를 쓰지 않은 것은 의도다 — 알파면 대비가 다시 뒤에 그려진 것에 좌우된다.
  - Rule: 잘라야 한다면 **잘렸다는 사실이 보여야** 한다. "보이는 것이 사라지면 안 된다"는 제약은 클리핑에도 적용된다
- 검증: 여섯 뮤테이션(stretch 호출 제거, 줄 자르기 무력화, 폭 무한대, `+N` 칩 제거, `overflow-hidden`+`maxHeight` 제거, 배경판 제거) 전부 red. 게이트: typecheck 0 · lint 0 · 1,119 파일 / 10,525 테스트.
- 남은 것(별도 결함으로 분리): **밴드 오버레이의 불투명 차폐**. Bollinger·Keltner·Donchian이 하단 밴드부터 pane 바닥까지 차트 배경색 `AreaSeries`로 덮고, MA·EMA가 먼저 생성돼 그 아래 깔린다. 하단 밴드 밑에 있는 이동평균(하락장의 MA200 등)은 **어느 높이에서든 영구히** 지워진다. 이건 높이와 무관해 이번 증상의 원인이 아니고, 고치려면 오버레이 훅 10개에 걸친 `setSeriesOrder` 조율이 필요하다.
- Violation(내 실수, 빌드 감사가 잡음): `@source not '*.test.*'`를 넣으며 "`src/__integration__/`에서 두 클래스가 샜다"고 적었는데 사실이 아니었다. `.filter`·`.transition`은 `.filter(Boolean)` 같은 **평범한 코드**와 주석 속 낱말에서 나오며 어떤 경로 제외로도 안 없어진다. 주석을 사실대로 고쳤다.
  - Rule: 규칙을 넣을 때 **그 규칙이 실제로 무엇을 없앴는지** 산출물에서 확인하고 적는다. 의도를 원인으로 적으면 다음 사람이 잘못된 곳을 고친다
