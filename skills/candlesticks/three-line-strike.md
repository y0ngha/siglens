---
name: Three-Line Strike Guide
description: Bullish/Bearish Three-Line Strike four-candle pattern guide — Bulkowski measured direction (opposite of the name) and rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.65
gating:
  tier: gated
  signal_kind: event
  triggers: [bullish_three_line_strike, bearish_three_line_strike]
token_cost: 268
digest_hash: "fc5e863f"
---

## Overview

Four candles: three same-color candles with consecutively extending closes, then a fourth candle that opens beyond the third close and closes beyond the first candle's open, wiping out the whole run.

- **Bullish Three-Line Strike**: three bullish candles with rising closes → a bearish candle opening at/above the third close and closing below the first open.
- **Bearish Three-Line Strike**: three bearish candles with falling closes → a bullish candle opening at/below the third close and closing above the first open.

The core detector checks the four-candle shape only, not the preceding trend.

## Name vs Measured Direction

The traditional names call these **continuation** patterns (the "bullish" one continues up, the "bearish" one continues down). Bulkowski's tests show the opposite: both usually act as **reversals in the direction of the fourth candle**.

- The core maps the trend by the **measured** direction: `bullish_three_line_strike` → bearish, `bearish_three_line_strike` → bullish. The trend label shown next to the pattern in the prompt already follows this — do not flip it back to match the name.

## Measured Behavior

- Bullish Three-Line Strike — Bulkowski (thepatternsite.com/ThreeLineStrikeBull.html): acts as a **bearish reversal 65%**; overall performance rank **2 of 103**; frequency rank **95 of 103** (rare).
- Bearish Three-Line Strike — (thepatternsite.com/ThreeLineStrikeBear.html): acts as a **bullish reversal 84%**; overall performance rank **1 of 103**; frequency rank **94 of 103** (rare).
- Bulkowski tidbits (same pages): the bearish version performs best within a third of the yearly low and in a downward retracement of a rising primary trend; the bullish version performs best when tall and in a bear market.
- Weight 0.65 (weakest label: Bullish Three-Line Strike 65%, 65–74% band). The bearish-named version measures far stronger.

## Signal Interpretation

- Read the fourth candle as the signal: a bullish strike bar (bearish_three_line_strike) → bullish reading; a bearish strike bar (bullish_three_line_strike) → bearish reading.
- **Stronger**: bearish_three_line_strike ending a pullback inside an uptrend or near the yearly low; a tall fourth candle; at support/resistance.
- **Weak**: sideways range (ADX < 20); very small candles.
- Rare pattern — few samples behind any single chart; state the measured odds, not certainty.

## Caveats

- A later close beyond the fourth candle's far extreme is the breakout test.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Three-Line Strike Guide
- Interpret only if bullish_three_line_strike or bearish_three_line_strike is listed in the detected-pattern section.
- Shape: three same-color candles with extending closes, then a 4th candle that opens beyond the 3rd close and closes beyond the 1st open. The detector checks shape only — not the prior trend.
- Name vs measured: the names say continuation, but both usually reverse in the 4th candle's direction. bullish_three_line_strike acts as a BEARISH reversal 65%, rank 2/103; bearish_three_line_strike acts as a BULLISH reversal 84%, rank 1/103 (Bulkowski, thepatternsite.com/<ThreeLineStrikeBull|ThreeLineStrikeBear>.html). Both rare (frequency rank 94–95/103). Weight 0.65 (weakest label).
- The trend label shown with the pattern already follows the measured direction — keep it; do not flip it to match the name.
- Stronger: bearish_three_line_strike ending a pullback in an uptrend or near the yearly low; tall 4th candle; at S/R. Weak: ADX < 20.
- Never derive a target from the candles; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
