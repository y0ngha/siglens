---
name: project-set-state-in-effect-r2
description: fix/set-state-in-effect R2 — all R1 survivor mutations now killed (re-run in scratch copy); only nits left (test name overclaims toLocalePath change, MISTAKES #10 ref-vs-state bullet contradicts its own example)
metadata:
  type: project
---

R2 changes_requested with recommended only (2026-09-24). Re-ran R1 survivors in scratch copy
(rsync worktree minus node_modules/.next/.git, symlink node_modules, `./node_modules/.bin/vitest run <file>`,
python replace-with-count-assert helper): firedNavRef, cancel-on-type, render-time reset, normalizeLabel (both
the effect call and the helper's trim), precedence swap, both getServerSnapshot swaps — all KILLED.

`renderHook(..., { hydrate: true })` + push each render's value into an array is a working way to pin
getServerSnapshot (seen[0] = server value). Empty container hydrates cleanly since renderHook renders null.

Survivors left: `canResolveSubmit` clauses (`isSettled`, `!isSearching`) individually removable — both tests set
stale+searching together. Pre-existing at HEAD (old effect had same combined test) → not flagged as new.

Nits: "…onSelect/toLocalePath 정체성이 바뀌어도" test never changes localeState.locale; MISTAKES #10 bullet says
"submit was requested" → useRef, but ✅ example (and useAutocomplete) keep isSubmitArmed in useState while
SearchOverlay uses pendingSubmitRef+submitTick — both patterns shipped in same PR.

**How to apply:** R3 should be doc/test-name only; approve if those are addressed or reasonably skipped.
