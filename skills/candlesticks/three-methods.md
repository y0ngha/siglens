---
name: Rising/Falling Three Methods Guide
description: Rising Three Methods / Falling Three Methods five-candle continuation pattern guide with Bulkowski measured rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.65
gating:
  tier: gated
  signal_kind: event
  triggers: [rising_three_methods, falling_three_methods]
token_cost: 276
digest_hash: "913413f0"
---

## Overview

Five-candle **continuation** patterns: a long candle, a three-candle pause held inside its range, then a long candle that resumes the move.

- **Rising Three Methods**: long bullish candle → three small candles held within the first candle's high–low range → long bullish candle closing above the first close.
- **Falling Three Methods**: long bearish candle → three small candles held within the first candle's high–low range → long bearish candle closing below the first close.

The core detector requires long first and fifth bodies, three non-long middle candles inside the first candle's high–low range, and the fifth close beyond the first close. It does **not** check the prior trend or the middle candles' colors (Bulkowski's definition expects them to drift against the trend).

## Measured Behavior

- Rising Three Methods — Bulkowski (thepatternsite.com/Rising3Methods.html): **bullish continuation 74%**; overall performance rank **94 of 103**; frequency rank **88** (rare). Tidbit: trade it only when the primary trend is up.
- Falling Three Methods — (thepatternsite.com/Falling3Methods.html): **bearish continuation 71%**; overall performance rank **89 of 103**; frequency rank **91** (rare).
- High continuation rate but low performance rank: the trend usually resumes, yet the follow-through after the pattern has been small compared with other candles.
- Weight 0.65 (weakest label: Falling Three Methods 71%, 65–74% band).

## Signal Interpretation

- Read it as "the pause is over, the prior move resumes" — a continuation, not a turn.
- **Stronger**: a clear prior trend in the pattern's direction (up for Rising, down for Falling); the middle candles drift against the trend on light volume; above-average volume on the fifth candle.
- **Weak**: no prior trend (the pattern then only marks a breakout from a small range); sideways market (ADX < 20).
- Low performance rank → do not overstate the size of the expected move.

## Caveats

- A close back inside the first candle's range after the pattern weakens the continuation reading.
- Never derive a price target from the candles; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Rising/Falling Three Methods Guide
- Interpret only if rising_three_methods or falling_three_methods is listed in the detected-pattern section.
- Shape: long candle → three small candles held inside its high–low range → long same-color candle closing beyond the 1st close. CONTINUATION pattern. The detector does not check the prior trend or the middle candles' colors — verify the trend yourself.
- Measured (Bulkowski, thepatternsite.com/<Rising3Methods|Falling3Methods>.html): Rising bullish continuation 74%, rank 94/103; Falling bearish continuation 71%, rank 89/103. Both rare. High continuation rate but low performance rank → the trend usually resumes but the follow-through has been small; do not overstate the move. Weight 0.65 (weakest label).
- Stronger: clear prior trend in the pattern's direction (Bulkowski: trade Rising only in an uptrend); light-volume pause; above-average 5th-candle volume. Weak: no prior trend; ADX < 20.
- A later close back inside the 1st candle's range weakens the reading.
- Never derive a target from the candles; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
