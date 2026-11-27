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
token_cost: 291
digest_hash: "e13a1d2c"
digest_text_hash: "853e8301"
---

## Overview

Four candles: three same-color candles with consecutively extending closes, then a fourth candle that opens beyond the third close and closes beyond the first candle's open, wiping out the whole run.

- **Bullish Three-Line Strike**: three bullish candles with rising closes → a bearish candle opening at/above the third close and closing below the first open.
- **Bearish Three-Line Strike**: three bearish candles with falling closes → a bullish candle opening at/below the third close and closing above the first open.

The core detector checks the four-candle shape only, not the preceding trend.

## Name vs Reversal Direction

The traditional names call these **continuation** patterns (the "bullish" one continues up, the "bearish" one continues down). Bulkowski's tests show the opposite: both usually act as **reversals in the direction of the fourth candle**.

- The core maps the trend by the **reversal** direction Bulkowski found: `bullish_three_line_strike` → bearish, `bearish_three_line_strike` → bullish. The trend label shown next to the pattern in the prompt already follows this — do not flip it back to match the name.

## Literature (Bulkowski, not measured by SIGLENS)

- Bullish Three-Line Strike — Bulkowski (thepatternsite.com/ThreeLineStrikeBull.html): acts as a **bearish reversal 65%**; overall performance rank **2 of 103**; frequency rank **95 of 103** (rare).
- Bearish Three-Line Strike — (thepatternsite.com/ThreeLineStrikeBear.html): acts as a **bullish reversal 84%**; overall performance rank **1 of 103**; frequency rank **94 of 103** (rare).
- Bulkowski tidbits (same pages): the bearish version performs best within a third of the yearly low and in a downward retracement of a rising primary trend; the bullish version performs best when tall and in a bear market.
- Weight 0.65 (weakest label: Bullish Three-Line Strike 65%, 65–74% band). The bearish-named version measures far stronger.

## Signal Interpretation

- Read the fourth candle as the signal: a bullish strike bar (bearish_three_line_strike) → bullish reading; a bearish strike bar (bullish_three_line_strike) → bearish reading.
- **Stronger**: bearish_three_line_strike ending a pullback inside an uptrend or near the yearly low; a tall fourth candle; at support/resistance.
- **Weak**: sideways range (ADX < 20); very small candles.
- Rare pattern — few samples behind any single chart; describe Bulkowski's result in words, not as certainty or a probability.

## Caveats

- A later close beyond the fourth candle's far extreme is the breakout test.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Three-Line Strike Guide
- Interpret only if bullish_three_line_strike or bearish_three_line_strike is listed in the detected-pattern section.
- Shape: three same-color candles with extending closes, then a 4th candle that opens beyond the 3rd close and closes beyond the 1st open. The detector checks shape only — not the prior trend.
- Name vs Bulkowski's study (literature, US stocks; not measured by SIGLENS, so describe it in words: never quote its percentages, call them a probability or restate them as a ratio such as 50% or 반반): the names say continuation, but both usually reversed in the 4th candle's direction — bullish_three_line_strike as a BEARISH reversal, bearish_three_line_strike as a BULLISH reversal — and he ranked them his two best-performing candles. Both rare. Weight 0.65 (weakest label).
- The trend label shown with the pattern already follows that reversal direction — keep it; do not flip it to match the name.
- Stronger: bearish_three_line_strike ending a pullback in an uptrend or near the yearly low; tall 4th candle; at S/R. Weak: ADX < 20.
- Never derive a target from the candles; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
