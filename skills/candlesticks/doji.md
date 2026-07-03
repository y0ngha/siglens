---
name: Doji Pattern Guide
description: Interpretation guide for Doji-family candlestick patterns (Standard, Long-legged, Dragonfly, Gravestone)
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.75
gating:
  tier: gated
  signal_kind: event
  triggers: [doji, gravestone_doji, dragonfly_doji]
token_cost: 459
digest_hash: "3bde30ae"
---

## Overview

A Doji is a candle where the open and close prices are nearly identical, signaling market indecision or a potential trend reversal.
It is only valid as a reversal signal at the end of a trend — a Doji in a sideways range carries no meaningful signal.

### Standard Doji (Cross)
- Open ≈ Close, upper and lower shadows of similar length
- Balanced state between buying and selling pressure

### Long-legged Doji (Long-legged Cross)
- Very long upper and lower shadows
- Indecision amid extreme volatility — high potential for trend reversal

### Dragonfly Doji
- Long lower shadow only, no upper shadow
- Bullish reversal signal at the bottom of a downtrend

### Gravestone Doji
- Long upper shadow only, no lower shadow
- Bearish reversal signal at the top of an uptrend
- Reliability: 57%

## Signal Interpretation

### Dragonfly Doji (Bullish Reversal)
- **Strong signal**: Clear downtrend bottom + long lower shadow + next candle confirms bullish close + RSI oversold
- **Moderate signal**: Appears after a downtrend, before next candle confirmation
- **Weak signal**: Trend unclear or sideways range

### Gravestone Doji (Bearish Reversal)
- **Strong signal**: Clear uptrend top + long upper shadow + next candle confirms bearish close + RSI overbought
- **Moderate signal**: Appears after an uptrend, before next candle confirmation
- **Weak signal**: Trend unclear or sideways range

### Standard / Long-legged Doji (Neutral)
- **Potential reversal**: Appears at the end of a long-term trend — treat as a reversal warning
- **No significance**: Ignore when appearing in a sideways range

## Key Combinations

- **Doji + Engulfing**: If the candle following a Doji is an Engulfing, it is a very powerful reversal signal
- **Doji + Bollinger Band**: Appearance at band extremes increases reversal probability
- **RSI + Doji**: A Doji in overbought/oversold territory signals exhaustion
- **Morning/Evening Doji Star**: When the middle candle of a 3-candle pattern is a Doji, the reliability of the Star pattern increases

## Caveats

- A Doji in a sideways range indicates simple volatility reduction, not a reversal signal
- Classified as a Doji when the body is within 5% of the total range (high–low)
- Next candle confirmation is essential — trading decisions cannot be made based on Doji alone
- Do not use as a reversal signal when appearing in a range-bound environment (ADX < 20)

## AI Analysis Instructions

When a Doji, Long-legged Doji, Dragonfly Doji, or Gravestone Doji is detected:

- Identify the specific Doji variant and its directional implications
- Evaluate the preceding trend using EMA(20) and ADX to determine if the Doji has reversal significance
- If the market is range-bound (ADX < 20), explicitly note: "Doji appeared in a sideways range — difficult to interpret as a reversal signal"
- Check for follow-up candle confirmation when available
- Cross-reference with RSI extremes and Bollinger Band position
- For Long-legged Doji, emphasize the high volatility context and potential for sharp directional moves

<!-- PROMPT_DIGEST:START -->
Doji Pattern Guide (Standard, Long-legged, Dragonfly, Gravestone)
- Doji = open ≈ close; classified when body is within 5% of total range (high–low). Indecision/potential reversal. Valid as reversal ONLY at the END of a trend; in a sideways range = volatility reduction, NOT reversal.
Variants (geometry → meaning): Standard/Cross = upper/lower shadows similar length, neutral. Long-legged = very long upper AND lower shadows, extreme-volatility indecision, high reversal potential. Dragonfly = long lower shadow only, no upper → bullish reversal at downtrend bottom. Gravestone = long upper shadow only, no lower → bearish reversal at uptrend top, reliability 57%.
Signal strength — Dragonfly (bullish): Strong = clear downtrend bottom + long lower shadow + next candle confirms bullish close + RSI oversold; Moderate = after downtrend, pre-confirmation; Weak = unclear/sideways. Gravestone (bearish): Strong = clear uptrend top + long upper shadow + next candle bearish close + RSI overbought; Moderate = after uptrend, pre-confirmation; Weak = unclear/sideways. Standard/Long-legged (neutral): reversal warning only at end of long-term trend; ignore in sideways range.
Combinations: Doji + next-candle Engulfing = very powerful reversal; at Bollinger band extremes ↑ reversal prob; in RSI overbought/oversold = exhaustion; as middle candle of a 3-candle Star ↑ Star reliability.
Rules: next-candle confirmation essential — never trade on Doji alone. Do NOT use as reversal when range-bound (ADX < 20).
AI: identify variant + directional implication; judge preceding trend via EMA(20) + ADX; if ADX < 20 explicitly note "Doji appeared in a sideways range — difficult to interpret as a reversal signal"; check follow-up candle; cross-reference RSI extremes + Bollinger; for Long-legged emphasize high-volatility / sharp-move potential.
<!-- PROMPT_DIGEST:END -->
