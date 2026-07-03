---
name: Stochastic Signal Guide
description: 스토캐스틱(14,3,3) 신호 해석 가이드 — 과매수/과매도, %K/%D 크로스오버, 다이버전스
type: indicator_guide
indicators: ['stochastic']
confidence_weight: 0.8
usage_roles: [signal, confirmation]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: stochastic
    predicate: level
token_cost: 368
digest_hash: "69730dbb"
---

## Overview

The Stochastic Oscillator measures the current closing price relative to the high-low range over a specified period, expressing the result as a percentage. %K is the primary line; %D is a smoothed signal line. The standard setting (14, 3, 3) uses a 14-period lookback for %K, smoothing 3 periods for Slow %K, and a 3-period SMA for %D. The oscillator ranges from 0 to 100.

## Signal Interpretation

### Overbought / Oversold Thresholds

- %K > 80: overbought zone — short-term upward momentum is overheated; potential for a pullback or reversal. In strong uptrends, the stochastic can remain above 80 for multiple bars without a meaningful reversal.
- %K < 20: oversold zone — short-term downward momentum is excessive; potential for a bounce or reversal.
- Extreme readings (> 90 or < 10) indicate very strong momentum in the current direction — confirm with trend context before fading the move.

### %K / %D Crossover Signals

- %K crosses above %D (Golden Cross): bullish momentum shift — a buy signal. Most reliable when both lines are in the oversold zone (< 20) at the time of crossover.
- %K crosses below %D (Dead Cross): bearish momentum shift — a sell signal. Most reliable when both lines are in the overbought zone (> 80).
- Crossovers in the mid-range (40–60) are less reliable; filter with trend direction using EMA or MACD.

### Divergence Signals

- Bullish divergence: price makes a lower low while stochastic makes a higher low → downward momentum is decelerating — potential upside reversal. Strongest when occurring in the oversold zone.
- Bearish divergence: price makes a higher high while stochastic makes a lower high → upward momentum is fading — potential downside reversal. Strongest when occurring in the overbought zone.

### %D as Trend Bias

- %D consistently above 50: overall momentum bias is bullish over the lookback window.
- %D consistently below 50: overall momentum bias is bearish.

## Key Combinations

- Stochastic + RSI: Both are oscillators, but each reacts differently. When both are simultaneously in overbought or oversold territory and diverge together with price, the signal strength is materially higher.
- Stochastic + MACD: Stochastic provides the short-term timing; MACD provides the medium-term direction filter. Only take stochastic crossover signals that align with MACD direction.
- Stochastic + Bollinger Bands: A stochastic buy signal at the Bollinger lower band is a high-probability mean reversion setup in ranging markets.

## Caveats

- In strong trending markets, stochastic can remain in overbought or oversold territory for many bars. Do not automatically sell when stochastic exceeds 80 if a strong trend is in place.
- Use ADX to determine regime first: if ADX < 20, stochastic oscillator signals are more reliable (range environment); if ADX > 25, stochastic signals may lag behind price movement.
- The default (14,3,3) setting is moderately responsive. For faster signals, reduce %K to 5 or 9 (more noise); for slower signals, increase to 21 (fewer but higher quality signals).

<!-- PROMPT_DIGEST:START -->
### Stochastic (14,3,3)

Close relative to high-low range. %K primary line; %D smoothed signal. 14-period lookback, Slow %K smoothed 3, %D = 3-period SMA of %K. Range 0–100.

**Thresholds:**
- %K > 80: overbought — pullback/reversal risk. In strong uptrends can stay >80 multiple bars.
- %K < 20: oversold — bounce/reversal potential.
- >90 or <10: very strong momentum in current direction — confirm trend before fading.

**%K/%D crossovers:**
- %K crosses above %D (Golden Cross) = bullish buy; most reliable when both lines <20 at crossover.
- %K crosses below %D (Dead Cross) = bearish sell; most reliable when both >80.
- Mid-range (40–60) crossovers less reliable — filter with EMA/MACD.

**Divergence:**
- Bullish: price lower low while stoch higher low → upside reversal; strongest in oversold.
- Bearish: price higher high while stoch lower high → downside reversal; strongest in overbought.

**%D trend bias:** consistently >50 = bullish bias; consistently <50 = bearish bias.

**Combos:** +RSI (both extreme + diverge with price = materially higher strength); +MACD (short-term timing + medium-term direction filter, only take aligned crossovers); +BB (buy signal at lower band = high-prob mean reversion in ranges).

**Caveats:** strong trends keep stoch extreme many bars — don't auto-sell when >80 in strong trend; use ADX regime (ADX<20 = stoch reliable/range; ADX>25 = stoch may lag); (14,3,3) moderate — %K 5/9 faster+noisier, 21 slower+higher quality.
<!-- PROMPT_DIGEST:END -->
