---
name: MA Signal Guide
description: MA signal interpretation guide — golden/dead cross, support/resistance levels, and multi-MA alignment
type: indicator_guide
indicators: ['ma']
confidence_weight: 0.8
---

## Overview

MA (Simple Moving Average) calculates the arithmetic mean of closing prices over a specified period. SMA is unweighted and therefore moves more slowly than EMA, making it better suited for identifying medium-to-long term trend direction and structural support/resistance levels. The project uses MA periods of 5, 20, 60, 120, and 200.

## Signal Interpretation

### MA as Support and Resistance

- MA(20): short-term trend support in uptrends; resistance in downtrends. Frequently tested in active markets.
- MA(60): medium-term trend structure. Acts as a meaningful inflection point — a close above or below MA(60) often signals a significant shift.
- MA(120) and MA(200): long-term structural levels. The 200-day MA is one of the most widely watched levels by institutional traders. Price holding above MA(200) indicates a long-term bull market structure.
- In an uptrend, multiple MAs aligned in ascending order function collectively as a support zone.

### Golden Cross and Dead Cross

- Golden Cross: MA(20) or MA(60) crosses above MA(120) or MA(200) — a medium-to-long term bullish signal indicating trend structure improvement. Most significant when ADX is rising or volume confirms the move.
- Dead Cross: MA(20) or MA(60) crosses below MA(120) or MA(200) — a medium-to-long term bearish signal indicating deteriorating trend structure.
- Note: MA crossovers are lagging signals that confirm trend shifts already in progress, not predict them.

### MA Slope and Trend Strength

- All MAs rising and fanning out (wider spacing): trend is strengthening — momentum is building.
- MAs converging toward each other: trend momentum is weakening; potential consolidation or reversal.
- MA(5) is the most responsive short-term average. When MA(5) is steeply above MA(20), price is in an accelerated move.

### Multi-MA Alignment

- Price above MA(5) > MA(20) > MA(60) > MA(120) > MA(200): the most bullish structural configuration — all timeframe trends are aligned upward.
- The reverse ordering (MA200 > MA120 > MA60 > MA20 > MA5, with price below all): the most bearish structural configuration.
- Price between MAs rather than clearly above or below all: transitional or ranging environment.

### Mean Reversion Context

- When price is significantly above MA(200), mean reversion pressure increases. Historically, price tends to return toward the long-term MA during corrections.
- Price deviating more than 10–15% from MA(200) in either direction signals an extreme reading.

## Key Combinations

- MA + Volume: A golden cross accompanied by rising volume is more reliable than one on declining volume.
- MA + RSI: Use MA(60) or MA(200) position to determine trend regime; RSI then provides overbought/oversold context within that regime.
- MA + MACD: MA alignment confirms the structural trend; MACD crossover identifies the timing entry within that trend.
- MA + Bollinger Bands: The Bollinger middle band is MA(20) itself. MA structure provides the underlying trend context.

## Caveats

- SMA lags more than EMA because it weights all periods equally. In fast-moving markets, SMA support/resistance levels may be broken before the SMA catches up.
- MA(200) is widely observed and can act as a self-fulfilling support/resistance level due to the sheer number of market participants referencing it.
- Golden and dead crosses are most reliable on daily timeframes. On minute or hourly charts, they produce frequent false signals.
- Flat, horizontal MAs indicate no trend. Trend-following strategies using MAs are ineffective in this context.
