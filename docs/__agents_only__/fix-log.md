
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

- Violation: Colour tokens validated at one alpha tint (e.g., /10–/20) are not re-validated when a new consumer uses a deeper tint. `FearGreedHeaderChip`'s EXTREME tiers use `/40` tints where they measured 4.35 (success) and 3.89 (danger) in light theme, under the AA 4.5 minimum. The globals.css comment on `ui-*-text` tokens literally says "passes ≥6.9:1 on success/10" — validation was only at /10 depth. No existing consumer at /40 had been measured.
  - Rule: (new) Colour token validation — Semantic tokens validated at one alpha/tint are not validated at every alpha/tint. Record which tint depths were checked (e.g., "ui-success-text: validated at /10–/20 in light+dark"). Re-validate when a new consumer uses a shallower or deeper tint; darker tints (higher /number) require re-measurement as luminance ratios shift.
  - Context: Darkened both tokens (#0a5b52→#0a574e, #a02420→#8c201c) so /40 now reaches 4.60+. All shallower tints (/10–/30) improved accordingly (no regression). Measurement was on actual components rendered in both themes; validation applies to new consumers at any tint depth.

- Violation: Expiration chips separated selected/unselected by hue only (blue vs neutral) with three colour-dependent cues (border, fill, text luminance deltas 2.03/1.17/1.14). While each cue individually passed WCAG contrast, the separation failed for colour-blind users — they perceive only brightness differences, which were below threshold for some cues.
  - Rule: (new) Colour-blind accessibility — A state indicator that separates only by hue fails for colour-blind users even when every individual cue passes contrast (WCAG 1.4.3). Independent cues (weight, shape, icon, border-style, pattern) must complement colour to ensure deuteranopia/protanopia distinction.
  - Context: Added font-semibold weight cue independent of hue. Border colour + weight + text weight now provide three independent signals.

- Violation: Turbopack served stale CSS for `globals.css` custom-property edits. File was correct on disk, `git diff` showed the change, tsc/oxlint passed, but `getComputedStyle(documentElement).getPropertyValue('--color-ui-success-text')` returned OLD value. `curl` of the served chunk returned OLD hash; `touch` did not help. Only `yarn clear:build` + dev restart picked it up. Earlier edits to the same file in the same session HAD recompiled (CSS syntax error took server to 500), so not always broken — goes stale at some point.
  - Rule: (new) Dev environment build cache — After editing a CSS token in globals.css or other hot-reload files, assert the token's OWN computed value BEFORE measuring anything downstream. Without that guard the conclusion becomes "the component fix didn't work", and the hunt goes into perfectly good component code. Symptoms: git diff correct, build passes, but runtime value stale.
  - Context: Added guard in audit script: read each token's computed value from documentElement before any measurements. If token value is stale, clear build cache and restart dev server before re-running audit. Caching issue is intermittent; may correlate with timing of stylesheet load vs property-value registration.
