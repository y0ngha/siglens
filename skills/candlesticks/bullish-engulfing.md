---
name: Bullish Engulfing Guide
description: Bullish Engulfing two-candle reversal interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.55
gating:
  tier: gated
  signal_kind: event
  triggers: [bullish_engulfing]
token_cost: 280
digest_hash: "f73c8705"
---

## Overview

Two candles. The first is bearish; the second is bullish and its **body** opens at or below the prior
close and closes at or above the prior open, so the second body covers the first. Shadows are ignored.

The textbook pattern requires a preceding downtrend. The core detector checks the two-candle shape only —
it does not check the trend — so the prior decline must be verified from the chart.

## Measured Behavior

- Bulkowski (thepatternsite.com/BullEngulfing.html): bullish reversal **63%** of the time; overall performance rank **84 of 103** candles; frequency rank 12 (very common).
- Weak follow-through (same page): even after an upward breakout, the best average 10-day move is a drop of 1.18%. The pattern often turns price, but the turn rarely runs far.
- Bulkowski tidbits (same page): taller candles perform better; avoid the pattern when the primary trend is down.
- Weight 0.55 (55–64% band of the candle weight rule).

## Signal Interpretation

- **Stronger**: pullback inside a larger uptrend or at a support level; second body clearly taller than recent candles; above-average volume on the second candle; RSI oversold or a lower Bollinger band touch.
- **Moderate**: after a short decline, average-size bodies, no nearby support.
- **Weak**: sideways range (ADX < 20), or inside a strong primary downtrend.

## Caveats

- Judge bodies, not wicks.
- Confirmation = a later close above the pattern's high (Bulkowski's upward breakout). Until then it is a reversal hint, not a trend change.
- In gapless 24h markets (crypto) each open sits at the prior close, so the shape forms more easily — require extra confirmation.
- Never derive a price target from the candle; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Bullish Engulfing Guide
- Interpret only if bullish_engulfing is listed in the detected-pattern section.
- Shape: bearish candle, then a bullish candle whose BODY opens ≤ prior close and closes ≥ prior open (ignore wicks). The detector checks shape only — verify the preceding decline yourself (EMA20 slope, lower swing lows).
- Measured (Bulkowski, thepatternsite.com/BullEngulfing.html): bullish reversal 63%; overall performance rank 84/103 — it often turns price, but the follow-through is usually short. Weight 0.55.
- Stronger: pullback inside a larger uptrend or at support; 2nd body taller than recent candles; above-average 2nd-candle volume; RSI oversold / lower Bollinger touch. Weak: sideways range (ADX < 20) → say "sideways range — engulfing reliability is low"; also weak inside a strong primary downtrend (Bulkowski: avoid).
- Confirmation = a later close above the pattern's high; until then call it a reversal hint, not a trend change.
- Gapless markets (crypto) form it more easily — require extra confirmation.
- Never derive a target from the candle; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
