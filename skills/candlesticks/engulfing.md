---
name: Engulfing Pattern Guide
description: Interpretation guide for Engulfing candlestick patterns (Bullish/Bearish Engulfing)
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.8
gating:
  tier: gated
  signal_kind: event
  triggers: [bullish_engulfing, bearish_engulfing]
token_cost: 357
digest_hash: "1d92c2ee"
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

<!-- PROMPT_DIGEST:START -->
Engulfing Pattern Guide (Bullish/Bearish)
- 2-candle reversal, highest-reliability group (57%). Second candle's BODY completely engulfs the first candle's body.
- Bullish: in a downtrend, small bearish candle → large bullish candle fully engulfing the prior body.
- Bearish: in an uptrend, small bullish candle → large bearish candle fully engulfing the prior body.
Signal strength — Bullish: Strong = clear downtrend + volume up on 2nd candle + RSI oversold (≤30); Moderate = after downtrend, minimal volume change; Weak = unclear/sideways. Bearish: Strong = clear uptrend + volume up on 2nd candle + RSI overbought (≥70); Moderate = after uptrend, minimal volume change; Weak = unclear/sideways.
Combinations: RSI extremes ↑ reliability; touch of upper/lower Bollinger band ↑ reversal prob; 2nd-candle volume ≥150% of average ↑ reliability; near key MAs (20, 60) = S/R reversal.
Caveats: judge by BODY, not shadow. Reliability drops sharply in sideways ranges — interpret within trend context. In gapless markets (crypto, FX) Engulfing forms more often → require extra confirmation. Do NOT use as reversal when range-bound (ADX < 20).
AI: assess preceding trend via EMA(20) slope + ADX; check 2nd-candle volume above average; cross-reference RSI + Bollinger for confluence; if ADX < 20 explicitly note reduced reliability; state trend context ("Bullish Engulfing at bottom of downtrend" vs "sideways range — reliability low").
<!-- PROMPT_DIGEST:END -->
