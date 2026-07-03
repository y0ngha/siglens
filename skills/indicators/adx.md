---
name: ADX Signal Guide
description: ADX 신호 해석 가이드 — 추세 강도 수준, 상승/하락 ADX, 시장 국면 식별
type: indicator_guide
indicators: ['dmi']
confidence_weight: 0.85
usage_roles: [confirmation, regime]
token_cost: 428
digest_hash: "261be0f6"
---

## Overview

ADX (Average Directional Index) is derived from DMI and measures the strength of a trend without regard to its direction. A rising ADX indicates a strengthening trend (in either direction); a falling ADX indicates a weakening trend. The scale runs from 0 to 100, though values above 60 are rare. The standard period is 14 bars.

## Signal Interpretation

### ADX Level Thresholds

- ADX 0–20: No meaningful trend — the market is in a ranging or consolidating phase. Trend-following strategies perform poorly; oscillator-based or mean-reversion strategies are more effective.
- ADX 20–25: Trend is beginning to form. Monitor for DI crossover confirmation before committing to a trend-following position.
- ADX 25–40: A clear trend is in progress. Trend-following strategies (momentum entries, pullback buys in uptrend) are appropriate.
- ADX 40–60: A strong, well-established trend is underway. Continuation signals from MACD or price structure carry high reliability.
- ADX > 60: Extreme trend strength. Momentum is intense but exhaustion risk is elevated — scale in carefully and watch for any reversal signals.

### ADX Slope (Rising vs. Falling)

- ADX rising: trend is strengthening — maintain or add to existing positions aligned with the trend direction (+DI or -DI dominance).
- ADX declining from a peak: trend momentum is weakening even if direction has not reversed — reduce position size or tighten stops.
- ADX flattening near 20–25: trend may be transitioning to a range — prepare for a shift in strategy.

### ADX Peak and Reversal

- ADX peaks and turns down sharply: the primary trend is losing force. This does not mean a reversal has occurred, but it signals that trend extension trades carry higher risk.
- A second ADX peak lower than the first, while price continues in the same direction: bearish momentum divergence in the trend strength itself — early warning of trend exhaustion.

## Key Combinations

- ADX + DMI (+DI/-DI): ADX identifies trend strength; +DI/-DI identifies direction. Always use both together.
- ADX + EMA(50): When ADX > 25 and price is above EMA(50), a bullish trend has structural confirmation across both momentum and moving average.
- ADX + RSI: When ADX > 25 and RSI is in the overbought zone, the context shifts — overbought in a trending market signals continuation, not reversal.
- ADX + MACD: In low ADX environments (< 20), MACD crossovers are noisy. In high ADX environments (> 25), MACD crossovers are more reliable.

## Caveats

- ADX does not indicate direction — a high ADX reading alone does not tell you if the trend is up or down.
- ADX is computed from Wilder-smoothed directional movement (Wilder smoothing uses `α = 1/N`, distinct from the standard EMA weight `α = 2/(N+1)`), so it lags the actual trend onset by several bars.
- Using ADX < 20 as a filter to suppress trend-following signals significantly reduces false entries in choppy markets.
- ADX above 60 is rare and often precedes a violent reversal or consolidation phase — approach with caution.

<!-- PROMPT_DIGEST:START -->
### ADX Signal Guide
- Measures trend STRENGTH only, not direction (scale 0–100, >60 rare; period 14).

Level bands:
- 0–20: no meaningful trend / ranging — trend-following poor; use oscillator/mean-reversion.
- 20–25: trend forming — wait for DI crossover confirmation before committing.
- 25–40: clear trend in progress — trend-following (momentum entries, pullback buys) appropriate.
- 40–60: strong established trend — MACD/price-structure continuation signals highly reliable.
- >60: extreme strength; exhaustion risk elevated — scale in carefully, watch for reversal signals.

Slope (rising vs falling):
- Rising: strengthening — maintain/add positions aligned with +DI or -DI dominance.
- Declining from a peak: momentum weakening even if direction not reversed — reduce size / tighten stops.
- Flattening near 20–25: may be transitioning to a range.

Peak/reversal:
- Peaks and turns down sharply: primary trend losing force (not a reversal) — extension trades carry higher risk.
- Second ADX peak lower than the first while price continues same direction = bearish trend-strength divergence, early exhaustion warning.

Combinations:
- ADX + DMI(+DI/-DI): ADX=strength, DIs=direction — always use both together.
- ADX>25 & price above EMA(50): bullish trend structurally confirmed across momentum and MA.
- ADX>25 & RSI overbought: overbought in a trending market = continuation, not reversal.
- ADX<20: MACD crossovers noisy; ADX>25: MACD crossovers more reliable.

Caveats: high ADX alone says nothing about up/down; Wilder-smoothed (α=1/N) so lags trend onset by several bars; using ADX<20 as a filter cuts false entries in choppy markets; ADX>60 rare, often precedes violent reversal/consolidation.
<!-- PROMPT_DIGEST:END -->
