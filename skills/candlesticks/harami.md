---
name: Harami Pattern Guide
description: Harami candlestick pattern (Bullish/Bearish Harami, Harami Cross) interpretation guide
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.72
gating:
  tier: gated
  signal_kind: event
  triggers: [bullish_harami, bearish_harami, bullish_harami_cross, bearish_harami_cross]
token_cost: 461
digest_hash: "70449431"
---

## Overview

Harami is a 2-candle reversal pattern — the opposite structure of Engulfing.
The second candle is completely contained within the body of the first candle, signaling trend weakness and the potential for a reversal.
Reliability is lower than Engulfing, but increases significantly when appearing after a long-term trend.

### Bullish Harami
- A small bullish candle contained within the previous bearish candle's body
- Signals weakening of the downtrend

### Bearish Harami
- A small bearish candle contained within the previous bullish candle's body
- Signals weakening of the uptrend

### Harami Cross
- The second candle is a Doji — a stronger reversal signal
- Simultaneously indicates indecision and the potential for a trend reversal

## Signal Interpretation

### Bullish Harami
- **Strong signal**: Appears after a long downtrend + Harami Cross (second candle is a Doji) + declining volume pattern
- **Moderate signal**: Appears after a downtrend, second candle is within 25% of the first candle's body size
- **Weak signal**: Appears after a short-term decline or trend is unclear

### Bearish Harami
- **Strong signal**: Appears after a long uptrend + Harami Cross + declining volume pattern
- **Moderate signal**: Appears after an uptrend, second candle is within 25% of the first candle's body size
- **Weak signal**: Appears after a short-term rise or trend is unclear

## Key Combinations

- **RSI + Harami**: Appearance in overbought/oversold zones increases reversal probability
- **MACD + Harami**: Harami appearing while the MACD histogram is shrinking confirms trend weakening
- **Bollinger Band + Harami**: Appearance at band extremes alongside band contraction suggests a potential directional shift
- **Volume + Harami**: Declining volume on the second candle provides additional confirmation of trend weakening

## Caveats

- Lower reliability than Engulfing — interpret alongside a confirmation candle rather than in isolation
- If the second candle extends beyond the first candle's body, it is not a Harami
- Reliability drops sharply when the trend is short or unclear
- A Harami with high volume can instead signal trend continuation

## AI Analysis Instructions

When a Bullish Harami, Bearish Harami, or Harami Cross is detected:

- Evaluate the length and strength of the preceding trend using EMA(20/60) and ADX
- Determine if the pattern is a standard Harami or a Harami Cross (Doji variant) for confidence adjustment
- Check the volume pattern: declining volume on the second candle confirms the interpretation
- Cross-reference with RSI and MACD momentum indicators
- Note the relative confidence: "Harami has lower reliability than Engulfing — a confirmation candle is required"
- For Harami Cross, emphasize the enhanced reliability: "Harami Cross is a stronger reversal signal than a standard Harami"

<!-- PROMPT_DIGEST:START -->
Harami Pattern Guide (Bullish/Bearish Harami, Harami Cross)
- 2-candle reversal, opposite of Engulfing: 2nd candle's body completely CONTAINED within the 1st candle's body. Signals trend weakness / reversal potential. Lower reliability than Engulfing; increases significantly after a long-term trend.
Variants: Bullish Harami = small bullish candle contained in prior bearish candle's body → downtrend weakening. Bearish Harami = small bearish candle contained in prior bullish candle's body → uptrend weakening. Harami Cross = 2nd candle is a Doji → stronger reversal signal (indecision + reversal potential).
Signal strength — Bullish: Strong = after long downtrend + Harami Cross (Doji 2nd) + declining volume; Moderate = after downtrend, 2nd candle within 25% of 1st candle's body size; Weak = after short-term decline / unclear. Bearish: Strong = after long uptrend + Harami Cross + declining volume; Moderate = after uptrend, 2nd candle within 25% of 1st candle's body size; Weak = after short-term rise / unclear.
Combinations: RSI overbought/oversold ↑ reversal prob; MACD histogram shrinking confirms weakening; band-extreme + Bollinger contraction suggests directional shift; declining 2nd-candle volume confirms weakening.
Caveats: lower reliability than Engulfing — need a confirmation candle, not isolation. If 2nd candle extends beyond 1st candle's body, it is NOT a Harami. Reliability drops sharply when trend short/unclear. A Harami with HIGH volume can instead signal continuation.
AI: assess length/strength of preceding trend via EMA(20/60) + ADX; determine standard Harami vs Harami Cross (Doji) for confidence; check declining 2nd-candle volume; cross-reference RSI + MACD; note "Harami has lower reliability than Engulfing — confirmation candle required"; for Harami Cross emphasize it is stronger than standard Harami.
<!-- PROMPT_DIGEST:END -->
