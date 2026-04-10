---
name: Engulfing Pattern Guide
description: Interpretation guide for Engulfing candlestick patterns (Bullish/Bearish Engulfing)
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.8
---

## Overview

Engulfing is a 2-candle reversal pattern and belongs to the highest reliability group (57%) among candlestick patterns.
The second candle's body completely engulfs the body of the first candle.

### Bullish Engulfing
- A small bearish candle followed by a large bullish candle during a downtrend
- The bullish candle completely engulfs the previous candle's body

### Bearish Engulfing
- A small bullish candle followed by a large bearish candle during an uptrend
- The bearish candle completely engulfs the previous candle's body

## Signal Interpretation

### Bullish Engulfing
- **Strong signal**: Appears after a clear downtrend + increased volume on the second candle + RSI in oversold zone (≤ 30)
- **Moderate signal**: Appears after a downtrend but with minimal volume change
- **Weak signal**: Trend is unclear or pattern appears in a sideways range

### Bearish Engulfing
- **Strong signal**: Appears after a clear uptrend + increased volume on the second candle + RSI in overbought zone (≥ 70)
- **Moderate signal**: Appears after an uptrend but with minimal volume change
- **Weak signal**: Trend is unclear or pattern appears in a sideways range

## Key Combinations

- **RSI + Engulfing**: Appearing alongside RSI extremes (overbought/oversold) significantly increases reversal reliability
- **Bollinger Band + Engulfing**: Appearing simultaneously with a touch of the upper/lower band increases reversal probability
- **Volume + Engulfing**: If the second candle's volume is ≥ 150% of average, reliability increases
- **EMA/MA + Engulfing**: Appearing near key moving averages (20, 60) signals a support/resistance reversal

## Caveats

- Judgment must be based on the **body**, not the shadow (wick)
- Reliability drops sharply in sideways ranges — always interpret within a trend context
- In gapless markets (crypto, FX, etc.), Engulfing structures form more frequently, so additional confirmation is required
- Do not use as a reversal signal when appearing in a range-bound environment (ADX < 20)

## AI Analysis Instructions

When a Bullish Engulfing or Bearish Engulfing pattern is detected in the candle data:

- Evaluate the preceding trend direction using EMA(20) slope and ADX value
- Check if the second candle's volume is above average (stronger confirmation)
- Cross-reference with RSI and Bollinger Band position for confluence
- If the pattern appears in a range-bound market (ADX < 20), explicitly note reduced reliability in the summary
- State the trend context clearly: "Bullish Engulfing appeared at the bottom of a downtrend" or "Appeared in a sideways range — reliability is low"
