---
name: Counterattack / Belt Hold Guide
description: Counterattack Line and Belt Hold candlestick interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [bullish_counterattack_line, bearish_counterattack_line, bullish_belt_hold, bearish_belt_hold]
token_cost: 322
digest_hash: "9f1eb2d4"
digest_text_hash: "637ac799"
---

## Overview

- **Bullish Belt Hold** (one candle): a tall bullish candle that opens at or near its low (almost no lower shadow). Textbook: bullish reversal after a decline.
- **Bearish Belt Hold** (one candle): a tall bearish candle that opens at or near its high (almost no upper shadow). Textbook: bearish reversal after an advance.
- **Bullish Counterattack Line** (two candles): tall bearish candle → tall bullish candle closing at (nearly) the same price as the prior close.
- **Bearish Counterattack Line** (two candles): tall bullish candle → tall bearish candle closing at (nearly) the same price as the prior close.

Bulkowski catalogs counterattack lines under their other name, **meeting lines**. The core detector checks
shape only (0.2% close tolerance for counterattack), not the prior trend.

## Literature (Bulkowski, not measured by SIGLENS)

- Bullish Belt Hold — Bulkowski (thepatternsite.com/BeltHoldBull.html): bullish reversal **71%**; overall performance rank **62 of 103** (reverses often, but the 10-day move is weak); frequency rank 22.
- Bearish Belt Hold — (thepatternsite.com/BeltHoldBear.html): bearish reversal **68%**; overall rank **63**; frequency rank 19.
- Bullish Counterattack (bullish meeting lines, thepatternsite.com/MeetingLinesBull.html): bullish reversal **56%** — near random; overall rank **18**.
- Bearish Counterattack (bearish meeting lines, thepatternsite.com/MeetingLinesBear.html): acts as a **bullish continuation 51%** (bearish reversal 49%) — random; overall rank **16**. Tidbit (same page, citing the book p. 575): a lower close on the day after the pattern suggests a reversal 67–70% of the time.
- Weight 0.4 (weakest label: Bearish Counterattack 49%, <55% band — near random, needs confirmation).

## Signal Interpretation

- **Belt Hold**: a real but short-lived turn signal. Stronger when the candle is taller than recent candles (Bulkowski: tall belt holds perform significantly better) and sits at support/resistance.
- **Counterattack**: direction is near random; the value is that once price breaks out, it tends to trend (good overall ranks). Wait for the next close — for the bearish version, Bulkowski's confirmation is a lower next close.
- **Weak**: sideways ranges (ADX < 20) for all four.

## Caveats

- Belt holds are common single candles; do not call a trend change from one.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Counterattack / Belt Hold Guide
- Interpret only if a counterattack_line or belt_hold label is listed in the detected-pattern section.
- Belt Hold: one tall candle opening at its extreme (bullish opens at the low, bearish at the high). Counterattack: tall candle → tall opposite candle closing at ~the same price (Bulkowski's "meeting lines"). The detector checks shape only — verify the prior trend yourself.
- Bulkowski's study (literature, US stocks; not measured by SIGLENS, so describe it in words: never quote its percentages, call them a probability or restate them as a ratio such as 50% or 반반): both Belt Holds reversed in most of his cases but performed below average — reverse often, move little. Both Counterattacks showed no reliable direction in his study (no usable edge either way), yet ranked among his better performers once price broke out. Weight 0.4 (weakest label; near random — needs confirmation).
- Belt Hold: short-lived turn; stronger when taller than recent candles and at S/R. Counterattack: direction random, but trends once it breaks; for the bearish version Bulkowski's confirmation is a lower next close.
- Weak in sideways ranges (ADX < 20). Never call a trend change from one candle; never derive a target — cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
