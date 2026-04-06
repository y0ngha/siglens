---
name: DMI Signal Guide
description: DMI 신호 해석 가이드 — +DI/-DI 방향성 압력, 크로스오버 신호, 추세 우위 판단
type: indicator_guide
indicators: ['dmi']
confidence_weight: 0.85
---

## Overview

DMI (Directional Movement Index) measures the directional pressure of price movement using two components: +DI (positive directional indicator) and -DI (negative directional indicator). Together with ADX (trend strength), DMI provides a complete picture of trend direction and momentum. The standard period is 14 bars.

## Signal Interpretation

### +DI vs. -DI Comparison

- +DI > -DI: buying pressure dominates — the market is in an upward trend bias. The larger the gap, the more decisive the bullish pressure.
- -DI > +DI: selling pressure dominates — the market is in a downward trend bias.
- When the gap between +DI and -DI is narrow (within 3–5 points), the market is balanced and the directional signal is weak.

### DI Crossover

- +DI crosses above -DI: early bullish trend reversal signal. Reliability increases significantly when ADX is above 20 at the time of crossover.
- -DI crosses above +DI: early bearish trend reversal signal. Confirm with ADX > 20.
- DI crossovers during low ADX (< 20) periods generate many false signals — treat with caution.

### Combined DMI + ADX Interpretation

- +DI > -DI and ADX rising above 25: strong bullish trend is forming and strengthening — trend-following long positions are favored.
- -DI > +DI and ADX rising above 25: strong bearish trend is forming — trend-following short positions are favored.
- ADX peaking and beginning to decline while DIs are still divergent: trend momentum is exhausting — consider reducing exposure or tightening stops.
- ADX < 20: no meaningful trend in place — range-based or mean-reversion approaches are more appropriate; avoid trend-following signals.

## Key Combinations

- DMI + ADX: DMI alone provides direction, ADX confirms whether that direction has sufficient strength to trade.
- DMI + MACD: MACD crossover in the same direction as the dominant DI provides a high-confluence entry signal.
- DMI + EMA(50 or 60): When +DI dominates and price is above EMA(60), the signal aligns across both momentum and trend structure.

## Caveats

- DMI crossovers are lagging by nature; they confirm trend changes after they begin, not before.
- In choppy or range-bound markets, DI lines cross frequently and produce unreliable signals.
- ADX does not indicate direction — always read +DI/-DI alongside ADX to determine which direction the trend is running.
- A high ADX (> 40) signals an extremely strong trend but also potential exhaustion; new entries at very high ADX levels carry increased reversal risk.
