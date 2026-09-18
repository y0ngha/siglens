---
name: prompt-numeric-audit-r3-closed
description: siglens-core fix/prompt-numeric-audit R3 — APPROVED, closes loop on formatSignedPercent near-zero test
metadata:
  type: project
---

R2's sole recommended finding (formatSignedPercent has no test for a near-zero
negative input like -0.001 that rounds to zero through formatNullableNumber's
sign-stripping) was fixed by adding one test asserting
`formatSignedPercent(-0.001) === '+0.00%'`.

Verified live: traced the composition
(`formatNullableNumber(-0.001)` → `toFixed(2)` = `"-0.00"` → `Number(...) === 0`
strips the `-` → `"0.00"` → `formatSignedPercent` sees no leading `-`, prefixes
`+` → `"+0.00%"`) against the actual source in
`src/domain/analysis/promptFormat.ts` (lines 77-97), then ran
`yarn vitest run src/__tests__/domain/analysis/promptFormat.test.ts` — 45/45
pass. Test placement matches the file's existing flat `describe → it`
convention (no nested context describe used anywhere else in this file, so
not a violation).

Only `promptFormat.test.ts` was in `modified_files` for R3 — the many other
`M` files in `git status` are leftover from earlier rounds' fixes, not new
scope for this round.

No findings. Loop closed at R3.
