---
name: shared-predicate-drift-display-name
description: siglens ticker.ts buildDisplayName had a residual branch that bypassed the shared shouldShowEnglishName predicate — check ALL branches route through a shared predicate, not just some
metadata:
  type: reference
---

`src/entities/ticker/lib/ticker.ts` extracted `shouldShowEnglishName(name, koreanName, ticker)`
as the single source of truth for "should the English company name be shown alongside the
ticker" (used by both `buildDisplayName` for SEO/meta strings and `SymbolLayoutHeader`'s
`hasCompanyName` for the visible header). The JSDoc on `shouldShowEnglishName` explicitly says
this was extracted *because* the two consumers had copy-pasted the rule and drifted once
already.

Despite that, `buildDisplayName`'s `if (koreanName)` branch called `shouldShowEnglishName`, but
its `else` (no-`koreanName`) branch still had its own ad-hoc `name !== '' && name !== ticker`
check — missing the `!isKrEquitySymbol(ticker)` guard the shared predicate applies. This only
manifests for KR-equity symbols whose `koreanName` translation hasn't landed yet (a real,
temporary state per `AssetInfo.koreanName` JSDoc — e.g. freshly-listed tickers), where
`buildDisplayName` would show the English name but the visible header would not.

**Lesson: when a shared predicate is extracted to fix a drift bug, grep every branch of every
consumer that computes the same boolean — not just the branch that was already refactored.**
A partial refactor (one branch delegates, a sibling branch doesn't) recreates the exact bug the
extraction was meant to prevent, and it's easy to miss because the "fixed" branch reads
correct in isolation.

Fix applied: hoist `const showEnglishName = shouldShowEnglishName(name, koreanName, ticker)`
once, use it in both the `koreanName`-present and `koreanName`-absent branches. This required
updating `src/entities/ticker/__tests__/lib/ticker.test.ts`'s
`한글명이 없으면 종전대로 영문명을 쓴다` test, which had locked in the buggy behavior as its
expected value — the pre-existing test itself was the artifact of the bug, not a design
decision to preserve.
