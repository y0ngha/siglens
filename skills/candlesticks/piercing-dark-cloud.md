---
name: Piercing Line / Dark Cloud Cover Guide
description: Piercing Line and Dark Cloud Cover two-candle reversal interpretation guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.55
gating:
  tier: gated
  signal_kind: event
  triggers: [piercing_line, dark_cloud_cover]
token_cost: 296
digest_hash: "a1878d4f"
---

## Overview

Two-candle reversals where the second candle closes deep into, but not beyond, the first body.

- **Piercing Line** (bullish): a tall bearish candle, then a bullish candle that opens below the prior close and closes above the midpoint of the prior body but below its open.
- **Dark Cloud Cover** (bearish): a tall bullish candle, then a bearish candle that opens above the prior close and closes below the midpoint of the prior body but above its open.

The textbook version needs a gap beyond the prior candle's extreme; the core detector only requires an
open beyond the prior close and does not check the prior trend. Verify the trend from the chart.

## Measured Behavior

- Piercing Line — Bulkowski (thepatternsite.com/Piercing.html): bullish reversal **64%** of the time; overall performance rank **13 of 103**. Tidbits: taller candles perform better; avoid it when the primary trend is down.
- Dark Cloud Cover — Bulkowski (thepatternsite.com/DarkCloudCover.html): bearish reversal **60%** of the time; overall performance rank **22 of 103**. Tidbit: it breaks out downward most often.
- Both turn price only modestly more often than chance, but when the breakout comes the trend tends to carry (good overall ranks).
- Weight 0.55 (weaker label: Dark Cloud Cover 60%, 55–64% band).

## Signal Interpretation

- **Stronger**: clear prior trend into the pattern; tall bodies; the second close penetrates well past the midpoint; at support (Piercing) or resistance (Dark Cloud); above-average volume on the second candle.
- **Moderate**: short prior move, average bodies.
- **Weak**: sideways range (ADX < 20); Piercing inside a strong primary downtrend.

## Caveats

- Confirmation = a later close beyond the pattern's far extreme (above the high for Piercing, below the low for Dark Cloud). Until then it is a hint.
- If the second candle closes beyond the first body entirely, it is an engulfing, not this pattern.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Piercing Line / Dark Cloud Cover Guide
- Interpret only if piercing_line or dark_cloud_cover is listed in the detected-pattern section.
- Piercing (bullish): tall bearish candle → bullish candle opening below the prior close and closing above the prior body's midpoint but below its open. Dark Cloud (bearish): mirror after a tall bullish candle. The detector checks shape only — verify the prior trend yourself.
- Measured (Bulkowski): Piercing bullish reversal 64%, overall rank 13/103 (thepatternsite.com/Piercing.html); Dark Cloud bearish reversal 60%, overall rank 22/103 (thepatternsite.com/DarkCloudCover.html). Turns only modestly more often than chance, but trends reasonably once it breaks. Weight 0.55.
- Stronger: clear prior trend; tall bodies; deep penetration past the midpoint; at support (Piercing) / resistance (Dark Cloud); above-average 2nd-candle volume. Weak: sideways range (ADX < 20); Piercing inside a strong primary downtrend (Bulkowski: avoid).
- Confirmation = a later close beyond the pattern's far extreme (above its high / below its low). Call it a hint until then.
- Never derive a target from the candles; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
