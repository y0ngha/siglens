---
name: Three Soldiers/Crows Guide
description: 3-candle reversal pattern interpretation guide for Three White Soldiers and Three Black Crows
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.75
gating:
  tier: gated
  signal_kind: event
  triggers: [three_white_soldiers, three_black_crows]
token_cost: 304
digest_hash: "542ff51f"
---

## Overview

Three consecutive tall candles in the same direction (core: each body ≥ 60% of its range), each opening
inside the prior body and closing beyond it.

- **Three White Soldiers**: three tall bullish candles, each closing higher. Textbook: bullish reversal of a decline.
- **Three Black Crows**: three tall bearish candles, each closing lower. Textbook: bearish reversal of an advance.

The core detector checks shape only, not the prior trend.

## Measured Behavior

- Three White Soldiers — Bulkowski (thepatternsite.com/ThreeWhiteSoldiers.html): bullish reversal **82%** (reversal-rate rank 3 of 103); overall performance rank **32** — price does not trend far after the breakout.
- Three Black Crows — (thepatternsite.com/ThreeBlackCrows.html): bearish reversal **78%**; overall rank **3**.
- Part of the high rate is mechanical (Bulkowski, same pages): the pattern closes near its own extreme, so a breakout in that direction is easy to score.
- Bulkowski tidbits: soldiers that form as an upward retracement inside a downtrend often see the downtrend continue; taller crows perform better.
- Weight 0.75 (weakest label: Three Black Crows 78%, ≥75% band; candle weights are capped at 0.75).

## Signal Interpretation

- **Stronger**: clear opposing trend before the pattern; tall bodies with short shadows; rising volume across the three candles; a break of EMA(20) or a key level; RSI moving from neutral toward an extreme.
- **Moderate**: bodies tall but with visible shadows; flat volume.
- **Weak**: after a large move already in the pattern's direction (exhaustion risk); soldiers inside a larger downtrend (Bulkowski: often only a retracement).

## Caveats

- An exceptionally long third candle signals overextension — do not chase.
- Near major resistance/support, consider a failed breakout.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Three Soldiers/Crows Guide (3-candle reversal)
- Interpret only if three_white_soldiers or three_black_crows is listed in the detected-pattern section.
- Shape: three tall same-direction candles, each opening inside the prior body and closing beyond it. Detector checks shape only — verify the opposing prior trend yourself.
- Measured (Bulkowski): Three White Soldiers bullish reversal 82%, overall rank 32/103 — modest follow-through (thepatternsite.com/ThreeWhiteSoldiers.html); Three Black Crows bearish reversal 78%, rank 3 (thepatternsite.com/ThreeBlackCrows.html). Part of the rate is mechanical: the pattern closes near its own extreme, so the breakout is easy. Weight 0.75.
- Stronger: clear opposing trend before it; tall bodies, short shadows; rising volume across the three; EMA(20) or key-level break; RSI moving from neutral toward an extreme.
- Weak: after a large move already in the pattern's direction (exhaustion); soldiers inside a larger downtrend are often only a retracement (Bulkowski).
- An exceptionally long third candle → "caution for potential overheating", don't chase. Near major S/R consider a failed breakout.
- Never derive a target; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
