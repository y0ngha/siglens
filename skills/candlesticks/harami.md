---
name: Harami Pattern Guide
description: Harami candlestick pattern (Bullish/Bearish Harami, Harami Cross) interpretation guide
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [bullish_harami, bearish_harami, bullish_harami_cross, bearish_harami_cross]
token_cost: 298
digest_hash: "9e616c30"
---

## Overview

Two candles: a tall first candle (core: body ≥ 60% of its range), then a second candle whose body sits
entirely inside the first body — an inside bar that shows the prior move stalling.

- **Bullish Harami**: tall bearish candle → small body inside it. Textbook: bullish reversal of a decline.
- **Bearish Harami**: tall bullish candle → small body inside it. Textbook: bearish reversal of an advance.
- **Harami Cross**: the second candle is a doji (body ≤ 10% of its range).

The core detector checks shape only, not the prior trend.

## Measured Behavior

- Bullish Harami — Bulkowski (thepatternsite.com/HaramiBull.html): bullish reversal **53%**; overall performance rank **38 of 103**.
- Bearish Harami — (thepatternsite.com/HaramiBear.html): textbook bearish reversal, but measured as a **bullish continuation 53%**; overall rank **72**. Tidbit: near the top of a trend channel a downward breakout is more likely.
- Bullish Harami Cross — (thepatternsite.com/HaramiCrossBull.html): acts as a **bearish continuation 55%** (bullish reversal 45%); overall rank **50**.
- Bearish Harami Cross — (thepatternsite.com/HaramiCrossBear.html): acts as a **bullish continuation 57%** (bearish reversal 43%); overall rank **80**.
- The cross versions are **not** stronger — they measure slightly worse than the plain harami.
- Bulkowski tidbit on all four pages: taller candles perform better.
- Weight 0.4 (every label < 55% in its claimed direction — near random, needs confirmation).

## Signal Interpretation

- Read a harami as a **pause / volatility contraction**, not a reversal. Direction comes from the next close beyond the first candle's high or low.
- **More relevant**: after an extended trend, at a support/resistance level (bearish harami near the top of a channel), with RSI at an extreme or a shrinking MACD histogram.
- **Ignore** in sideways ranges (ADX < 20).

## Caveats

- If the second body extends beyond the first body, it is not a harami.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Harami Pattern Guide (Bullish/Bearish Harami, Harami Cross)
- Interpret only if a harami or harami_cross label is listed in the detected-pattern section.
- Shape: tall first candle, second body fully inside the first body (inside bar); cross = second candle is a doji. Detector checks shape only — not the prior trend.
- Measured (Bulkowski, thepatternsite.com): Bullish Harami reversal 53%, overall rank 38/103 (HaramiBull.html). Bearish Harami acts as a bullish continuation 53%, rank 72 (HaramiBear.html). Bullish Harami Cross acts as a bearish continuation 55%, rank 50 (HaramiCrossBull.html). Bearish Harami Cross acts as a bullish continuation 57%, rank 80 (HaramiCrossBear.html). All near random — needs confirmation. The cross is NOT stronger than the plain harami. Weight 0.4.
- Read as a pause / volatility contraction, not a reversal. Direction = the next close beyond the first candle's high or low; until then say "harami — awaiting a breakout".
- More relevant after an extended trend, at S/R, with RSI extreme or a shrinking MACD histogram; taller candles work better. Ignore in sideways ranges (ADX < 20).
- Never derive a target; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
