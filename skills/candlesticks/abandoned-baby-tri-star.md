---
name: Abandoned Baby / Tri-Star Guide
description: Abandoned Baby and Tri-Star rare three-candle doji reversal interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [bullish_abandoned_baby, bearish_abandoned_baby, bullish_triple_star, bearish_triple_star]
token_cost: 351
digest_hash: "35c368e2"
digest_text_hash: "808af7fc"
---

## Overview

Rare three-candle reversals built around doji candles and gaps.

- **Bullish Abandoned Baby**: tall bearish candle → doji that gaps fully below it (no shadow overlap) → bullish candle that gaps fully above the doji.
- **Bearish Abandoned Baby**: mirror — tall bullish candle → doji gapped fully above → bearish candle gapped fully below the doji.
- **Bullish Tri-Star**: three doji, the second gapping below the first, the third closing up.
- **Bearish Tri-Star**: three doji, the second gapping above the first, the third closing down.

The core detector checks the shape and gaps only, not the prior trend.

## Literature (Bulkowski, not measured by SIGLENS)

- Bullish Abandoned Baby — Bulkowski (thepatternsite.com/AbandonBabyBull.html): bullish reversal **70%**; overall performance rank **9 of 103**; frequency rank 92 (only 293 examples in 4.7 million candles). Tidbit: forms at the end of short downtrends.
- Bearish Abandoned Baby — (thepatternsite.com/AbandonBaby.html): bearish reversal **69%**; overall rank **64**; frequency rank 96.
- Bullish Tri-Star — (thepatternsite.com/TriStarBull.html): bullish reversal **60%**; overall rank **28**.
- Bearish Tri-Star — (thepatternsite.com/TriStarBear.html): bearish reversal **52%** — near random; overall rank **76**.
- All four are rare, so the statistics rest on small samples.
- Weight 0.4 (weakest label: Bearish Tri-Star 52%, <55% band — near random, needs confirmation).

## Signal Interpretation

- **Abandoned Baby**: the most credible of the four (≈70% reversal). Stronger with tall outer candles, clean gaps on both sides of the doji, and a location at support/resistance.
- **Tri-Star**: weak; the bearish version is near random. Treat as indecision until a close beyond the pattern's high/low.
- In 24h markets (crypto) true gaps are rare, so these patterns seldom form — a detection there deserves extra scrutiny.

## Caveats

- Confirmation = a later close beyond the pattern's far extreme (above its high / below its low).
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Abandoned Baby / Tri-Star Guide
- Interpret only if bullish/bearish_abandoned_baby or bullish/bearish_triple_star is listed in the detected-pattern section.
- Abandoned Baby: tall candle → doji gapped fully away (no shadow overlap) → candle gapped fully back the other way. Tri-Star: three doji, the middle gapped beyond the first, the third closing in the new direction. The detector checks shape/gaps only — verify the prior trend yourself.
- Bulkowski's study (literature, US stocks; not measured by SIGLENS, so describe it in words: never quote its percentages, call them a probability or restate them as a ratio such as 50% or 반반): Bullish Abandoned Baby reversed in most of his cases and was among his best performers; Bearish Abandoned Baby also reversed in most of his cases but performed below average; Bullish Tri-Star reversed somewhat more often than not with an above-average rank; Bearish Tri-Star showed no reliable direction in his study (no usable edge either way). All rare → small samples. Weight 0.4 (weakest label).
- Abandoned Baby is the credible one: stronger with tall outer candles, clean gaps, at S/R. Tri-Star = indecision until a close beyond the pattern's high/low.
- Gaps are rare in 24h markets (crypto) — scrutinize a detection there.
- Confirmation = a later close beyond the pattern's far extreme. Never derive a target; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
