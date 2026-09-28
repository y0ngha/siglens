---
name: project-set-state-in-effect-r3
description: fix/set-state-in-effect R3 approved — locale-flip test mutation-verified (kills guard removal on its own), MISTAKES #10 ref-vs-state bullet now consistent with shipped code
metadata:
  type: project
---

R3 approved (2026-09-24). Both R2 nits closed.

Mutation check: stable `onSelect: spy`, dropped the plain rerender, removed the `firedNavRef` guard → the locale
flip alone still fails the test (spy called 2x). So the toLocalePath identity claim is now real.

Unflagged trivial nit: the test sets `hrefBase = '/en'` (real values are origins like `https://siglens.io`), so a
refire would go through `assignLocation`, not `mockPush`. Only the spy assertion catches it — still falsifiable.

MISTAKES #10 now says to choose by where the flag is consumed. Identifiers checked with grep: isSubmitArmed,
pendingSubmitRef + submitTick (SearchOverlay.tsx:114-115), firedNavRef.

**How to apply:** closes [[project-set-state-in-effect-r2]]; there should be no further rounds on this branch.
