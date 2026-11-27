---
name: Upside Gap Two Crows / Downside Gap Two Rabbits Guide
description: Upside Gap Two Crows and Downside Gap Two Rabbits three-candle interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [upside_gap_two_crows, downside_gap_two_rabbits]
token_cost: 304
digest_hash: "6e263c60"
digest_text_hash: "31b4e8e0"
---

## Overview

- **Upside Gap Two Crows**: tall bullish candle → bearish candle whose body gaps above the first body → second bearish candle that opens above the first body and closes at or below the prior bearish close. Textbook: bearish reversal of an uptrend.
- **Downside Gap Two Rabbits**: the mirror — tall bearish candle → bullish candle whose body gaps below the first body → second bullish candle that opens below the first body and closes at or above the prior bullish close. Textbook: bullish reversal of a downtrend.

The core detector checks shape only, not the prior trend.

## Literature (Bulkowski, not measured by SIGLENS)

- Upside Gap Two Crows — Bulkowski (thepatternsite.com/UpGapTwoCrows.html): textbook bearish reversal, but in his data a **bullish continuation 60%** (bearish reversal only 40%); overall performance rank **74 of 103**. Tidbit: within a third of the yearly high it acts as a continuation most often.
- Downside Gap Two Rabbits: no published rate (not in Bulkowski's catalog) — treat as a weak hint.
- Weight 0.4 (Upside Gap Two Crows 40% in its claimed direction; Two Rabbits has no published rate).

## Signal Interpretation

- Do **not** call a reversal from either pattern. For Two Crows, Bulkowski's study found the uptrend more often continued.
- The only actionable read is a later close beyond the pattern's far extreme (below the low for Two Crows, above the high for Two Rabbits), ideally at an existing support/resistance level.
- **Ignore** in sideways ranges (ADX < 20); gaps are rare in 24h markets (crypto).

## Caveats

- Say when Bulkowski's study contradicts the textbook, in words: "Upside Gap Two Crows is textbook bearish, but in Bulkowski's study of US stocks it more often acted as a bullish continuation."
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Upside Gap Two Crows / Downside Gap Two Rabbits Guide
- Interpret only if upside_gap_two_crows or downside_gap_two_rabbits is listed in the detected-pattern section.
- Two Crows: tall bullish candle → two bearish candles gapped above its body, the second closing at/below the first's close. Two Rabbits: exact mirror after a tall bearish candle. Detector checks shape only — not the prior trend.
- Bulkowski's study (literature, US stocks; not measured by SIGLENS, so describe it in words: never quote its percentages, call them a probability or restate them as a ratio such as 50% or 반반): Upside Gap Two Crows is textbook bearish but more often acted as a bullish continuation than as a reversal, a below-average performer. Downside Gap Two Rabbits: no published result — weak hint. Near random — needs confirmation. Weight 0.4.
- Never call a reversal from either; say when Bulkowski's study contradicts the textbook.
- Actionable only on a later close beyond the pattern's far extreme (below its low / above its high), ideally at existing S/R.
- Ignore in sideways ranges (ADX < 20); gaps are rare in 24h markets (crypto).
- Never derive a target from the candles; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
