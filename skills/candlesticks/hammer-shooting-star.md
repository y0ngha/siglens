---
name: Hammer/Shooting Star Guide
description: Single-candle reversal pattern interpretation guide (Hammer, Inverted Hammer, Shooting Star, Hanging Man)
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.75
gating:
  tier: gated
  signal_kind: event
  triggers: [hammer, inverted_hammer, shooting_star, hanging_man]
token_cost: 474
digest_hash: "725364d1"
---

## Overview

Hammer-family patterns are single-candle reversal patterns where the same candle shape is classified differently depending on its position within a trend.
Reliability is low when used in isolation, so next-candle confirmation is always required.

### Hammer
- Appears at the bottom of a downtrend
- Small body + long lower shadow (at least 2× the body) + little to no upper shadow
- Selling pressure was once strong, but buying pressure recovered — suggesting a potential reversal

### Inverted Hammer
- Appears at the bottom of a downtrend
- Small body + long upper shadow + little to no lower shadow
- Reliability of 60% — the highest among Hammer-family patterns

### Shooting Star
- Appears at the top of an uptrend
- Small body + long upper shadow (at least 2× the body) + little to no lower shadow
- Buying pressure was once strong but was overwhelmed by sellers — potential bearish reversal

### Hanging Man
- Appears at the top of an uptrend
- Same shape as the Hammer, but appearing in an uptrend signals a bearish reversal

## Signal Interpretation

### Bullish Reversal (Hammer, Inverted Hammer)
- **Strong signal**: Clear downtrend + long shadow (3× body or more) + next candle confirms bullish close + increased volume
- **Moderate signal**: Appears after a downtrend, shadow length 2–3× the body
- **Weak signal**: Trend unclear or before next candle confirmation

### Bearish Reversal (Shooting Star, Hanging Man)
- **Strong signal**: Clear uptrend + long shadow (3× body or more) + next candle confirms bearish close + increased volume
- **Moderate signal**: Appears after an uptrend, shadow length 2–3× the body
- **Weak signal**: Trend unclear or before next candle confirmation

## Key Combinations

- **RSI + Hammer/Star**: Appearing simultaneously in RSI overbought/oversold zones increases reversal strength
- **Bollinger Band + Hammer/Star**: Appearing simultaneously with a touch of the upper/lower band increases reversal probability
- **Support/Resistance + Hammer**: Hammer appearing above a key support level confirms a bottom
- **Volume + Hammer/Star**: The higher the pattern candle's volume relative to average, the greater the reliability

## Caveats

- Position (trend context) determines the pattern name — the same shape becomes a different pattern depending on whether it appears in an uptrend or downtrend
- **Never use in isolation**: Always confirm with the direction of the next candle
- Do not interpret as a reversal signal when appearing in a sideways range
- On short-term timeframes, the shadow-to-body ratio is unstable, reducing reliability

## AI Analysis Instructions

When a Hammer, Inverted Hammer, Shooting Star, or Hanging Man is detected:

- First determine the trend context using EMA(20) direction to confirm the pattern classification
- Evaluate the shadow-to-body ratio for signal strength (2x = minimum, 3x+ = strong)
- Check the next candle's direction for confirmation (if available in the data)
- Cross-reference with RSI and Bollinger Band position
- Emphasize that single-candle patterns require next-bar confirmation: "Hammer detected — next candle must confirm with a bullish close"
- If the pattern appears without a clear preceding trend, explicitly reduce the signal weight

<!-- PROMPT_DIGEST:START -->
Hammer/Shooting Star Guide (Hammer, Inverted Hammer, Shooting Star, Hanging Man)
- Single-candle reversal; same shape classified differently by trend position. Low reliability alone — next-candle confirmation always required.
Geometry + context: Hammer = at downtrend bottom, small body + long lower shadow (≥2× body) + little/no upper shadow → bullish reversal. Inverted Hammer = at downtrend bottom, small body + long upper shadow + little/no lower shadow → reliability 60% (highest in family). Shooting Star = at uptrend top, small body + long upper shadow (≥2× body) + little/no lower shadow → bearish reversal. Hanging Man = at uptrend top, same shape as Hammer but bearish (because in an uptrend).
Signal strength — Bullish (Hammer, Inverted Hammer): Strong = clear downtrend + long shadow (≥3× body) + next candle bullish close + volume up; Moderate = after downtrend, shadow 2–3× body; Weak = unclear/pre-confirmation. Bearish (Shooting Star, Hanging Man): Strong = clear uptrend + long shadow (≥3× body) + next candle bearish close + volume up; Moderate = after uptrend, shadow 2–3× body; Weak = unclear/pre-confirmation.
Combinations: RSI overbought/oversold ↑ strength; touch of Bollinger band ↑ reversal prob; Hammer above key support confirms bottom; higher relative volume ↑ reliability.
Caveats: position (trend context) determines the name. NEVER use in isolation — confirm with next candle's direction. Do NOT interpret as reversal in a sideways range. On short timeframes, shadow-to-body ratio unstable → lower reliability.
AI: determine trend context via EMA(20) to confirm classification; evaluate shadow-to-body ratio (2× minimum, 3×+ strong); check next candle for confirmation; cross-reference RSI + Bollinger; emphasize next-bar confirmation ("Hammer detected — next candle must confirm with a bullish close"); if no clear preceding trend, explicitly reduce signal weight.
<!-- PROMPT_DIGEST:END -->
