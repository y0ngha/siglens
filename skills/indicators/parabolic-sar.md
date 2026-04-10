---
name: Parabolic SAR Signal Guide
description: Parabolic SAR(0.02, 0.20) 신호 해석 가이드 — 추세 방향, 반전 감지, 트레일링 스톱
type: indicator_guide
indicators: ['parabolicSar']
confidence_weight: 0.8
---

## Overview

Parabolic SAR (Stop and Reverse), developed by J. Welles Wilder in 1978, plots dots above or below the price to indicate trend direction and provide trailing stop-loss levels. The indicator uses an acceleration factor (AF) that starts at 0.02 and increases by 0.02 each time a new extreme point is reached, up to a maximum of 0.20. This acceleration mechanism causes the SAR to converge toward price over time, eventually triggering a reversal signal.

## Signal Interpretation

### Trend Direction

- SAR dots below price: the market is in an uptrend — maintain long positions. The dots provide a rising trailing stop.
- SAR dots above price: the market is in a downtrend — maintain short positions or stay out. The dots provide a falling trailing stop.
- The position of the dots (above vs. below) is the primary directional signal — it provides a clear, binary trend assessment.

### Trend Reversal (Flip Signal)

- SAR flips from below to above price: the uptrend has ended — a bearish reversal signal. Consider closing long positions or initiating short positions.
- SAR flips from above to below price: the downtrend has ended — a bullish reversal signal. Consider closing short positions or initiating long positions.
- Flip signals are most reliable in trending markets. In ranging markets, flips occur frequently and produce whipsaw losses.

### Dot Spacing as Momentum Indicator

- Dots accelerating away from price (widening gap): trend momentum is strong and increasing — high confidence in trend continuation.
- Dots converging toward price (narrowing gap): trend momentum is weakening — the SAR is catching up to price, and a flip is approaching. Tighten risk management.
- When dots and price converge after a long trend, the eventual flip signal is more likely to indicate a genuine reversal rather than a whipsaw.

### Trailing Stop Application

- Use SAR values directly as trailing stop-loss levels. Each bar's SAR value defines the exit point for the current trend direction.
- For long positions: set stop-loss at the current SAR dot (below price). If price closes below SAR, exit.
- For short positions: set stop-loss at the current SAR dot (above price). If price closes above SAR, exit.

## Recommended Combinations

- Parabolic SAR + ADX: Use ADX as a trend filter — only follow SAR signals when ADX > 25 (trending). When ADX < 20 (ranging), SAR flip signals are unreliable. This combination eliminates the majority of whipsaw losses.
- Parabolic SAR + MACD: MACD confirms the trend direction behind a SAR flip. A SAR bullish flip + MACD golden cross = high-conviction long entry.
- Parabolic SAR + RSI: RSI provides overbought/oversold context. A SAR bearish flip while RSI is in overbought territory (> 70) strengthens the sell signal. A SAR bullish flip while RSI is oversold (< 30) strengthens the buy signal.
- Parabolic SAR + ATR: Use ATR to adjust the AF parameters. In high-volatility environments, a slower initial AF (0.01) reduces false flips. In low-volatility environments, the standard 0.02 works well.

## Caveats

- Parabolic SAR performs poorly in ranging or choppy markets. Frequent flips generate whipsaw losses — always filter with a trend strength indicator (ADX, EMA slope).
- The standard parameters (AF start 0.02, AF max 0.20) are optimized for daily charts. Shorter timeframes may benefit from higher AF start values; longer timeframes from lower values.
- SAR is a lagging indicator that follows price action — it does not predict reversals, it confirms them after they begin.
- In strongly trending markets, SAR can stay on one side for extended periods. Do not exit a position solely because SAR has been running for many bars — let the flip signal determine the exit.
- Gap openings can cause the SAR to instantly flip, even if the underlying trend is intact. Verify gap-triggered flips with volume and other indicators.
