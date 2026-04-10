---
name: ATR Signal Guide
description: ATR(14) 신호 해석 가이드 — 변동성 측정, 손절 설정, 포지션 사이징, 브레이크아웃 확인
type: indicator_guide
indicators: ['atr']
confidence_weight: 0.85
---

## Overview

ATR (Average True Range), developed by J. Welles Wilder in 1978, measures market volatility by calculating the average of True Range over a defined period. Unlike most indicators, ATR does not indicate price direction — it quantifies the magnitude of price movement. The standard period is 14 bars. ATR is a foundational building block for volatility-based indicators such as Supertrend, Keltner Channel, and many adaptive stop-loss systems.

## Signal Interpretation

### Volatility Assessment

- Rising ATR: volatility is expanding — the market is experiencing larger price swings. This typically occurs during trend initiations, breakouts, or panic sell-offs. Active trend-following strategies are most effective in high-ATR environments.
- Falling ATR: volatility is contracting — price movement is compressing. This typically signals consolidation, range-bound behavior, or the late stage of a trend. Mean-reversion strategies tend to outperform when ATR is declining.
- ATR at historically low levels for the asset: a volatility squeeze is in effect — expect a significant breakout in either direction. Combine with Bollinger Squeeze or Donchian Channel for directional confirmation.

### Stop-Loss Placement

- ATR-based trailing stop (Chandelier Exit): Place the stop at the highest high minus N × ATR (for long positions) or lowest low plus N × ATR (for short positions). The multiplier N typically ranges from 1.5 to 3.0.
  - N = 1.5: tight stop — useful for short-term or scalping trades; higher stop-out frequency.
  - N = 2.0: standard stop — balances protection with noise tolerance for swing trading.
  - N = 3.0: wide stop — suitable for position trading and volatile instruments.
- Initial stop-loss: Entry price minus 2 × ATR is a common default for long entries. This distances the stop far enough from normal noise to avoid premature exits.

### Position Sizing

- Fixed-risk position sizing formula: Position Size = Account Risk / (ATR × Multiplier).
  - Example: If account risk per trade is $500 and ATR(14) = $2.50 with a 2× multiplier, position size = $500 / ($2.50 × 2) = 100 shares.
- ATR-based position sizing ensures that each trade carries roughly the same dollar risk regardless of the asset's volatility — a critical principle in professional portfolio management.

### Breakout Confirmation

- A breakout accompanied by ATR expanding above its 20-period average suggests the move is driven by genuine volatility expansion — higher probability of follow-through.
- A breakout with ATR flat or declining suggests low conviction — higher probability of false breakout or quick reversal.

## Recommended Combinations

- ATR + Parabolic SAR: ATR calibrates stop distances while Parabolic SAR provides trailing stop levels — together they form a robust trend-exit system.
- ATR + Bollinger Bands: When Bollinger bandwidth compresses and ATR hits historical lows simultaneously, the impending breakout signal has dual volatility confirmation.
- ATR + ADX: ATR measures volatility magnitude; ADX measures trend strength. ATR rising + ADX rising = strengthening trend with expanding volatility — the highest-confidence trend-following environment.
- ATR + Donchian Channel: Donchian breakout filtered by ATR expansion reduces false breakout entries significantly.

## Caveats

- ATR does not indicate direction. A high ATR reading means large price swings, but says nothing about whether the next move will be up or down.
- ATR is heavily influenced by gap moves. A single large gap can spike ATR for the entire lookback period, so use caution around earnings announcements or major news events.
- Different asset classes have vastly different ATR scales. Always compare ATR as a percentage of price (ATR / Close × 100) when comparing volatility across instruments.
- ATR is a lagging indicator — it reflects past volatility, not future volatility. Use it for calibrating risk parameters, not for predicting directional moves.
