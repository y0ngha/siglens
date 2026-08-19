---
name: prompt-region-context-r6
description: siglens-core feat/prompt-region-context — R6 approved; how the "assertion passes for the wrong reason" family of findings was closed (wrong-duplicate deletion, forward-scanning few-shot helper, vacuous not.toContain)
metadata:
  type: project
---

`@y0ngha/siglens-core` worktree `/Users/y0ngha/Project/siglens-core-region`, branch
`feat/prompt-region-context` (adds `region` to `EconomicEventAnalysisInput`, Korean
riskSentiment labels, volatility-null branch in `buildMarketBriefingPrompt`).
Rounds 3–5 all produced the same *class* of finding: **an assertion that stays green
after the production line it claims to pin is reverted.** R6 verified all three fixes.

Three closed traps worth reusing on any prompt-builder test review:

1. **De-duplicating tests: check which copy survives, not that one is gone.** R4 deleted a
   duplicate `it()` and kept the copy that lived under a *different* `describe` while
   building its prompt from a context the describe title contradicts (`KR_CONTEXT`,
   `volatility: null`, inside `describe('변동성 값이 온전하지 않을 때')`). Test names lie;
   read the context object each `it()` actually passes.
2. **Few-shot locator helpers must be strict, not searching.** `lines.slice(i+1).find(l =>
   l.startsWith('Output: '))` silently returns the *next* example's output when the target
   example's own output is deleted, resurrecting the always-true assertion the helper
   existed to kill. Correct form: read `lines[i + 1]` and throw unless it starts with
   `Output: `.
3. **`not.toContain` on a whole prompt is nearly always vacuous.** Scope it to the one line
   the claim is about (that example's `Output:` line), and confirm a sibling line *does*
   contain the token — otherwise the assertion can never fail.

**Why:** all three defects are green-suite defects; typecheck/lint/full-suite gates report
nothing. Only reading the assertion against the builder's branch structure catches them.

**How to apply:** for prompt/template test reviews, verify each new assertion twice — the
string exists in the branch under test, AND it is absent from the sibling branch. Runtime
proof without mutating the worktree: a scratchpad vitest config (plain default-export
object, no `vitest/config` import — that module won't resolve from outside the repo) with
`test.root` = worktree, `resolve.alias['@']` = `<worktree>/src`, and `include` pointing at
a scratchpad test file that imports builders by absolute path. Mutate the returned prompt
*string* in memory instead of editing files. See [[feedback-audit-enumerate-slice-not-difflist]].
