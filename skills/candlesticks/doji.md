---
name: Doji Pattern Guide
description: Interpretation guide for Doji-family and Spinning Top candlestick patterns (Standard, Long-legged, Dragonfly, Gravestone, Spinning Top)
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [doji, gravestone_doji, dragonfly_doji, spinning_top]
token_cost: 369
digest_hash: "924ff676"
---

## Overview

Indecision candles: the open and close are close together, so neither side won the session.

- **Doji** (standard / long-legged): body ≤ 10% of the high–low range (core threshold), shadows on both sides. Long-legged = both shadows very long.
- **Dragonfly Doji**: doji with (almost) no upper shadow — a long lower shadow, close near the high.
- **Gravestone Doji**: doji with (almost) no lower shadow — a long upper shadow, close near the low.
- **Spinning Top**: small body (≤ 40% of the range in the core) with shadows on both sides — a milder form of indecision.

The core detector checks shape only; it does not check the prior trend.

## Measured Behavior

All Bulkowski figures below are near random — needs confirmation.

- Dragonfly Doji (thepatternsite.com/Dragonfly.html): reversal **50%**; overall performance rank **98 of 103**; it breaks out upward most often. Bulkowski, "The Eight Best-Performing Candles" (S&C V.29:11): its reversal-rate rank is only 55/103, but after an **uptrend** with a close below its low it was the second-best common bearish reversal (average 10-day move 3.89%) — the textbook "bullish" reading is not what the data shows.
- Gravestone Doji (thepatternsite.com/Gravestone.html): bearish reversal **51%**; overall rank **77**. Tidbit: ignore it in congestion areas.
- Standard doji: Bulkowski publishes no single rate; his trend-context versions are all near 50% — northern doji (after an uptrend) bullish continuation **51%**, rank 83 (thepatternsite.com/NorthernDoji.html); southern doji (after a downtrend) bullish reversal **52%**, rank 78 (thepatternsite.com/SouthernDoji.html); long-legged doji bullish continuation **51%**, rank 37 (thepatternsite.com/LongLegDoji.html).
- Spinning Top: black reversal **51%**, rank 73 (thepatternsite.com/SpinTopBlack.html); white reversal **50%**, rank 69 (thepatternsite.com/SpinTopWhite.html). The two most common candles (frequency ranks 1 and 2).
- Weight 0.4 (every label < 55%).

## Signal Interpretation

- A doji or spinning top marks a **pause**, never a direction by itself. Direction comes from the next close beyond the candle's high (up) or low (down).
- **More relevant**: at the end of an extended trend, at a support/resistance level, with RSI at an extreme or price at a Bollinger band. Taller candles (longer shadows) move farther after the breakout (Bulkowski tidbits on the gravestone and long-legged doji pages).
- **Ignore**: inside a sideways range (ADX < 20) — there it is only reduced volatility.

## Caveats

- Do not describe a dragonfly as bullish or a gravestone as bearish without the confirming close; the measured rates are coin flips.
- Spinning tops are so common that one alone carries almost no information.
- Never derive a price target from the candle; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Doji Pattern Guide (Standard, Long-legged, Dragonfly, Gravestone, Spinning Top)
- Interpret only if doji, dragonfly_doji, gravestone_doji or spinning_top is listed in the detected-pattern section.
- Shapes (core): doji = body ≤ 10% of range; dragonfly = doji with ~no upper shadow; gravestone = doji with ~no lower shadow; spinning top = body ≤ 40% of range with both shadows. Detector checks shape only — not the prior trend.
- Measured (Bulkowski, thepatternsite.com): Dragonfly reversal 50%, overall rank 98/103 (Dragonfly.html; S&C V.29:11: its best case is a close below its low after an uptrend — bearish, not the textbook bullish). Gravestone bearish reversal 51%, rank 77 (Gravestone.html). Doji after uptrend continues 51% (NorthernDoji.html), after downtrend reverses 52% (SouthernDoji.html). Spinning top reversal 50–51% (SpinTopBlack.html / SpinTopWhite.html). All near random — needs confirmation. Weight 0.4.
- Read as a pause, never a direction. Direction = the next close beyond the candle's high (up) or low (down); until then say "indecision — awaiting confirmation".
- More relevant at the end of an extended trend, at S/R, with RSI extreme or a Bollinger band touch; longer shadows move farther after the breakout.
- In a sideways range (ADX < 20) say "Doji appeared in a sideways range — difficult to interpret as a reversal signal". A lone spinning top carries almost no information.
- Never derive a target; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
