---
name: seo-internal-links-relatedsymbols-r6
description: RelatedSymbols.tsx round 6 — APPROVED, closes loop. DSU rethrow verified, Suspense-wrap decline judged sound (rebuts R5's own assumption)
metadata:
  type: project
---

R6 closed the review loop on `src/views/symbol/RelatedSymbols.tsx`.

## Required finding from R5 — fixed, mutation-verified live

`resolveKoreanNames`'s catch now checks `isDynamicServerError(e)` (from
`@/shared/lib/isDynamicServerError`) and rethrows before falling through to the
degrade path — same pattern as `getAssetInfoResilient.ts` and
`getCongressTradesResilient.ts` (grepped, confirmed identical shape). New test
`DYNAMIC_SERVER_USAGE는 삼키지 않고 되던진다` pins it.

I independently re-verified by mutating the file live (deleted the
`if (isDynamicServerError(e)) throw e;` line), reran
`src/views/symbol/__tests__/RelatedSymbols.test.tsx` — exactly that one test
failed (promise resolved instead of rejecting), 8/9 others stayed green. Restored
the file, `diff` confirmed byte-identical, reran to confirm 9/9 green again.

## Recommended finding from R5 — declined by implementer, judged sound

R5 recommended wrapping `<RelatedSymbols>` as a `<Suspense fallback={null}>`
child to let the shell flush earlier on cold-gen, reasoning "Suspense boundaries
are fully resolved before ISR commits the cached HTML absent PPR... so the
cached artifact is unaffected."

Implementer declined, with a new JSDoc section arguing:
1. No measurable gain (warm render 0.20-0.26s, peer `assetInfo` reuses siblings'
   `unstable_cache` entries, only cold-gen pays anything).
2. Real loss: Suspense-child content streams to the END of raw HTML with a
   relocation `<script>`, even in the cached ISR artifact — evidenced by a
   same-day production measurement on `/market` (`<footer>` byte 26,177 <
   main-content byte 40,391). Googlebot executes JS so unaffected; Naver
   Yeti/Daumoa do not, so their internal links would land after the footer.

I judge this rebuttal technically sound, not a rationalization: React's
out-of-order streaming mechanism (shell first, then `<template>` placeholder +
later out-of-band chunk + swap script) is triggered by microtask-tick timing —
any real `await` inside an async Server Component resolves at least one tick
after the synchronous shell walk, so the placeholder/relocation structure gets
baked into the render output regardless of how fast the data actually arrives
or whether the final result is cached as static ISR HTML. R5's assumption
conflated "fully resolved before commit" (content is complete) with "placed in
normal document order" (content is inline) — these are different guarantees.
The cited `/market` production byte-offset evidence is consistent with this.

No further action — did not re-raise. This closes the R4→R6 loop on this file
with `status: approved`.

## Verification

- `tsc --noEmit`: exit 0.
- `oxlint` on both modified files: exit 0, no output.
- `RelatedSymbols.test.tsx`: 9/9 pass, independently reran (not just trusting
  implementer's summary numbers).

See also [[seo-internal-links-relatedsymbols-r5]] for the finding this round closes.
