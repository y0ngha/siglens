---
name: Gap Continuation Guide (Tasuki / Neck)
description: Upside/Downside Tasuki Gap and On-Neck/In-Neck continuation candlestick interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [upside_gap_tasuki, downside_gap_tasuki, on_neck, in_neck]
token_cost: 331
digest_hash: "af64812b"
---

## Overview

Textbook continuation patterns: a counter-trend candle that fails to undo the trend.

- **Upside Tasuki Gap**: bullish candle → bullish candle gapping above the first high → bearish candle opening inside the second body and closing into the gap without closing it.
- **Downside Tasuki Gap**: mirror — bearish, bearish gapping below the first low, then a bullish candle that closes into the gap without closing it.
- **On Neck**: tall bearish candle → bullish candle opening below the prior low and closing at (about) the prior low.
- **In Neck**: tall bearish candle → bullish candle opening below the prior low and closing just above the prior low, around the prior close.

The core detector checks shape only, not the prior trend, and scores all four as direction-neutral.

## Measured Behavior

- Upside Tasuki Gap — Bulkowski (thepatternsite.com/UpsideTasukiGap.html): bullish continuation **57%**; overall performance rank **5 of 103**; rare (704 examples). Tidbit: after a downward breakout the stock sometimes returns to the launch price.
- Downside Tasuki Gap — (thepatternsite.com/DownsideTasukiGap.html): textbook bearish continuation, but measured as a **bullish reversal 54%** (continuation only 46%); overall rank **23**. Tidbit: a 4–6 week decline containing one is likely to see a reversal.
- On Neck — (thepatternsite.com/OnNeck.html): bearish continuation **56%**; overall rank **33**.
- In Neck — (thepatternsite.com/InNeck.html): bearish continuation **53%** (reversal 47%); overall rank **17**.
- All four sit near random on direction; measurement overrides the textbook for the Downside Tasuki Gap. Several trend well once they break out (good overall ranks).
- Weight 0.4 (weakest label: Downside Tasuki Gap, 46% in its claimed direction — near random, needs confirmation).

## Signal Interpretation

- Read these as **pauses**, not direction calls. The direction comes from the next close beyond the pattern's high or low.
- Upside Tasuki Gap: if the gap later closes (price trades back through it), the continuation read is void.
- Downside Tasuki Gap: do not assume the decline continues — measured odds lean slightly to a bounce.
- Neck patterns: a weak bounce that stalls at the prior low; continuation is only slightly favored.
- **Ignore** in sideways ranges (ADX < 20).

## Caveats

- 24h markets (crypto) rarely print true gaps, so gap patterns there deserve extra scrutiny.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Gap Continuation Guide (Tasuki / Neck)
- Interpret only if upside_gap_tasuki, downside_gap_tasuki, on_neck or in_neck is listed in the detected-pattern section.
- Tasuki: two same-direction candles with a gap, then a counter candle closing into the gap without closing it. On/In Neck: tall bearish candle → bullish candle opening below the prior low and closing at (On) or just above (In) the prior low. Detector checks shape only; core scores all four as neutral.
- Measured (Bulkowski): Upside Tasuki bullish continuation 57%, overall rank 5/103 (thepatternsite.com/UpsideTasukiGap.html); Downside Tasuki is textbook bearish continuation but acts as a bullish reversal 54% (thepatternsite.com/DownsideTasukiGap.html, rank 23); On Neck bearish continuation 56%, rank 33 (thepatternsite.com/OnNeck.html); In Neck 53%, rank 17 (thepatternsite.com/InNeck.html). Near random on direction — needs confirmation. Weight 0.4.
- Read as a pause, not a direction call; direction = the next close beyond the pattern's high/low. Say so when measurement contradicts the textbook (Downside Tasuki).
- Upside Tasuki: if the gap later closes, drop the continuation read.
- Ignore in sideways ranges (ADX < 20); gaps are rare in 24h markets (crypto).
- Never derive a target from the candles; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
