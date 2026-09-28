---
name: project-market-fear-greed-crypto-signdisplay-r2-closed
description: crypto-fear-greed-page R1 signDisplay bug closed in R2 via key/market-aware formatMarketFactorRaw
metadata:
  type: project
---

R1 found `formatMarketFactorRaw` hardcoded `signDisplay: 'always'`, misleading for crypto share
factors (`breadth`/`alt_season`/`volume_flow`, rawValue in [0,1]).

R2 fix: `formatMarketFactorRaw(rawValue, key, market)` — unsigned 2dp percent formatter for the
three crypto share keys, signed formatter otherwise (US/KR `breadth` stays signed — it's a return
spread, not a share). Caller (`MarketFearGreedFactorBar.tsx`) updated to pass `factor.key`/`market`.
Tests cover all three branches (crypto share unsigned, crypto distance signed, US/KR breadth signed).

**Why:** confirms the fix-then-verify loop closed cleanly on round 2 with no regressions.
**How to apply:** if a similar market/factor-key-conditional formatting bug appears elsewhere,
this is the reference pattern (small Set-based branch keyed by market+key, not a global flag).
