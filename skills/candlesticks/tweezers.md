---
name: Tweezers Pattern Guide
description: Tweezers Top/Bottom candlestick pattern interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [tweezers_top, tweezers_bottom]
token_cost: 261
digest_hash: "184f5dda"
---

## Overview

Two adjacent candles sharing (nearly) the same extreme.

- **Tweezers Top**: bullish candle, then a candle with the same high (the core allows 0.2% tolerance). Textbook: bearish reversal at the end of an uptrend — the shared high marks resistance.
- **Tweezers Bottom**: bearish candle, then a candle with the same low. Textbook: bullish reversal at the end of a downtrend — the shared low marks support.

The core detector checks the matching extreme only; it does not check the prior trend.

## Measured Behavior

- Tweezers Top — Bulkowski (thepatternsite.com/TweezersTop.html, ~20,000 samples): acts as a **bullish continuation 56%** of the time, i.e. a bearish reversal only 44%; overall performance rank **81 of 103**. Tidbit: trade in the direction of the prevailing trend.
- Tweezers Bottom — (thepatternsite.com/TweezersBottom.html): acts as a **bearish continuation 52%**, i.e. a bullish reversal only 48%; overall rank **44**.
- Both are near random — needs confirmation. Measurement contradicts the textbook reversal reading.
- Weight 0.4 (<55% band).

## Signal Interpretation

- Treat the shared high/low as a **minor level to watch**, not a reversal call.
- **Meaningful only** when the level coincides with a known support/resistance, the candles are tall, and a later close breaks away from the level (below the pair for a Top, above it for a Bottom).
- **Ignore** in sideways ranges (ADX < 20) — matching highs/lows are common noise there.

## Caveats

- Never state a reversal from tweezers alone; the measured odds favor the existing trend.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Tweezers Pattern Guide
- Interpret only if tweezers_top or tweezers_bottom is listed in the detected-pattern section.
- Shape: two adjacent candles with (nearly) equal highs (Top, after a bullish candle) or equal lows (Bottom, after a bearish candle). The detector checks shape only — not the prior trend.
- Measured (Bulkowski): Tweezers Top acts as a bullish continuation 56% (bearish reversal only 44%), overall rank 81/103 (thepatternsite.com/TweezersTop.html); Tweezers Bottom acts as a bearish continuation 52% (reversal 48%), rank 44 (thepatternsite.com/TweezersBottom.html). Near random — needs confirmation; the textbook reversal reading is not supported. Weight 0.4.
- Use the shared high/low only as a minor level to watch. It matters only if it coincides with known S/R and a later close breaks away from the pair (below it for a Top, above it for a Bottom).
- Ignore in sideways ranges (ADX < 20). Never call a reversal from tweezers alone.
- Never derive a target from the candles; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
