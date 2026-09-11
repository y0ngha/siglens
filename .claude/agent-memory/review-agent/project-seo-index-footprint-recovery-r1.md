---
name: project-seo-index-footprint-recovery-r1
description: seo/index-footprint-recovery R1 — /position noindex revert + sitemap removal; caught 2 stale docs describing the exact PR #791 mistake being undone
metadata:
  type: project
---

R1 of `seo/index-footprint-recovery` (reverts 2026-08-19 index flip + PR #791 sitemap addition for
`/[symbol]/position`, per new `docs/architecture/SEO_RECOVERY_2026_09.md`).

Verified correct:
- `NOINDEX_SYMBOL_METADATA` spread LAST in page.tsx generateMetadata (overrides robots/canonical) —
  matches `noindexSymbolMetadata()`'s own spread-order contract in shared/lib/seo.ts exactly.
- No unused imports in page.tsx after the change.
- Both sitemap builders (`buildPopularEntries.ts`, `buildCryptoPopularEntries.ts`) cleanly drop the
  `/position` entry; tests are non-tautological (`.not.toContain('/BTCUSD/position')`, exact length
  pins `* 7` / `* 4` recomputed independently from axis count, matches removal).
- page.test.ts has no leftover `toBeUndefined()`/index-true assertions; explicitly guards against the
  2026-08-19 decision quietly coming back (comment says so).

Found (required): `docs/architecture/SITEMAP_SCOPE.md` §3-3 ("탭 축 누락 — `/position`", 2026-09-10) is
now stale — it documents PR #791's rationale as an unresolved invariant violation ("position lacks the
noindex/sitemap-exclusion pairing other axes have — this is a bug, fixed by adding it"). Left as-is, a
future reader/auditor will read this section as still-live guidance and re-add `/position` to the
sitemap, recreating the exact regression this PR undoes. Needs an appended 2026-09-11 reversal note.

Found (recommended): `e2e/specs/crypto-symbol.spec.ts` ~L114 comment lists sitemap-crypto.xml as
carrying "`/`,`/overall`,`/news`,`/fear-greed`,`/position`" — now false, `/position` was just removed
from `buildCryptoPopularEntries`. Test assertions themselves are unaffected (this route doesn't test
sitemap content), but the comment misdescribes current sitemap composition.

Method note: `docs/architecture/SEO_RECOVERY_2026_09.md` §6 claims "sitemap-popular 3,433 → 3,031"
(diff 402) but `POPULAR_TICKERS.length` is exactly 400 (verified via awk array-slice count) and
`sitemap-popular.xml` only ever calls `buildPopularEntries` (grep'd `api/sitemap/popular/route.ts`) —
position was unconditional per-ticker (memory: project-fix-position-sitemap-r1), so the diff should be
exactly 400, not 402. Didn't flag as a finding — it's a self-reported production measurement claim, not
independently falsifiable from the code, and off-by-2 out of 400 is plausible production drift. Worth a
quick sanity check in a later round if the author re-touches that doc.
