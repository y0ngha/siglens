---
name: EMA Signal Guide
description: EMA 신호 해석 가이드 — 지지/저항, 기울기, 크로스오버, 다중 기간 정렬
type: indicator_guide
indicators: ['ema']
confidence_weight: 0.8
---

## Overview

EMA (Exponential Moving Average) applies exponentially decaying weights to historical price data, giving more influence to recent prices compared to a simple moving average. This makes EMA more responsive to price changes and better suited for trend detection in dynamic markets. The project uses EMA periods of 9, 20, 21, and 60.

## Signal Interpretation

### EMA as Dynamic Support and Resistance

- In an uptrend, price pulling back to EMA(20) or EMA(21) and then bouncing upward is a classic pullback-to-support entry. The longer the trend, the more reliable this retest is.
- In a downtrend, price rallying up to EMA(20) or EMA(21) and then reversing is a pullback-to-resistance sell opportunity.
- EMA(60) acts as medium-term trend structure support/resistance. A decisive close above or below EMA(60) signals a potential trend regime change.
- EMA(9) is highly responsive and best used for short-term momentum confirmation rather than support/resistance levels.

### EMA Slope (Trend Direction)

- EMA rising steeply: strong bullish momentum. Price is accelerating above the average.
- EMA rising slowly or flattening: momentum is losing strength — potential consolidation or reversal ahead.
- EMA declining: bearish trend in progress. Strength is proportional to the angle of decline.

### EMA Crossover (Multi-Period)

- EMA(9) crossing above EMA(20/21): short-term momentum has shifted bullish — an early entry signal in an uptrend context.
- EMA(9) crossing below EMA(20/21): short-term momentum has turned bearish.
- EMA(20/21) crossing above EMA(60): a medium-term bullish crossover, confirming a stronger structural trend shift.
- EMA(20/21) crossing below EMA(60): a medium-term bearish crossover.

### EMA Alignment (Bull/Bear Stack)

- All EMAs aligned in ascending order (EMA9 > EMA20 > EMA60): a strongly bullish configuration where all timeframes agree — favors long positions.
- All EMAs aligned in descending order (EMA9 < EMA20 < EMA60): a strongly bearish configuration.
- EMAs intertwined or crossing each other: no clear trend — avoid trend-following strategies.

### Price Position Relative to EMAs

- Price above all EMAs: bullish structure. Use dips toward EMA(20) as entry opportunities.
- Price below all EMAs: bearish structure. Use rallies toward EMA(20) as short entry opportunities.
- Price between EMA(20) and EMA(60): transitional zone; wait for a decisive break in either direction.

## Key Combinations

- EMA + ADX: When ADX > 25 and price is above EMA(60), a trend-following long has structural confirmation.
- EMA + MACD: EMA(20) alignment with MACD crossover direction provides a powerful two-indicator confirmation.
- EMA + RSI: Use EMA as trend direction filter; RSI confirms whether momentum is aligned.

## Caveats

- EMA is a lagging indicator. It reflects what has already happened and should not be used to predict exact tops or bottoms.
- In choppy, low-volatility markets, EMA crossovers generate noise. Always filter by ADX or price structure before acting on crossovers.
- Longer-period EMAs (60) move slowly and require more bars before a meaningful signal emerges — premature signals occur when price whipsaws around the EMA.
