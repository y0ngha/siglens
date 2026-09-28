---
name: Bearish Engulfing Guide
description: Bearish Engulfing two-candle reversal interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.75
gating:
  tier: gated
  signal_kind: event
  triggers: [bearish_engulfing]
token_cost: 296
digest_hash: "5f95477e"
---

## Overview

Two candles. The first is bullish; the second is bearish and its **body** opens at or above the prior
close and closes at or below the prior open, so the second body covers the first. Shadows are ignored.

The textbook pattern requires a preceding uptrend. The core detector checks the two-candle shape only —
it does not check the trend — so the prior advance must be verified from the chart.

## Measured Behavior

- Bulkowski (thepatternsite.com/BearEngulfing.html): bearish reversal **79%** of the time (reversal-rate rank 5); overall performance rank **91 of 103**; frequency rank 11 (very common).
- The low overall rank comes from failures: upward breakouts rank 103 / 100 (bull / bear market), while downward breakouts rank 25 / 21 (same page).
- Bulkowski, "The Eight Best-Performing Candles" (S&C V.29:11): the best bearish reversal among common candles — after a downward breakout, the average 10-day drop is 3.56% in a bull market and 5.92% in a bear market.
- Bulkowski tidbit (same page): taller candles perform better.
- Weight 0.75 (≥75% band; candle weights are capped at 0.75).

## Signal Interpretation

- **Stronger**: clear prior uptrend; second body clearly taller than recent candles; above-average volume on the second candle; RSI overbought or an upper Bollinger band touch; near resistance.
- **Moderate**: after a short rise, average-size bodies.
- **Weak**: sideways range (ADX < 20).

## Caveats

- Judge bodies, not wicks.
- Confirmation = a later close below the pattern's low. If price instead closes above the pattern's high, drop the bearish read — and do not expect a strong rally from that failure either.
- In gapless 24h markets (crypto) the shape forms more easily — require extra confirmation.
- Never derive a price target from the candle; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Bearish Engulfing Guide
- Interpret only if bearish_engulfing is listed in the detected-pattern section.
- Shape: bullish candle, then a bearish candle whose BODY opens ≥ prior close and closes ≤ prior open (ignore wicks). The detector checks shape only — verify the preceding advance yourself (EMA20 slope, higher swing highs).
- Measured (Bulkowski, thepatternsite.com/BearEngulfing.html): bearish reversal 79%; overall performance rank 91/103 because failed (upward) breakouts perform worst of all candles. S&C V.29:11 ("Eight Best-Performing Candles"): after a downward breakout, average 10-day drop 3.56% (bull market) / 5.92% (bear market). Weight 0.75.
- Stronger: clear prior uptrend; 2nd body taller than recent candles; above-average 2nd-candle volume; RSI overbought / upper Bollinger touch; near resistance. Weak: sideways range (ADX < 20) → say "sideways range — engulfing reliability is low".
- Confirmation = a later close below the pattern's low. A close above the pattern's high voids the bearish read.
- Gapless markets (crypto) form it more easily — require extra confirmation.
- Never derive a target from the candle; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
