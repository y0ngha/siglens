---
name: Morning/Evening Star Guide
description: 3-candle reversal pattern interpretation guide for Morning Star and Evening Star
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.65
gating:
  tier: gated
  signal_kind: event
  triggers: [morning_star, evening_star, morning_doji_star, evening_doji_star]
token_cost: 312
digest_hash: "f16bfbdb"
---

## Overview

Three-candle reversals.

- **Morning Star**: (1) tall bearish candle → (2) small body gapped below the first body → (3) bullish candle closing above the midpoint of the first body.
- **Evening Star**: (1) tall bullish candle → (2) small body gapped above the first body → (3) bearish candle closing below the midpoint of the first body.
- **Doji Star** variants: the middle candle is a doji.

The core detector requires a body gap between candles 1 and 2 and a third close past the first body's
midpoint; it does not check the prior trend.

## Measured Behavior

- Morning Star — Bulkowski (thepatternsite.com/MorningStar.html): bullish reversal **78%** (reversal-rate rank 6); overall performance rank **12 of 103**.
- Evening Star — (thepatternsite.com/EveningStar.html): bearish reversal **72%**; overall rank **4**.
- Morning Doji Star — (thepatternsite.com/MorningDojiStar.html): bullish reversal **76%**; overall rank **25**.
- Evening Doji Star — (thepatternsite.com/EveningDojiStar.html): bearish reversal **71%**; overall rank **30**.
- The doji variants are **not** more reliable — each measures slightly below its plain version.
- All four are fairly rare (frequency ranks 66–81). For the plain stars Bulkowski notes the best-move figures rest on only 108 (morning) and 63 (evening) samples, so expect them to shrink.
- Bulkowski tidbits (same pages): taller candles perform better; the morning star works best as a downward retracement inside a primary uptrend.
- Weight 0.65 (weakest label: Evening Doji Star 71%, 65–74% band).

## Signal Interpretation

- **Stronger**: clear prior trend into the pattern; tall first and third candles; the third close penetrates deep into the first body; above-average volume on the third candle; at support/resistance; RSI extreme or a MACD histogram turn.
- **Moderate**: third candle closes just past the midpoint; average volume.
- **Weak**: sideways range (ADX < 20); middle body nearly as large as the outer candles.

## Caveats

- In 24h markets (crypto) body gaps are rare, so these patterns seldom form — scrutinize a detection there.
- Very short timeframes are noisy; reliability drops.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Morning/Evening Star Guide (3-candle reversal)
- Interpret only if morning_star, evening_star, morning_doji_star or evening_doji_star is listed in the detected-pattern section.
- Shape: tall candle → small body gapped beyond the first body (doji in the Doji Star variants) → opposite candle closing past the first body's midpoint. Detector checks shape only — verify the prior trend yourself.
- Measured (Bulkowski, thepatternsite.com): Morning Star bullish reversal 78%, overall rank 12/103 (MorningStar.html); Evening Star bearish reversal 72%, rank 4 (EveningStar.html); Morning Doji Star 76%, rank 25 (MorningDojiStar.html); Evening Doji Star 71%, rank 30 (EveningDojiStar.html). The doji variants are NOT more reliable. Rare → small samples. Weight 0.65.
- Stronger: clear prior trend; tall outer candles; deep third-candle penetration into the first body; above-average third-candle volume; at S/R; RSI extreme or MACD histogram turn. Morning Star works best as a pullback low inside a primary uptrend.
- Weak: sideways range (ADX < 20) or a middle body nearly as large as the outer candles.
- Body gaps are rare in 24h markets (crypto) — scrutinize a detection there.
- Never derive a target; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
