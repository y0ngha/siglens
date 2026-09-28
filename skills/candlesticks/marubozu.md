---
name: Marubozu Guide
description: Marubozu single-candle interpretation guide with Bulkowski measured continuation rates
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [bullish_marubozu, bearish_marubozu]
token_cost: 321
digest_hash: "f893e663"
---

## Overview

A marubozu is a candle that is almost all body (core: body ≥ 90% of the high–low range), so it opens at
one extreme and closes at the other.

- **Bullish (white) Marubozu**: opens at/near the low, closes at/near the high.
- **Bearish (black) Marubozu**: opens at/near the high, closes at/near the low.

Textbook: a same-direction marubozu "confirms" the trend. Measurement does not support that reading.
The core detector checks shape only, not the prior trend.

## Measured Behavior

- White Marubozu — Bulkowski (thepatternsite.com/WhiteMarubozu.html): continuation **56%** of the time — near random; overall performance rank **71 of 103**.
- Black Marubozu — (thepatternsite.com/BlackMarubozu.html): continuation **53%** — near random; overall rank **57**; upward breakouts in 34% of 19,993 samples. Bulkowski: marubozu candles "have been given more weight by candlestick followers than I think they deserve."
- Where it works — Bulkowski, "The Eight Best-Performing Candles" (S&C V.29:11), the **opposite-color** case:
  - A **black** marubozu inside an **uptrend** that then breaks out upward (close above its high) was the #2 common bullish continuation: continuation 53%, average 10-day rise 4.39% (S&C V.29:11).
  - A **white** marubozu inside a **downtrend** that then breaks out downward (close below its low) was the #2 common bearish continuation: continuation 56%, average 10-day drop 3.55% (S&C V.29:11).
- Weight 0.4 (Black Marubozu 53%, <55% band — near random, needs confirmation).

## Signal Interpretation

- **Same color as the trend** (white in an uptrend, black in a downtrend): do not overrate it as trend confirmation — continuation is near a coin flip. At most it shows one-sided pressure for that session.
- **Opposite color to the trend** (black in an uptrend, white in a downtrend): often a temporary counter-move rather than a reversal. The trend-resumption read applies only after price closes beyond the marubozu's far end (above a black one's high in an uptrend, below a white one's low in a downtrend).
- A marubozu breaking a key support/resistance level matters more than one inside a range.
- **Ignore** in sideways ranges (ADX < 20).

## Caveats

- Several marubozu in a row signal an extended move; check RSI for overextension rather than chasing.
- A marubozu on thin volume may be a low-liquidity artifact.
- Never derive a price target from the candle; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Marubozu Guide
- Interpret only if bullish_marubozu or bearish_marubozu is listed in the detected-pattern section.
- Shape: almost all body (core: body ≥ 90% of range), open at one extreme, close at the other. Detector checks shape only — not the prior trend.
- Measured (Bulkowski): White Marubozu continuation 56%, overall rank 71/103 (thepatternsite.com/WhiteMarubozu.html); Black Marubozu continuation 53%, rank 57 (thepatternsite.com/BlackMarubozu.html). Near random — needs confirmation. Weight 0.4.
- Same color as the trend (white in uptrend / black in downtrend): do NOT call it trend confirmation — continuation is near a coin flip.
- Opposite color to the trend: often a temporary counter-move, not a reversal. Bulkowski, "The Eight Best-Performing Candles" (S&C V.29:11): a black marubozu in an uptrend that then closes above its high resumed the uptrend (avg 10-day +4.39%); a white marubozu in a downtrend that then closes below its low resumed the downtrend (56%, avg 10-day −3.55%). Apply this only after that confirming close.
- A marubozu breaking key S/R matters more than one inside a range; ignore in sideways ranges (ADX < 20). Consecutive marubozu = extended move → check RSI, don't chase.
- Never derive a target; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
