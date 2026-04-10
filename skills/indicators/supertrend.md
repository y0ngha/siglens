---
name: Supertrend Signal Guide
description: Supertrend(10, 3.0) 신호 해석 가이드 — ATR 기반 추세 추종, 동적 지지/저항, 추세 전환
type: indicator_guide
indicators: ['supertrend']
confidence_weight: 0.8
---

## Overview

Supertrend is an ATR-based trend-following indicator that plots a single line above or below the price, acting as dynamic support (in uptrends) or resistance (in downtrends). It is calculated using the midpoint of the high-low range adjusted by an ATR multiplier. The standard parameters are an ATR period of 10 and a multiplier of 3.0. Supertrend is non-repainting — once a signal is confirmed at bar close, it does not change retroactively, making it reliable for backtesting.

## Signal Interpretation

### Trend Direction

- Supertrend line below price (typically green): the market is in an uptrend. The Supertrend line acts as dynamic support — price is expected to stay above this level while the trend persists.
- Supertrend line above price (typically red): the market is in a downtrend. The Supertrend line acts as dynamic resistance — price is expected to stay below this level while the trend persists.

### Trend Reversal (Color Flip)

- Supertrend flips from above to below price (red to green): a bullish reversal signal — price has closed above the downtrend resistance line. Consider initiating long positions.
- Supertrend flips from below to above price (green to red): a bearish reversal signal — price has closed below the uptrend support line. Consider closing long positions or initiating shorts.
- Flip signals are confirmed only on bar close — intrabar crossings are not valid signals.

### Dynamic Support and Resistance

- During an uptrend, the Supertrend line rises gradually, tracking below price. Each bar's Supertrend value serves as a trailing stop-loss level for long positions.
- During a downtrend, the Supertrend line falls gradually, tracking above price. Each bar's Supertrend value serves as a trailing stop-loss level for short positions.
- Price touching the Supertrend line during a trend is a test of support/resistance — a close beyond the line triggers a reversal signal; a bounce confirms trend continuation.

### Distance from Supertrend

- Large gap between price and Supertrend: strong trend momentum — the trend is well-established and far from reversal.
- Narrowing gap between price and Supertrend: trend momentum is decelerating — potential reversal approaching. Tighten risk management.

## Recommended Combinations

- Supertrend + RSI: RSI provides overbought/oversold context. A Supertrend bullish flip with RSI below 50 (rising from oversold) is a high-probability entry. A Supertrend bearish flip with RSI above 50 (falling from overbought) strengthens the sell signal.
- Supertrend + EMA(20/50): Use EMA as a structural trend filter. Only follow Supertrend buy signals when price is above EMA(50); only follow sell signals when below.
- Supertrend + MACD: A Supertrend flip confirmed by MACD crossover in the same direction provides dual-system trend confirmation.
- Supertrend + Volume: A Supertrend flip accompanied by above-average volume has higher follow-through probability than a low-volume flip.

## Caveats

- Supertrend is a lagging indicator — it confirms trends after they have begun, not before. Do not expect early reversal detection.
- In choppy, ranging markets, Supertrend generates frequent flip signals (whipsaws), leading to losses. Filter with ADX > 25 to ensure a trending environment before acting on Supertrend signals.
- The standard (10, 3.0) parameters suit daily charts for swing trading. For more sensitive signals (intraday), use (7, 2.0). For less sensitive signals (position trading), use (14, 4.0).
- A higher multiplier reduces flip frequency but increases lag. A lower multiplier increases sensitivity but adds noise. Adjust based on the asset's volatility characteristics.
- Supertrend does not account for volume — a low-volume flip is equally weighted as a high-volume flip. Always cross-reference with volume.
