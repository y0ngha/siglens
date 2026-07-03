---
name: Morning/Evening Star Guide
description: 3-candle reversal pattern interpretation guide for Morning Star and Evening Star
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.82
gating:
  tier: gated
  signal_kind: event
  triggers: [morning_star, evening_star, morning_doji_star, evening_doji_star]
token_cost: 419
digest_hash: "078e7d8e"
---

## Overview

Morning Star / Evening Star are 3-candle reversal patterns with higher reliability than single-candle patterns.
When the middle candle is a Doji, the pattern is classified as a Morning/Evening Doji Star and carries even greater reliability.

### Morning Star
1. Long bearish candle (downtrend continuation)
2. Small-body candle (gap down, indecision)
3. Long bullish candle (recovers at least 50% of the first candle)

### Evening Star
1. Long bullish candle (uptrend continuation)
2. Small-body candle (gap up, indecision)
3. Long bearish candle (retraces at least 50% of the first candle)

## Signal Interpretation

### Morning Star
- **Strong signal**: Clear downtrend + middle candle is a Doji + third candle recovers ≥ 60% of the first candle + increased volume
- **Moderate signal**: Appears after a downtrend, third candle recovers 50–60%
- **Weak signal**: Trend unclear, third candle recovery ratio below 50%

### Evening Star
- **Strong signal**: Clear uptrend + middle candle is a Doji + third candle retraces ≥ 60% of the first candle + increased volume
- **Moderate signal**: Appears after an uptrend, third candle retraces 50–60%
- **Weak signal**: Trend unclear, third candle retracement ratio below 50%

## Key Combinations

- **RSI + Star**: Appearing alongside RSI extremes (overbought/oversold) significantly increases reversal reliability
- **MACD + Star**: Appearing simultaneously with a MACD histogram direction change is a powerful signal
- **Volume + Star**: A sharp increase in volume on the third candle confirms the strength of the emerging trend
- **Support/Resistance + Star**: Appearing near key support/resistance levels increases reversal probability

## Caveats

- In 24-hour markets (crypto, FX), gaps rarely form — gap conditions should be relaxed when interpreting the pattern
- If the middle candle's body is too large, the pattern should be classified as a general reversal pattern rather than a Star pattern
- On short-term timeframes (1Min, 5Min), noise is high and reliability is low
- If all three candles have below-average volume, pattern reliability drops sharply

## AI Analysis Instructions

When a Morning Star, Evening Star, Morning Doji Star, or Evening Doji Star is detected:

- Verify the preceding trend using EMA(20) and EMA(60) direction
- Evaluate the third candle's recovery/retracement ratio relative to the first candle
- Check if the middle candle is a Doji variant for enhanced reliability
- Cross-reference with volume changes across all three candles
- For 24-hour markets (crypto, FX), note that gap conditions are naturally relaxed
- State the specific variant detected: "Morning Doji Star has higher reliability than a standard Morning Star"

<!-- PROMPT_DIGEST:START -->
Morning/Evening Star Guide (3-candle reversal)
- Higher reliability than single-candle patterns. If middle candle is a Doji → Morning/Evening Doji Star, even greater reliability.
Structure: Morning Star = (1) long bearish candle (downtrend continuation), (2) small-body candle (gap down, indecision), (3) long bullish candle recovering ≥50% of the 1st. Evening Star = (1) long bullish candle (uptrend continuation), (2) small-body candle (gap up, indecision), (3) long bearish candle retracing ≥50% of the 1st.
Signal strength — Morning: Strong = clear downtrend + middle Doji + 3rd recovers ≥60% of 1st + volume up; Moderate = after downtrend, 3rd recovers 50–60%; Weak = unclear, 3rd recovery <50%. Evening: Strong = clear uptrend + middle Doji + 3rd retraces ≥60% of 1st + volume up; Moderate = after uptrend, 3rd retraces 50–60%; Weak = unclear, 3rd retracement <50%.
Combinations: RSI extremes ↑ reliability; MACD histogram direction change = powerful; sharp volume increase on 3rd candle confirms new trend; near key S/R ↑ reversal prob.
Caveats: in 24h markets (crypto, FX) gaps rarely form → relax gap conditions. If middle candle's body too large, classify as general reversal, not a Star. On short timeframes (1Min, 5Min) noise high / reliability low. If all three candles below-avg volume, reliability drops sharply.
AI: verify preceding trend via EMA(20) + EMA(60); evaluate 3rd candle's recovery/retracement ratio vs 1st; check if middle candle is a Doji variant for enhanced reliability; cross-reference volume across all three; for 24h markets note gap conditions relaxed; state variant ("Morning Doji Star has higher reliability than standard Morning Star").
<!-- PROMPT_DIGEST:END -->
