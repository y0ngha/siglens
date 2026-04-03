---
name: Bollinger Bands Signal Guide
description: Bollinger Bands(20,2) signal interpretation guide — squeeze, band walk, breakout, and mean reversion
type: indicator_guide
indicators: ['bollinger']
confidence_weight: 0.85
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
