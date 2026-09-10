---
name: project-fix-position-sitemap-r1
description: fix/sitemap-position-tab R1 — /position tab added to both sitemap builders, approved clean
metadata:
  type: project
---

R1 review of `fix/sitemap-position-tab`: added `/[symbol]/position` entry (priority 0.7, changeFrequency 'daily',
lastmod = same session-close/6h-boundary as sibling entries) to both `buildPopularEntries.ts` (stock) and
`buildCryptoPopularEntries.ts` (crypto). Verified live:

- `position` confirmed present in `tabs` array of all 3 market profiles (usEquity/krEquity/crypto) via grep —
  no per-asset-class guard needed, unlike congress/financials/options.
- Priority 0.7 is the lowest of all axes in both builders (below fundamental 0.75, fear-greed 0.78/0.72) —
  coherent with the "thin until user enters avg cost" justification in the comment.
- Test count arithmetic in buildPopularEntries.test.ts (`* 8 - krCount - nonStockCount + optionsCount`)
  re-derived independently from the 6 unconditional + 3 conditional axes — matches exactly.
- New tests are NOT tautological: `positionSymbols` assertion compares against full sorted `POPULAR_TICKERS`
  (would fail if position entry removed for any ticker, including KR), and count formula also depends on it.
- position page.tsx `revalidate = 43200` matches ISR_REVALIDATE.md doc claim (grep-verified).
- Searched repo for other hardcoded per-ticker/per-coin entry counts that could go stale — none found;
  `route.test.ts` `toHaveLength(3)` is sitemap-index sub-sitemap count (static/popular/crypto), unrelated axis.
- `yarn test --run src/entities/sitemap-entry` — 84/84 passed live at review time.

Zero findings. Approved R1.
