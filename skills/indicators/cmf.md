---
name: CMF Signal Guide
description: CMF(21) 신호 해석 가이드 — 자금 흐름 방향, 매수/매도 압력, 브레이크아웃 확인
type: indicator_guide
indicators: ['cmf']
confidence_weight: 0.75
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
