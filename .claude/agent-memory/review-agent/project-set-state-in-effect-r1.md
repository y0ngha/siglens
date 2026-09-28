---
name: project-set-state-in-effect-r1
description: fix/set-state-in-effect R1 (worktree siglens-effects) — 6 react/set-state-in-effect sites refactored; source correct, but load-bearing guards unpinned (firedNavRef, explicitTab precedence, server snapshots); useEffectEvent does NOT escape the oxlint 1.79 rule
metadata:
  type: project
---

R1 changes_requested (2026-09-24). Branch HEAD was behind origin/master (node24/yahoo4 merge), so
`git diff origin/master` listed 17 unrelated files — review scope was `git diff HEAD` + untracked useTheme.test.ts.

Mutation run in scratch copy (rsync src/messages/e2e/configs, symlink node_modules, `./node_modules/.bin/vitest run`):
survivors across the whole related suite (259 tests) — removing useAutocomplete `firedNavRef` guard,
cancel-on-type `setIsSubmitArmed(false)`, render-time local reset block, useBacktestFilter `explicitTab ?? urlTab`
order swap, and both `getServerSnapshot` → client-snapshot swaps. Killed: SearchOverlay submitTick dep,
SO cancel-on-type, useTheme unsaved/emit, both pathname render-time adjustments.

Why firedNavRef matters: pendingNav is never cleared; effect deps include onSelect (HoldingForm passes inline
`entry => setSymbol(...)`) and toLocalePath (changes on locale switch) → without guard, stale target re-fires.

Lint fact: under oxlint 1.79 `react/set-state-in-effect` traces setState through `useEffectEvent` calls
(probe: HEAD useAutocomplete with setState moved into runSubmit still errors at the `runSubmit()` line).
MISTAKES.md #10 still says useEffectEvent escapes — stale.

**How to apply:** on R2, check the probes' shape landed (inline onSelect + rerender → called once; arm-while-unsettled
→ settle → push once + query ''; type-after-arm → no push) and re-run the survivor mutations.
