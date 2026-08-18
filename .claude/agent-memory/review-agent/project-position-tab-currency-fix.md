---
name: position-tab-currency-fix
description: audit/fix-currency branch — currencyForSymbol threading into portfolio-position/portfolio-holding surfaces; found pre-existing sub-$1 crypto "$0" bug in PositionCard/PositionCta
metadata:
  type: project
---

Branch `audit/fix-currency` threaded `currencyForSymbol`/`getDescriptor(...).priceFormat` into
5 call sites (`positionBuildingNotes.ts`, `PositionCard.tsx`, `PositionCta.tsx`,
`PortfolioChip.tsx`, `app/portfolio/PositionHoldingCard.tsx`) plus `statementCurrencyOf`
(`widgets/financials/utils/numberFormat.ts`), replacing hardcoded `$` / hand-rolled
`isKrEquitySymbol ? 'KRW' : 'USD'` ternaries. `currencyForSymbol` itself (`shared/config/
marketProfile/registry.ts`) predates this branch (added in the prior release alongside
`formatCompactCurrency`/`FutureDirectionCard`/`EventCalendar`) — this branch only added new
consumers + widened its JSDoc consumer list.

Round-1 audit result: gates (`typecheck`/`lint`/`format`/451 scoped tests, exceeding the
claimed 317) all independently re-verified green. Mutation spot-checks on `PortfolioChip.tsx`
and `positionBuildingNotes.ts` (`formatCompactForSvgLabel`) confirmed the KR-currency tests are
falsifiable — each mutation failed exactly one test.

**Found (required):** `PositionCard.tsx` and `PositionCta.tsx` each hand-roll their own local
`formatAmount(value, symbol)` that omits the sub-$1 `dynamicDecimals` branch present in
`positionBuildingNotes.ts`'s exported `formatAmount` (and in `app/portfolio/
PositionHoldingCard.tsx`'s copy). Confirmed via ad-hoc render: `avg=0.0006` → `PositionCard`
renders `"$0"` instead of `"$0.0006"`. This is reachable in production: `CRYPTO_DESCRIPTOR.tabs`
includes `'position'`, `PositionTabMemberContent`/`PositionCard`/`PositionCta` have no
asset-class gate, and `validateHoldingInput.ts` (`PRICE_SCALE=8`, min `>0`) explicitly permits
sub-cent average prices — i.e. crypto holdings with a sub-$1 avg price are a supported input
that silently regresses to the exact "misleading $0" defect class this whole effort exists to
eliminate, in a file this branch directly touched.

**Root cause / recommended:** `formatAmount` is now independently duplicated across 4 files
(exceeds FF 4-B's "abstract after 3 repetitions" threshold) — `positionBuildingNotes.ts`
exports a canonical version but `PositionCard.tsx`/`PositionCta.tsx`/`PositionHoldingCard.tsx`
each redeclare their own instead of importing it. Two of the four have already silently
diverged (the bug above). Consolidating (e.g. re-exporting `formatAmount` from the
`widgets/portfolio-position` barrel and importing it everywhere) would have caught this by
construction — the same "scattered reimplementations silently diverge" argument the branch's
own `registry.ts` JSDoc makes about `currencyForSymbol` itself.

See also [[feedback-check-untracked-files]] — this branch is also where that procedural gap
was found (`PositionCta.test.tsx` was untracked, not in `git diff --name-only`).

**Round 2 (approved):** author deleted the 3 duplicate `formatAmount` copies; `PositionCard.tsx`/
`PositionCta.tsx` now import the canonical impl via same-slice relative path
(`'../lib/positionBuildingNotes'` — FSD slice-internal exception, not a barrel violation), and
`PositionHoldingCard.tsx` (app layer) via the `@/widgets/portfolio-position` barrel, which now
re-exports `formatAmount` alongside its other pure helpers. Verified independently rather than
trusting the report: rendered both sites with sub-$1 values (no more `"$0"`); mutation-tested by
deleting the shared `dynamicDecimals` branch — exactly 5 tests failed project-wide, matching the
author's claimed count exactly; re-derived the "byte-identical to origin/master's `formatUsd`/
`formatUsdCompactForSvgLabel`" claim by `git show origin/master:<path>` diff rather than trusting
the author's since-deleted scratch test — confirmed line-for-line for non-KRW paths; confirmed the
KRW guard is structurally safe (KR descriptor's `precision.kind === 'integer'` forces `formatPrice`
to 0 digits and returns *before* the `dynamicDecimals` branch is reached, so it can't regress
through that path even if the sub-$1 branch changes later). Consolidation did not flatten the
SVG-compact vs full-precision split — `formatCompactForSvgLabel` (untouched, SVG-only) still
delegates to `formatAmount`, never the reverse.
