---
name: RSI Signal Guide
description: RSI(14) 신호 해석 가이드 — 과매수/과매도 기준선, 다이버전스, 중심선 크로스오버
type: indicator_guide
indicators: ['rsi']
confidence_weight: 0.9
---

## Overview

RSI (Relative Strength Index) measures the ratio of average gains to average losses over a defined period, normalized to a 0–100 scale. The standard setting of RSI(14) provides balanced sensitivity for swing trading.

## Signal Interpretation

### Overbought / Oversold Thresholds

- RSI > 70: Overbought zone — upward momentum is overheated; potential for short-term correction. In a strong uptrend, the price can stay above 70 for extended periods (Band Walk effect), so do not treat this as an automatic sell signal.
- RSI < 30: Oversold zone — downward momentum is excessive; potential for short-term rebound.
- RSI > 80 / RSI < 20: Extreme readings in high-volatility markets; confirmation from other indicators is strongly recommended.

### Mid-line Crossover (50 line)

- RSI crosses above 50 from below: bullish momentum shift — consider as a buy-side signal (most reliable on daily or higher timeframes).
- RSI crosses below 50 from above: bearish momentum shift.

### Divergence Signals

- Bearish divergence: price makes a higher high while RSI makes a lower high → potential downside reversal. Reliability is highest in overbought territory or during trend weakness.
- Bullish divergence: price makes a lower low while RSI makes a higher low → potential upside reversal. Most reliable in oversold territory.
- Divergence signals are more trustworthy in ranging or weakening trend environments. During strong trends, divergence signals should be confirmed by MACD or Bollinger Band narrowing.

### Failure Swing

- A bearish failure swing occurs when RSI fails to exceed its prior peak in overbought territory and then breaks below the prior trough — a strong sell signal.
- A bullish failure swing occurs when RSI holds above a prior trough in oversold territory and breaks above the prior peak — a strong buy signal.

## Recommended Combinations

- RSI + Bollinger Bands: Confirm volatility extremes. RSI < 30 near lower band = high-probability mean reversion.
- RSI + MACD: Use RSI for overbought/oversold and MACD for trend direction confirmation.
- RSI + Volume: Divergence between RSI and volume can confirm signal strength.
- RSI + ADX: When ADX > 25 and RSI is in extreme zone, the trend context changes interpretation — overbought in a strong uptrend is a continuation signal, not a reversal.

## Caveats

- In trending markets, RSI can remain overbought or oversold for many bars. Do not use RSI in isolation during strong trends.
- RSI divergence in a strong trend is often a false signal — always cross-reference with trend strength indicators (ADX, EMA slope).
- Smoothed RSI or signal-line overlays (9-period EMA of RSI) can reduce noise in choppy conditions.
