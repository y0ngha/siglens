---
name: redesign-p1-toggle-contrast-r7-closed
description: ReasoningToggle border-control contrast R7 — APPROVED, closes loop. R6's NaN vacuous-pass hole confirmed fixed via live mutation.
metadata:
  type: project
---

R7 was a narrow confirmation round scoped to a single file:
`src/__tests__/guards/controlBorderContrast.test.ts`. R6's one recommended finding —
`relativeLuminance()` special-cased 3-digit hex but never validated length afterward, so a
4/8-digit alpha hex would silently produce `NaN` and vanish from `failures` — was fixed by
throwing on any hex whose stripped length isn't 3 or 6.

Verified live:
- `grep`'d all 129 `--color-*` tokens in globals.css: 128 are 6-digit, 1 is 3-digit (`#fff`) —
  nothing currently triggers the new throw.
- All hardcoded hex literals in the file's own sanity test (`#ffffff`, `#000000`, `#7d838f`,
  `#eff0f3`, `#878e9a`, `#e6e8ec`) plus the `WHITE` constant used in the toggle-state test are
  6-digit — no currently-valid path throws.
- `tokenValues`'s capture regex intentionally accepts a wider range (`{3,8}`) than
  `relativeLuminance` now accepts (`3` or `6` only) — that mismatch is the fix's whole point: a
  future 4/5/7/8-digit token the regex captures now throws loudly inside `contrast()` (called
  directly in both `it` bodies, no try/catch anywhere) instead of being silently dropped.
- Live mutation: temporarily set `--color-border-control: #7d838f80` in globals.css → 2/18 tests
  failed with `지원하지 않는 hex 형식: #7d838f80 (3·6자리만)` exactly as claimed → reverted →
  `diff` against a pre-edit backup confirmed byte-identical restore, and `yarn test` returned to
  18/18.
- Gates re-run directly (not trusted from round summary): `yarn typecheck` exit 0,
  `yarn lint src/__tests__/guards` exit 0 / 0 warnings, `yarn test --run src/__tests__/guards`
  18/18.

No new findings. This closes the loop for [[project-redesign-p1-toggle-contrast-r6]] — rounds 1-6
findings across globals.css, controlBorderTokenGuard.test.ts, AnalysisPanel.tsx, and the four Link
controls were already confirmed fixed as of R5/R6.
