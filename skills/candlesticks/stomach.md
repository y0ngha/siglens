---
name: Above/Below the Stomach Guide
description: Above the Stomach / Below the Stomach two-candle reversal interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.55
gating:
  tier: gated
  signal_kind: event
  triggers: [above_the_stomach, below_the_stomach]
token_cost: 281
digest_hash: "54b13340"
---

## Overview

Two-candle reversals where the second candle opens past the midpoint of the first candle's body, in the opposite color.

- **Above the Stomach**: long bearish candle → bullish candle that opens (and closes) at or above the midpoint of the first body. Textbook context: a downtrend.
- **Below the Stomach**: long bullish candle → bearish candle that opens (and closes) at or below the midpoint of the first body. Textbook context: an uptrend.

The core detector requires a **long-bodied first candle** and checks the two-candle shape only. It does **not** check the prior trend, while Bulkowski's rates were measured on patterns that follow a trend (downtrend for Above, uptrend for Below). The detector also checks the stomach last, so a pair that already matches another two-candle label (engulfing, harami, piercing, etc.) keeps that label instead.

## Measured Behavior

- Above the Stomach — Bulkowski (thepatternsite.com/AboveStomach.html): bullish reversal **66%**; overall performance rank **31 of 103**. S&C V.29:11 ("The Eight Best-Performing Candles"): ranked first among the common bullish reversals, average 10-day rise 2.74%.
- Below the Stomach — (thepatternsite.com/BelowStomach.html): bearish reversal **60%**; rank **59 of 103** (middle of the pack).
- Bulkowski tidbits (same pages): Above works best as a downward retracement inside a rising primary trend, and within a third of the yearly low; Below works best as an upward retracement inside a falling primary trend.
- Weight 0.55 (weakest label: Below the Stomach 60%, 55–64% band). The bullish version measures clearly stronger.

## Signal Interpretation

- **Check the trend first.** The measured rate applies only after a prior move in the opposite direction (decline before Above, rise before Below). Without that move the pattern is just a two-bar swing inside a range.
- **Stronger**: Above the Stomach ending a pullback inside an uptrend; near support (Above) / resistance (Below); above-average volume on the second candle.
- **Weak**: sideways range (ADX < 20); Below the Stomach (close to the random end of its band).

## Caveats

- A later close beyond the pattern's far extreme (above its high for Above, below its low for Below) is the confirmation; before that it is a clue only.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Above/Below the Stomach Guide
- Interpret only if above_the_stomach or below_the_stomach is listed in the detected-pattern section.
- Above = long bearish candle, then a bullish candle opening/closing at or above the 1st body's midpoint. Below = long bullish candle, then a bearish candle opening/closing at or below that midpoint. The detector requires the long 1st body but does NOT check the trend.
- Measured (Bulkowski, thepatternsite.com/<AboveStomach|BelowStomach>.html): Above bullish reversal 66%, rank 31/103 (S&C V.29:11: best common bullish reversal); Below bearish reversal 60%, rank 59. Weight 0.55 (weakest label).
- The rates assume a prior move against the pattern (decline before Above, rise before Below). Check the trend yourself; with no such move, treat it as range noise.
- Stronger: Above ending a pullback inside an uptrend (Bulkowski's best case); at support/resistance; above-average 2nd-candle volume. Weak: ADX < 20; Below is close to random.
- Confirmation = a later close beyond the pattern's far extreme.
- Never derive a target from the candles; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
