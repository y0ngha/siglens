---
name: core-overall-optional-news-axis-r4
description: siglens-core feat/overall-optional-news-axis R4 — approved; no_news becomes axis-abstain, p4 bump, two whole-prompt snapshot byte pins
metadata:
  type: project
---

`@y0ngha/siglens-core` branch `feat/overall-optional-news-axis` (~630 lines, 8 files) — **approved at round 4**.

Change: `runOverallAnalysis` treats `RunNewsAnalysisResult` `{status:'error', code:'no_news'}` as axis-abstain
instead of `{status:'error', axis:'news'}`; `buildOverallAnalysisPrompt`'s `news` param widened to
`NewsAnalysisResponse | null`; `OVERALL_PROMPT_TEMPLATE_VERSION` `p3` → `p4`.

**Why:** unblocks ~41 siglens symbols (leveraged ETFs, mutual funds, low-coverage OTC) that could never
produce an `overall`/`news` SEO snapshot while still eating prewarm batch slots.

**How to apply / patterns worth recalling:**
- The round-1..3 defect chain was all *documentation-vs-source drift*, not logic: a self-contradictory
  cache-version rationale, a JSDoc claim about where "leave the array empty" instructions live that the
  committed snapshot disproved, and a whole-prompt snapshot sitting in a `describe` naming a branch it
  did not exercise (snapshot key lied about the scenario). Check snapshot **keys** against the fixture
  the test actually passes.
- Section-scoped byte assertions cannot justify skipping a prompt-template version bump — the first
  draft here claimed exemption while two unconditional lines (Rules `newsBulletsKo`, `formatAxisScore`
  abstention example) had already changed every prompt. Whole-prompt pins are the only valid evidence.
- Snapshot determinism check that passed: no wall-clock dates (only a fixture literal `2025-07-30`),
  no absolute paths, no locale-sensitive formatting (`toFixed` only).
- Test file wraps the `{stable, dynamic}` return in a local flatten helper, so `toMatchSnapshot()`
  pins the exact string dispatch sends. Verify such wrappers before trusting a "whole prompt" claim.

Related: [[project-core-precomputed-prompt-data-r6]], [[feedback-cross-repo-resolution-claims-need-consumer-check]]
