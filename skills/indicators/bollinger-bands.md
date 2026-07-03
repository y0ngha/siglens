---
name: Bollinger Bands Signal Guide
description: 볼린저 밴드(20,2) 신호 해석 가이드 — 스퀴즈, 밴드 워크, 브레이크아웃, 평균 회귀
type: indicator_guide
indicators: ['bollinger']
confidence_weight: 0.85
usage_roles: [signal, confirmation, measurement]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: bollinger
    predicate: pctB
token_cost: 510
digest_hash: "c6a14b0b"
---

## Overview

Bollinger Bands consist of a middle band (20-period SMA) and an upper and lower band placed 2 standard deviations above and below. The bands dynamically widen during high volatility and contract during low volatility. This makes them useful for identifying both trend strength and volatility regimes.

## Signal Interpretation

### Band Touch and Position

- Price touching or exceeding the upper band: price is statistically high relative to recent history. In a ranging market this signals potential overbought conditions. In a strong uptrend, price can "walk the band" along the upper boundary — this is a trend continuation signal, not a sell signal.
- Price touching or falling below the lower band: price is statistically low. In a ranging market this signals potential oversold conditions. In a strong downtrend, the same band-walk can occur on the lower side.
- Treat band touches as context-dependent signals, not absolute entry/exit triggers.

### Bollinger Squeeze (Contraction)

- When the bands narrow significantly (low bandwidth), volatility has compressed and energy is building. A squeeze does not predict direction — it signals an imminent breakout in either direction.
- To identify the breakout direction, use complementary indicators: MACD trend, ADX directionality, or recent price structure (higher lows vs. lower highs).
- A squeeze followed by a high-volume breakout above the upper band is a strong bullish trend initiation signal. The same below the lower band is strongly bearish.

### Middle Band Crossover

- Price closing above the middle band (20 SMA) from below: early bullish momentum shift — potential uptrend beginning.
- Price closing below the middle band from above: early bearish momentum shift.

### Band Walk (Trend Continuation)

- Price closing consistently outside or at the upper band for 3 or more consecutive bars: a strong trend is in progress — mean reversion strategies are inappropriate.
- Band walk on the lower band for 3 or more consecutive bars: a strong downtrend is in progress.

### Mean Reversion (Range Context)

- In a sideways or low-ADX environment: price reaching the upper band signals a potential pullback toward the middle; price reaching the lower band signals a potential bounce.
- Mean reversion trades are most reliable when RSI confirms overbought (> 70) or oversold (< 30) at the same time as band touch.

## Recommended Combinations

- Bollinger Bands + RSI: RSI < 30 near lower band = high-probability mean reversion buy; RSI > 70 near upper band = potential mean reversion sell in ranging markets.
- Bollinger Bands + MACD/ADX: Determine trend regime first. If ADX > 25 and MACD is trending, band touches are continuation signals — not reversals.
- Bollinger Bands + Volume Profile: When price bounces from the lower band near a Volume Profile POC level, the support is strengthened by supply/demand confluence.

## Caveats

- Never interpret an upper band touch as an automatic sell signal. In trending conditions, this is precisely where a trend continuation trade would be placed.
- Bollinger squeeze predicts volatility expansion, not direction. Always identify the likely direction with a trend filter before trading a squeeze breakout.
- The standard (20, 2) settings suit daily charts. For intraday analysis, narrower periods like (10, 2.0) increase sensitivity but also noise.

<!-- PROMPT_DIGEST:START -->
### Bollinger Bands Signal Guide
- Middle = 20-period SMA; upper/lower = ±2 standard deviations. Widen in high vol, contract in low vol.

Band touch / position:
- Touch/exceed UPPER: statistically high. Ranging = potential overbought; strong uptrend = "walk the band" = trend continuation, NOT a sell.
- Touch/below LOWER: statistically low. Ranging = potential oversold; strong downtrend = band-walk on the lower side.
- Band touches are context-dependent, not absolute entry/exit triggers.

Squeeze (contraction):
- Narrow bands (low bandwidth) = compressed volatility, energy building — imminent breakout in EITHER direction (no direction implied).
- Find direction via MACD trend / ADX directionality / price structure (higher lows vs lower highs).
- Squeeze + high-volume breakout above upper = strong bullish initiation; below lower = strongly bearish.

Middle band crossover:
- Close above 20 SMA from below = early bullish shift (potential uptrend beginning); below from above = early bearish shift.

Band walk (continuation):
- Close outside/at UPPER band ≥3 consecutive bars = strong uptrend, mean-reversion inappropriate.
- LOWER band ≥3 consecutive bars = strong downtrend.

Mean reversion (sideways / low-ADX):
- Upper band = potential pullback toward middle; lower band = potential bounce.
- Most reliable when RSI confirms overbought (>70) or oversold (<30) at the same time as band touch.

Combinations:
- + RSI: RSI<30 near lower band = high-prob mean-reversion buy; RSI>70 near upper = mean-reversion sell in ranging markets.
- + MACD/ADX: determine regime FIRST; if ADX>25 and MACD trending, band touches are continuation signals not reversals.
- + Volume Profile: bounce from lower band near a POC level = support strengthened by supply/demand confluence.

Caveats: never auto-sell on an upper band touch (that's precisely a trend-continuation entry zone); squeeze predicts vol expansion not direction — identify direction with a trend filter first; (20,2) suits daily, (10,2.0) intraday raises sensitivity and noise.
<!-- PROMPT_DIGEST:END -->
