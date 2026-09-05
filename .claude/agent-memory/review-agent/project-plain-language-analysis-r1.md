---
name: plain-language-analysis-r1
description: feat/plain-language-analysis R1 — envelope-prefix breaks dropSupersededPaths no-op, plus previousStateRef missing plain
metadata:
  type: project
---

R1 review of `feat/plain-language-analysis` (siglens-plain worktree). Adds a DeepSeek
rewrite pass ("쉽게보기") that turns already-filtered analysis JSON into plain prose,
served in parallel with `withLocalizedProse` in the SSE route.

## Critical: dropSupersededPaths is a no-op in production (live-verified)

`withPlainLanguage` in `route.ts` calls `rewriteToPlainLanguage(result, symbol, locale)`
with the **full action envelope** (`{ status, result, lockedInfoDepth }` —
core's `RunAnalysisResult` shape), not `result.result`. `extractProse` then produces
paths prefixed with `result.` (e.g. `result.actionRecommendation.exit`), but
`supersededPaths.ts`'s `SUPERSEDED_PATHS` Set and `MARKER_PREFIX` hardcode bare paths
(`'actionRecommendation.exit'`, `'actionRecommendation.reconciledLevels.'`). The
`entry.path.startsWith(MARKER_PREFIX)` check never matches, so `dropSupersededPaths`
always returns entries unchanged — both the original `actionRecommendation.exit` and
the superseding `reconciledLevels.exit` reach the prompt, reproducing exactly the
"다른 분석에서는 목표가를 334.01달러…" contradictory-price defect the code's own JSDoc
says it fixes.

Verified live by running the real `extractProse` + `dropSupersededPaths` against a
realistic envelope via `npx tsx` scratch script — both `exit` paths survived.

Why unit tests didn't catch it: `supersededPaths.test.ts` and `tierIsolation.test.ts`
both construct entries with **bare** paths (no `result.` wrapper), so they never
exercise the actual prefix the production call site produces. Classic case of
[[feedback-audit-enumerate-slice-not-difflist]] — the isolated unit is green, the
wiring is broken; only tracing the actual data shape through the call site catches it.

Fix direction (not implemented by review-agent — read-only): either unwrap to
`result.result` before calling `rewriteToPlainLanguage`, or make the path match
suffix-based instead of exact-prefix.

## previousStateRef drops `plain` on reanalyze_cooldown restore

`useAnalysis.ts`'s `previousStateRef` (snapshotted in `onMutate`, restored on
`status === 'reanalyze_cooldown'`) only carries `{ result, personalized }` — no
`plain`. `onMutate` clears `plain` to `null` unconditionally. When the server rejects
a reanalyze with cooldown, `analysisResult` is correctly restored to the previous
value but `plain` stays `null` forever, so `AnalysisPanel`'s toggle silently
disappears and the view falls back to raw — even though the user is looking at the
exact same analysis whose plain rewrite they had a moment ago. The dedicated test for
this restore path (`useAnalysisBranches.test.tsx` "쿨다운으로 거절돼도 보고 있던
분석을 잃지 않는다") only asserts on `analysis`, never `plain`, and happens to use a
fixture with no `plain` field, so the gap is untested.

## Non-issues verified during this review (don't re-flag)

- `withReaderViews`'s `work.then()` called twice (once inside `withLocalizedProse`,
  once directly) does NOT double-subscribe or double-invoke `work` — an already-settled/
  pending Promise supports multiple independent `.then()` listeners; this is standard.
- `Promise.race` in `withDeadline`/`withLocalizedProse` does not produce unhandled
  rejections on the losing promise — Node/V8 attach an internal handler to every
  operand of `Promise.race`, so a late-rejecting loser is not "unhandled" even though
  its result is discarded.
- `cache?.get(key).catch(...)` and `cache?.set(...).catch(...)` are safe when `cache`
  is `undefined` — optional chaining short-circuits the *entire* chained expression
  (including the trailing `.catch`), not just the `?.` step.
- Error-envelope short circuit is correctly preserved: `withPlainLanguage` checks
  `result.status === 'error'` before calling `rewriteToPlainLanguage`, so gate-rejection
  messages never get sent to the plain-language LLM (mirrors `withLocalizedProse`'s
  existing guard for the same reason).
- ReanalyzeButton and AdBanner in `AnalysisPanel.tsx` are correctly outside the
  `showPlain` conditional swap (confirmed by reading past the diff hunk's closing tags).
- FSD layer boundaries clean: `entities/analysis-plain` cross-imports
  `entities/analysis-translation` (entity-to-entity is an allowed exception),
  `@y0ngses-core`, and `shared/*` only; `widgets/analysis` new files only touch
  same-slice + shared. No deep imports.

## Recommended (not required)

`PlainAnalysisView`'s `hasLockedDetails` branch renders only a text notice
(`lockedNotice` i18n key), not the raw view's `<Link href="/signup">` CTA card. Since
`DEFAULT_ANALYSIS_VIEW = 'plain'`, most free users land here by default and lose the
inline signup CTA (still reachable one extra click away via the "원본보기" toggle
button, so not a hard regression — flagged as recommended only).

## Process note

This branch was **actively being edited by the implementer while under review** —
`src/entities/analysis-plain/lib/plainModel.ts` and a swap from `callDeepseekChat`/
`tryReadTranslatorConfig` to `callAiProviderRouter`/`tryReadPlainModelConfig` (+
`isE2E()` short-circuit) appeared mid-session, confirmed by mtimes ~30s before the
check and by polling `find -newer` until it stabilized (~1 min quiet window). Initial
read of `api.ts` was stale and briefly looked mismatched against `api.test.ts`'s mocks
(different import names) — re-reading after the edit settled resolved it. Reinforces
[[feedback-file-can-change-mid-review]]: poll for quiescence with `find -newer` in a
loop before finalizing findings on a live-worktree review.
