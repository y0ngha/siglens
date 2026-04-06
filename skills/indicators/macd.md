---
name: MACD Signal Guide
description: MACD(12,26,9) 신호 해석 가이드 — 라인 크로스오버, 히스토그램, 제로라인, 다이버전스
type: indicator_guide
indicators: ['macd']
confidence_weight: 0.9
---

## Overview

MACD (Moving Average Convergence Divergence) is computed as the difference between a short-period EMA and a long-period EMA, creating a momentum oscillator that also tracks trend direction. The standard settings are EMA(12), EMA(26), and a 9-period signal EMA. Three components drive analysis: the MACD line, the signal line, and the histogram.

## Signal Interpretation

### MACD Line vs. Signal Line Crossover

- MACD line crosses above signal line (Golden Cross): short-term momentum has turned bullish — a buy signal. Most reliable when the crossover occurs below the zero line and momentum is accelerating.
- MACD line crosses below signal line (Dead Cross): short-term momentum has turned bearish — a sell signal. Most reliable when the crossover occurs above the zero line.
- In choppy, ranging markets, crossover signals generate frequent false positives. Confirm with ADX or Bollinger Band width before acting.

### Histogram Analysis

- Histogram expanding positively (each bar taller than the last): bullish momentum is intensifying — trend continuation likely.
- Histogram shrinking from a positive peak: bullish momentum is weakening — prepare for potential reversal or pullback.
- Histogram expanding negatively: bearish momentum is intensifying.
- Histogram shrinking from a negative trough: bearish momentum is weakening — potential recovery.
- The histogram peak or trough often precedes the actual price reversal, giving it a leading indicator quality.

### Zero-Line Crossover

- MACD line crosses above zero: the short-period EMA is now above the long-period EMA — a medium-term bullish signal indicating structural trend shift.
- MACD line crosses below zero: the short-period EMA is now below the long-period EMA — a medium-term bearish signal.

### Divergence Signals

- Bearish divergence: price makes a higher high while MACD histogram or MACD line makes a lower high → momentum is weakening despite rising price — potential reversal.
- Bullish divergence: price makes a lower low while MACD histogram or MACD line makes a higher low → downside momentum is fading — potential recovery.
- MACD divergence is among the most reliable technical reversal signals. Best used at key support/resistance levels or near Bollinger Band extremes.

## Recommended Combinations

- MACD + EMA(20 or 60): Use EMA as a trend filter. Only take MACD buy signals when price is above EMA; sell signals when below.
- MACD + RSI: RSI confirms overbought/oversold context; MACD confirms the directional momentum shift.
- MACD + Bollinger Bands: MACD crossover within a Bollinger squeeze breakout is a high-probability trend initiation signal.
- MACD + ADX: When ADX > 25, MACD crossover signals gain reliability; when ADX < 20, treat MACD signals as low-confidence.

## Caveats

- MACD is a lagging indicator by nature. Do not rely on it for precise entry timing in fast-moving markets.
- In horizontal/ranging markets, signal-line crossovers occur frequently and are largely noise. Confirm market structure with ADX before using MACD signals.
- The 12/26/9 setting is optimized for daily bars. For intraday timeframes (1-minute, 5-minute), shorter settings (e.g., 6/12/5) may provide more responsive signals.
