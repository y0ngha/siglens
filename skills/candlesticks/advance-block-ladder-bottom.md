---
name: Advance Block / Ladder Bottom Guide
description: Advance Block and Ladder Bottom candlestick interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [advance_block, ladder_bottom]
token_cost: 330
digest_hash: "e1395682"
digest_text_hash: "be7bc367"
---

## Overview

- **Advance Block**: three bullish candles, each body smaller than the one before and each upper shadow taller — the advance is losing thrust. Textbook: bearish reversal of an uptrend.
- **Ladder Bottom** (core version, three candles): two bearish candles (the second tall, opening inside the first body), then a bullish candle that opens above the second open and closes above the first candle's open. Textbook: bullish reversal of a downtrend. Bulkowski's ladder bottom is a **five**-candle pattern, so the core's three-candle version only approximates it.

The core detector checks shape only, not the prior trend.

## Literature (Bulkowski, not measured by SIGLENS)

- Advance Block — Bulkowski (thepatternsite.com/AdvanceBlock.html): textbook bearish reversal, but in his data a **bullish continuation 64%** (bearish reversal only 36%); overall performance rank **54 of 103**. Tidbit: it breaks out upward most often; reversals work best when it forms as an upward retracement inside a downtrend.
- Ladder Bottom — (thepatternsite.com/LadderBottom.html, five-candle definition): bullish reversal **56%** — near random; overall rank **41**. Indicative only for the core's three-candle version.
- Weight 0.4 (Advance Block 36% in its claimed direction — near random, needs confirmation).

## Signal Interpretation

- **Advance Block**: read as fading momentum inside an uptrend, not a top. A bearish read needs a close below the pattern's low, preferably at resistance or with a bearish momentum divergence.
- **Ladder Bottom**: a weak bounce hint; needs a follow-through close above the pattern's high.
- **Ignore** both in sideways ranges (ADX < 20).

## Caveats

- Say when Bulkowski's study contradicts the textbook, in words: "Advance Block is textbook bearish, but in Bulkowski's study of US stocks it more often acted as a bullish continuation."
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Advance Block / Ladder Bottom Guide
- Interpret only if advance_block or ladder_bottom is listed in the detected-pattern section.
- Advance Block: three bullish candles with shrinking bodies and growing upper shadows (fading thrust). Ladder Bottom (core 3-candle version): two bearish candles, then a bullish candle closing above the first candle's open; Bulkowski's version has five candles. Detector checks shape only — not the prior trend.
- Bulkowski's study (literature, US stocks; not measured by SIGLENS, so describe it in words: never quote its percentages, call them a probability or restate them as a ratio such as 50% or 반반): Advance Block is textbook bearish but more often acted as a bullish continuation than as a reversal, a below-average performer. Ladder Bottom (his five-candle definition, indicative only here) showed no reliable direction in his study (no usable edge either way). Near random — needs confirmation. Weight 0.4.
- Advance Block = fading momentum in an uptrend, not a top; bearish only after a close below the pattern's low, ideally at resistance. Say when Bulkowski's study contradicts the textbook.
- Ladder Bottom = weak bounce hint; needs a close above the pattern's high.
- Ignore in sideways ranges (ADX < 20). Never derive a target; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
