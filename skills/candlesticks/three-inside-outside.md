---
name: Three Inside / Outside Guide
description: Three Inside Up/Down and Three Outside Up/Down three-candle reversal interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.55
gating:
  tier: gated
  signal_kind: event
  triggers: [three_inside_up, three_inside_down, three_outside_up, three_outside_down]
token_cost: 288
digest_hash: "bb509f34"
---

## Overview

Three-candle reversals built from a two-candle pattern plus a confirmation candle.

- **Three Inside Up**: tall bearish candle → small bullish candle whose body sits inside the first body (a harami) → bullish candle closing above the first candle's open.
- **Three Inside Down**: mirror — tall bullish candle → small bearish inside body → bearish candle closing below the first candle's open.
- **Three Outside Up**: bearish candle → bullish candle whose body engulfs it → bullish candle closing above the second close.
- **Three Outside Down**: mirror — bullish candle → engulfing bearish candle → bearish candle closing below the second close.

The core detector checks the three-candle shape only, not the preceding trend.

## Measured Behavior

- Three Inside Up — Bulkowski (thepatternsite.com/ThreeInsideUp.html): bullish reversal **65%**; overall performance rank **20 of 103**. S&C V.29:11 ("The Eight Best-Performing Candles"): second-best bullish reversal among common candles, average 10-day rise 2.61%.
- Three Inside Down — (thepatternsite.com/ThreeInsideDown.html): bearish reversal **60%**; rank **56**.
- Three Outside Up — (thepatternsite.com/ThreeOutsideUp.html): bullish reversal **75%**; rank **34**.
- Three Outside Down — (thepatternsite.com/ThreeOutsideDown.html): bearish reversal **69%**; rank **39**.
- Bulkowski tidbits (same pages): taller candles perform better; each works best as a retracement against the primary trend that then resumes (e.g. Three Inside/Outside Up during a pullback in an uptrend).
- Weight 0.55 (weakest label: Three Inside Down 60%, 55–64% band). The bullish versions measure stronger than the bearish ones.

## Signal Interpretation

- **Stronger**: the "up" variants; the pattern ends a pullback inside the primary trend; tall candles; above-average volume on the third candle; at support/resistance.
- **Moderate**: clear prior move, average bodies.
- **Weak**: sideways range (ADX < 20); Three Inside Down (near the random end of the band).

## Caveats

- The third candle is already the confirmation; a further close beyond the pattern's far extreme (above its high / below its low) is Bulkowski's breakout test.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Three Inside / Outside Guide
- Interpret only if three_inside_up/down or three_outside_up/down is listed in the detected-pattern section.
- Three Inside = harami + confirmation (3rd candle closes beyond the 1st candle's open). Three Outside = engulfing + confirmation (3rd candle closes beyond the 2nd close). The detector checks shape only — verify the prior trend yourself.
- Measured (Bulkowski, thepatternsite.com/<ThreeInsideUp|ThreeInsideDown|ThreeOutsideUp|ThreeOutsideDown>.html): Inside Up bullish reversal 65%, overall rank 20/103 (S&C V.29:11: 2nd-best common bullish reversal); Inside Down 60%, rank 56; Outside Up 75%, rank 34; Outside Down 69%, rank 39. Bullish variants measure stronger. Weight 0.55 (weakest label).
- Stronger: the pattern ends a pullback inside the primary trend (Bulkowski's best case); tall candles; above-average 3rd-candle volume; at support/resistance. Weak: sideways range (ADX < 20); Three Inside Down is close to random.
- Breakout test = a later close beyond the pattern's far extreme (above its high / below its low).
- Never derive a target from the candles; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
