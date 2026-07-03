---
name: CMF Signal Guide
description: CMF(21) 신호 해석 가이드 — 자금 흐름 방향, 매수/매도 압력, 브레이크아웃 확인
type: indicator_guide
indicators: ['cmf']
confidence_weight: 0.75
usage_roles: [signal, confirmation, measurement]
gating:
  tier: gated
  signal_kind: event
  triggers: [cmf_bullish_flip, cmf_bearish_flip]
token_cost: 501
digest_hash: "3eebe1ab"
---

## Overview

CMF (Chaikin Money Flow), developed by Marc Chaikin, measures the accumulation/distribution pressure over a specified period by combining the Close Location Value (CLV) with volume. CLV determines where the close falls within the high-low range: a close near the high yields a positive CLV, near the low yields a negative CLV. This is then multiplied by volume and summed over the period. The standard period is 21 bars. CMF ranges from -1 to +1.

## Signal Interpretation

### Buying and Selling Pressure

- CMF > 0: net buying pressure — over the lookback period, closes have been weighted toward the upper portion of the daily range with volume support. The market is in accumulation mode.
- CMF < 0: net selling pressure — closes have been weighted toward the lower portion of the daily range. The market is in distribution mode.
- CMF magnitude matters: CMF of +0.25 indicates stronger buying pressure than +0.05. Values above +0.25 or below -0.25 represent significant directional conviction.

### Zero-Line Crossover

- CMF crossing above zero from below: a shift from net selling to net buying — early bullish signal indicating accumulation is beginning to dominate.
- CMF crossing below zero from above: a shift from net buying to net selling — early bearish signal indicating distribution is beginning to dominate.
- Zero-line crossovers are most meaningful when they persist for multiple bars, confirming a genuine shift in capital flow rather than transient noise.

### Breakout Confirmation

- Price breaking above resistance + CMF > 0 and rising: the breakout is supported by genuine buying pressure — high-probability follow-through.
- Price breaking above resistance + CMF < 0 or falling: the breakout lacks volume conviction — higher probability of false breakout or quick reversal.
- Price breaking below support + CMF < 0 and falling: the breakdown is confirmed by selling pressure — downside continuation likely.
- CMF as a breakout filter significantly reduces false breakout entries.

### Divergence Signals

- Bullish divergence: price makes a lower low while CMF makes a higher low → selling pressure is diminishing — potential reversal.
- Bearish divergence: price makes a higher high while CMF makes a lower high → buying pressure is fading — potential reversal.

### Trend Strength Assessment

- CMF consistently above zero for an extended period: sustained accumulation — the uptrend has strong volume backing.
- CMF consistently below zero for an extended period: sustained distribution — the downtrend has strong volume backing.
- CMF oscillating around zero: no clear directional commitment — the market is likely range-bound.

## Recommended Combinations

- CMF + MACD: CMF confirms the volume conviction behind MACD trend signals. A MACD golden cross + CMF > 0 = momentum shift with capital flow support.
- CMF + RSI: RSI provides overbought/oversold context; CMF confirms whether the extreme is backed by volume conviction. RSI oversold + CMF turning positive = strong mean reversion buy signal.
- CMF + OBV: Both measure volume-based accumulation/distribution from different angles. Agreement between rising OBV and positive CMF provides strong volume consensus.
- CMF + Breakout patterns (triangles, rectangles): CMF is an excellent filter for chart pattern breakouts — only act on breakouts where CMF confirms the direction.

## Caveats

- CMF is highly sensitive to the close's position within the high-low range. A close exactly at the midpoint yields a CLV of zero regardless of volume, making that bar's contribution nil.
- CMF uses a fixed lookback window — old data drops off as new data enters. A sudden change in CMF may simply reflect an extreme bar falling out of the window rather than new information.
- CMF does not account for gap moves. A gap up where the close is near the low of a narrow range produces a negative CLV despite overall bullish price action.
- The standard 21-period lookback is suitable for daily charts. For shorter timeframes, 10-period CMF may be more responsive; for weekly analysis, 40 periods may provide smoother signals.
- CMF values rarely reach the theoretical extremes of +1 or -1. In practice, values beyond ±0.4 are exceptional.
- CMF can be distorted on limit-up / limit-down (halt) days: the close is pinned at the locked price while volume accumulates, producing an extreme CLV that does not reflect genuine two-sided trading. Discount CMF readings on halt bars.

<!-- PROMPT_DIGEST:START -->
### CMF Signal Guide
- Chaikin Money Flow, period 21, range −1 to +1. CLV×volume summed over period; close near high → +CLV, near low → −CLV.

Pressure:
- CMF > 0: net buying / accumulation.
- CMF < 0: net selling / distribution.
- Magnitude matters: |CMF| > 0.25 = significant directional conviction (+0.25 stronger than +0.05).

Zero-line crossover:
- Above 0 from below = shift to net buying, early bullish (accumulation dominating).
- Below 0 from above = shift to net selling, early bearish (distribution dominating).
- Most meaningful when it persists for multiple bars (genuine capital-flow shift vs noise).

Breakout confirmation:
- Break resistance + CMF>0 & rising = supported by buying, high follow-through; + CMF<0/falling = lacks conviction, likely false.
- Break support + CMF<0 & falling = confirmed breakdown, downside continuation.

Divergence:
- Bullish: price lower low while CMF higher low → selling diminishing → potential reversal.
- Bearish: price higher high while CMF lower high → buying fading → potential reversal.

Trend strength: consistently >0 extended = sustained accumulation (uptrend backed); <0 = distribution (downtrend backed); oscillating around 0 = range-bound.

Combinations:
- + MACD: MACD golden cross + CMF>0 = momentum shift with capital-flow support.
- + RSI: RSI oversold + CMF turning positive = strong mean-reversion buy.
- + OBV: rising OBV + positive CMF = strong volume consensus.
- + Breakout patterns (triangles/rectangles): excellent filter — only act when CMF confirms direction.

Caveats: sensitive to close position (midpoint close → CLV 0, nil contribution regardless of volume); fixed window (sudden change may be an extreme bar dropping out, not new info); ignores gaps (gap-up close near narrow-range low → negative CLV despite bullish action); 21 = daily standard (10 shorter TF, 40 weekly); values beyond ±0.4 exceptional (rarely reach ±1); distorted on limit-up/down halt bars (close pinned, extreme CLV not genuine) — discount halt bars.
<!-- PROMPT_DIGEST:END -->
