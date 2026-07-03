---
name: Williams %R Signal Guide
description: Williams %R(14) 신호 해석 가이드 — 과매수/과매도, 모멘텀 전환, 다이버전스
type: indicator_guide
indicators: ['williamsR']
confidence_weight: 0.8
usage_roles: [signal, confirmation]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: williamsR
    predicate: level
token_cost: 510
digest_hash: "d27ca839"
---

## Overview

Williams %R, developed by Larry Williams, is a momentum oscillator that measures the position of the current close relative to the highest high over a lookback period. It ranges from 0 to -100, where values near 0 indicate the close is near the period's high (potential overbought) and values near -100 indicate the close is near the period's low (potential oversold). Mathematically, Williams %R equals the Fast Stochastic %K shifted by -100 (`%R = %K - 100`) — the two oscillators are a linear offset of each other rather than a multiplicative inverse, so they move in the same direction on the same underlying data. The standard period is 14 bars.

## Signal Interpretation

### Overbought / Oversold Thresholds

- %R above -20 (0 to -20): overbought zone — the close is near the top of the recent range. In a ranging market, this signals potential downside correction. In a strong uptrend, %R can remain in the overbought zone for extended periods (trend persistence).
- %R below -80 (-80 to -100): oversold zone — the close is near the bottom of the recent range. In a ranging market, this signals potential upside rebound. In a strong downtrend, %R can remain oversold for extended periods.
- %R between -20 and -80: neutral zone — no extreme reading. The market is trading within normal range relative to recent highs and lows.

### Momentum Reversal Signals

- %R crosses above -80 from below: the close has moved away from the period low — a bullish momentum shift. Consider as a buy signal, especially when confirmed by price support.
- %R crosses below -20 from above: the close has moved away from the period high — a bearish momentum shift. Consider as a sell signal, especially when confirmed by price resistance.
- The crossing itself is the actionable signal — not simply being in the zone. Waiting for the exit from the extreme zone filters out many false signals during strong trends.

### Failure Swing

- Bullish failure swing: %R dips below -80, recovers above -80, dips again but stays above the prior low, then rises above the intermediate high — a strong buy signal indicating sellers failed to regain control.
- Bearish failure swing: %R rises above -20, pulls back below -20, rises again but fails to exceed the prior high, then falls below the intermediate low — a strong sell signal indicating buyers failed to push higher.

### Divergence Signals

- Bullish divergence: price makes a lower low while %R makes a higher low → downside momentum is weakening — potential reversal upward.
- Bearish divergence: price makes a higher high while %R makes a lower high → upside momentum is weakening — potential reversal downward.
- Divergence is most reliable when occurring at extreme overbought/oversold levels.

## Recommended Combinations

- Williams %R + Stochastic: Williams %R is equivalent to Fast Stochastic %K with a -100 shift, but the Stochastic indicator shown on this project is Slow Stochastic (Fast %K smoothed by 3-period SMA). Comparing unsmoothed %R against smoothed Slow %K therefore reveals short-term momentum divergence: when %R extremes appear before Slow %K confirms, an early turning point is likely.
- Williams %R + RSI: %R reacts faster to price changes due to its simpler calculation. Use %R for early entry timing and RSI for broader overbought/oversold context.
- Williams %R + MACD: MACD provides trend direction while %R provides entry timing within the trend context. Enter long when MACD is bullish and %R crosses above -80.
- Williams %R + Bollinger Bands: %R oversold + price at Bollinger lower band = high-probability mean reversion buy in ranging markets.

## Caveats

- Like all oscillators, Williams %R generates frequent false signals in strong trending markets. An asset in a strong uptrend can remain above -20 for many bars — do not sell solely based on overbought readings during trends.
- %R is related to Fast Stochastic %K by a fixed linear offset (`%R = %K - 100`), so it carries identical informational content on a shifted scale. Using both simultaneously adds no new signal — choose one or the other.
- The 14-period setting is standard for daily charts. For shorter timeframes, periods of 10 or 21 may provide better sensitivity depending on the asset's characteristics.
- %R does not incorporate volume information. Combine with volume-based indicators (OBV, MFI) for more robust signal confirmation.

<!-- PROMPT_DIGEST:START -->
### Williams %R(14)

Close relative to highest high over lookback. Range 0 to -100. `%R = Fast Stochastic %K − 100` (linear offset — same direction on same data). Period 14.

**Thresholds:**
- %R above -20 (0 to -20): overbought — close near range top. Ranging → downside correction; strong uptrend can persist (trend persistence).
- %R below -80 (-80 to -100): oversold — close near range bottom. Ranging → upside rebound; strong downtrend can persist.
- -20 to -80: neutral zone.

**Momentum reversal:**
- %R crosses above -80 from below = bullish shift (buy, esp. confirmed by price support).
- %R crosses below -20 from above = bearish shift (sell, esp. confirmed by resistance).
- The crossing (exit from extreme) is the actionable signal — NOT just being in the zone; filters false signals in strong trends.

**Failure swing:**
- Bullish: %R dips <-80, recovers >-80, dips again but stays above prior low, then rises above intermediate high — strong buy (sellers failed).
- Bearish: %R rises >-20, pulls back <-20, rises again but fails to exceed prior high, then falls below intermediate low — strong sell (buyers failed).

**Divergence:**
- Bullish: price lower low while %R higher low → downside momentum weakening, reversal up.
- Bearish: price higher high while %R lower high → upside weakening, reversal down.
- Most reliable at extreme OB/OS levels.

**Combos:** +Stochastic (%R = Fast %K −100; project's Stochastic is Slow %K [Fast %K smoothed 3] — comparing unsmoothed %R vs smoothed Slow %K reveals early turning points when %R extremes appear before Slow %K confirms); +RSI (%R faster for early entry timing, RSI for context); +MACD (enter long when MACD bullish & %R crosses above -80); +BB (%R oversold + price at lower band = high-prob mean reversion buy in ranges).

**Caveats:** frequent false signals in strong trends (can stay >-20 many bars — don't sell on overbought alone); %R = %K−100 fixed offset, identical info — don't use both together; 14 standard daily, 10/21 for shorter TF; no volume — combine OBV/MFI.
<!-- PROMPT_DIGEST:END -->
