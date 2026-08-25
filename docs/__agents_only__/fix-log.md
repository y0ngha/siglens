
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
