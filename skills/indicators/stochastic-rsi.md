---
name: Stochastic RSI Signal Guide
description: StochRSI(14,14,3,3) signal interpretation guide — extreme momentum detection, %K/%D crossover, and divergence
indicators: ['stochRsi']
confidence_weight: 0.8
---

## Overview

Stochastic RSI applies the Stochastic formula to RSI values rather than price, creating a second-order derivative that is significantly more sensitive to momentum changes. It normalizes RSI readings within their own historical range over the specified period. The result ranges from 0 to 1. The standard setting uses RSI(14) applied to a 14-period Stochastic window, with %K smoothed over 3 periods and %D as a 3-period SMA of %K.

## Signal Interpretation

### Overbought / Oversold Thresholds

- StochRSI %K > 0.8: RSI momentum is in an extreme high zone relative to its recent range — a potential short-term correction signal. In strong uptrends, values above 0.8 may persist.
- StochRSI %K < 0.2: RSI momentum is in an extreme low zone — a potential short-term recovery signal.
- StochRSI reacts faster than RSI and is particularly useful for detecting turning points before they are visible in RSI alone.

### %K / %D Crossover Signals

- %K crosses above %D from below 0.2: a strong bullish momentum reversal signal — RSI is turning upward from an oversold extreme. This is one of the highest-quality StochRSI signals.
- %K crosses below %D from above 0.8: a strong bearish momentum reversal signal — RSI is turning downward from an overbought extreme.
- Crossovers in the mid-range (0.4–0.6) are lower quality and should be confirmed by other indicators.

### StochRSI as a Leading Signal

- When StochRSI rises sharply from near 0 to above 0.5 while RSI is still below 50, this can be a leading indicator that RSI (and potentially price) will follow with an upside move.
- When StochRSI drops sharply from near 1 to below 0.5 while RSI is still above 50, this can precede a downside move in RSI and price.

### Divergence Signals

- Bullish divergence: price makes a lower low while StochRSI makes a higher low → RSI momentum is not confirming the price weakness — potential reversal.
- Bearish divergence: price makes a higher high while StochRSI makes a lower high → RSI momentum is losing strength despite rising price.

## Key Combinations

- StochRSI + VWAP + Volume Profile: This combination is effective for identifying short-term inflection points aligned with institutional support/resistance levels.
- StochRSI + MACD or ADX: Filter StochRSI signals by trend direction. Only take StochRSI buy signals when MACD is positive and ADX confirms a trend.
- StochRSI + Bollinger Bands: StochRSI signal from the lower extreme near the Bollinger lower band creates a strong confluence for a short-term bounce entry.

## Caveats

- StochRSI is extremely sensitive. False signals (whipsaws) are common in low-volatility or sideways markets. Never use it as a sole trigger.
- Because it is derived from RSI which is itself a smoothed value, StochRSI can appear to lag even while it is designed to lead — the interpretation is relative to RSI, not to price directly.
- Use StochRSI primarily for timing within an already-established directional bias. Establish the trend direction first with EMA, MACD, or ADX, then use StochRSI for precise entry timing.
- Values can remain at extreme levels (above 0.8 or below 0.2) for extended periods in trending conditions — avoid mean-reversion assumptions in trending environments.
