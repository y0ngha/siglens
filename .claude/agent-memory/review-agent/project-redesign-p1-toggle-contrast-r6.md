---
name: redesign-p1-toggle-contrast-r6
description: ReasoningToggle border-control contrast R6 — R5 fix math-verified correct; found latent NaN vacuous-pass hole in the guard's own hex parser
metadata:
  type: project
---

R6 independently recomputed all six R5 toggle states (dark/light × off/on/locked) from the actual
`globals.css` hex literals via a standalone node script — every value matched the round-5 write-up and
the CSS policy comment exactly (dark off 2.67/14.21, light off 3.10/1.23 tightest-in-system, etc.).
`SURFACE_TOKENS` ramp test (950/900/800) also reproduced exactly. `yarn typecheck` 0, `oxlint` on the
2 guard files 0 warnings/0 errors, `yarn test --run src/__tests__/guards` 18/18 (3+7+5+3 across the 4
guard files). Duplicate JSDoc above `ALLOWED_CONSTANTS` confirmed merged into one block.

Scrutiny outcomes (all "no finding"):
- The 3-state table (off/on/locked) is complete. `disabled=true` is correctly NOT a 4th state to
  measure — WCAG 1.4.11's text itself carries an "except for inactive components" carve-out, and
  `ReasoningToggle.tsx`'s own `aria-disabled`/native-`disabled` precedence means a genuinely disabled
  switch (opacity-60 and all) is the WCAG-exempt "inactive" case, while `locked` (canUse=false,
  disabled=false) stays interactive/non-exempt and is exactly what the toggle test measures.
- `Math.max(thumb-fill vs track, border vs track) >= 3` is a defensible reading of 1.4.11 — the SC
  requires "visual information required to identify" the component/state, not the border specifically;
  a switch whose thumb-fill alone clears 3:1 against its track is identifiable without the border.
- Alpha-composited/hover-derived surfaces elsewhere (`RelatedSymbols.tsx` chip `bg-secondary-900/60`,
  various `hover:bg-secondary-700/30`) are correctly out of scope for this static regression net — the
  test's own JSDoc explains this was deliberately dropped after false positives (toggle thumb, hover
  fills) and is instead covered by a live browser canvas-based contrast sweep. Not a round-6 gap.

One genuine (currently latent, not live) recommended finding: `relativeLuminance()` in
`controlBorderContrast.test.ts` only special-cases 3-digit hex (`h.length === 3`); a future 4/5/7/8-digit
hex literal in `globals.css` (e.g. an alpha-hex shorthand) would make `h.slice(i, i+2)` produce an empty
or malformed substring for one channel, `parseInt` returns `NaN`, `contrast()` returns `NaN`, and
`NaN < MIN_RATIO` is `false` in JS — so a real violation would silently vanish from `failures` instead of
throwing. Currently 128 of 129 color tokens are 6-digit and 1 is 3-digit (`#fff`), so nothing triggers it
today; grepped and confirmed via `grep -oE -- '--color-[a-zA-Z0-9-]+:\s*#[0-9a-fA-F]+' | length`. Fix:
assert hex length is 3 or 6 (throw otherwise) so malformed tokens fail loudly.
