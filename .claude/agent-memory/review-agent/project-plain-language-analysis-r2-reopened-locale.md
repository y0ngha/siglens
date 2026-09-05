---
name: plain-language-analysis-r2-reopened-locale
description: feat/plain-language-analysis reopened after R3-closed (see [[plain-language-analysis-r3-closed]]) for a locale/output-language follow-up; this round's R2 review, 3 recommended findings
metadata:
  type: project
---

Epic had previously closed at R3 ([[plain-language-analysis-r3-closed]]). Work
resumed in worktree `/Users/y0ngha/Project/siglens-plain` to add per-locale
output-language enforcement (`lib/outputLanguage.ts`) and remove the dead/broken
post-hoc translation layer (`withLocalizedProse` → `translateAnalysisForLocale`,
deleted `entities/analysis-translation/api.ts` + `lib/translateAnalysis.ts`).

**Scope-drift lesson**: the orchestrator's round-2 prompt listed 11 modified
files, but the live worktree diff had 15 files including 4 not mentioned at
all — `route.ts` (214 lines, removed the whole post-hoc translation layer and
wired `locale` into the `technical` axis's `runAnalysis` call for the first
time), `guardPlainText.ts` (104 lines, new per-locale script guard +
CJK sentence splitting + unit decomposition), `plainModel.ts` (thinking-mode
A/B doc only), and two new untracked files `outputLanguage.ts`/`.test.ts`.
Always diff the live worktree yourself (`git status` + `git diff HEAD
--stat`) rather than trusting the orchestrator's file list — the implementer
kept working after the prompt was drafted. Confirmed quiescent via `stat`
mtime (~1h45m before review) before trusting the diff as final.

Verified via live mutation: commenting out `locale: requestLocale,` in the
`runAnalysis` options object makes exactly 1 test fail
(`technical: 요청 로케일이 core까지 그대로 내려간다` in `route.test.ts`) —
confirms the new locale-threading test is real, not tautological. tsc clean,
full changed-file suite green (223 tests), restored file byte-identical
after mutation (stat-verified diff --stat unchanged).

**3 recommended findings** (all comment/dead-code hygiene, same class as this
round's own already-fixed RECOMMENDED 1/2, but incomplete sweep):
1. `applyProse`/`applyAt` in `entities/analysis-translation/lib/proseFields.ts`
   fully orphaned — sole consumer `translateAnalysis.ts` deleted this round,
   not re-exported from barrel, zero repo-wide references (grep-verified).
2. `proseFields.dispatch.test.ts` comment still names `withLocalizedProse` as
   "the route's early-return guard" — that function was split into
   `withLocalizedGateError`/`withPlainLanguage` this round; a reader grepping
   for the name finds nothing.
3. `entities/ticker/index.ts` barrel comment on `tryReadTranslatorConfig`
   claims "`analysis-translation`도 같은 설정을 쓴다" (also uses the same
   config) as the reason it's exported — false now, that consumer (`api.ts`)
   was deleted this round; export is still needed for `koreanTranslator.ts`
   but the stated reason is stale.

No required findings — all 4 R1-carried findings verified genuinely fixed
(rounding example/guard now agree, mutation-checked; 13 new guardPlainText.ts
locale/CJK/unit tests all present and non-tautological; dead translation
layer deletion + FSD barrel trim correct, no broken import direction).
