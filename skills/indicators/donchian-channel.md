---
name: Donchian Channel Signal Guide
description: Donchian Channel(20) 신호 해석 가이드 — 브레이크아웃, Turtle Trading, 추세 확인, 변동성 측정
type: indicator_guide
indicators: ['donchianChannel']
confidence_weight: 0.8
---

## Overview

Donchian Channel, developed by Richard Donchian in the 1940s — widely regarded as the father of trend following — plots the highest high and lowest low over a specified period, creating a price channel. The standard period is 20 bars. The middle line is the average of the upper and lower bands. Donchian Channel is the foundation of the legendary Turtle Trading system and remains a cornerstone of CTA (Commodity Trading Advisor) strategies worldwide.

## Signal Interpretation

### Channel Breakout (Primary Signal)

- Price closing above the upper band (new N-period high): a bullish breakout — the market has reached a level not seen in the lookback period. In trend-following systems, this is a buy signal.
- Price closing below the lower band (new N-period low): a bearish breakout — a sell or short signal.
- The Turtle Trading entry rule: enter long when price exceeds the 20-day high; enter short when price breaks below the 20-day low.
- Breakout signals are strongest when accompanied by above-average volume and expanding ATR.

### Channel as Support/Resistance

- Upper band: dynamic resistance in a downtrend or consolidation — price repeatedly fails to breach this level.
- Lower band: dynamic support in an uptrend or consolidation — price repeatedly bounces from this level.
- Middle line: equilibrium price — acts as a mean-reversion target and secondary support/resistance level.
- In trending markets, the channel band in the trend direction acts as a trailing reference for trend continuation.

### Channel Width (Volatility Measure)

- Widening channel (upper band rising, lower band falling or stable): volatility is expanding — the market is making new highs and/or lows more frequently. Active trending conditions.
- Narrowing channel (upper and lower bands converging): volatility is contracting — the market is consolidating within a tightening range. A breakout is likely imminent.
- Channel at its narrowest point in several weeks: maximum compression — a significant directional move is probable.

### Turtle Trading Exit Rule

- For long positions: exit when price falls to the 10-day low (use a secondary, shorter-period Donchian Channel).
- For short positions: exit when price rises to the 10-day high.
- This asymmetric entry (20-day) and exit (10-day) system is designed to let winners run longer while cutting losses shorter.

### Trend Assessment

- Price consistently near the upper band: strong uptrend — repeated new highs confirm bullish momentum.
- Price consistently near the lower band: strong downtrend — repeated new lows confirm bearish momentum.
- Price oscillating between upper and lower bands: ranging market — mean-reversion strategies outperform breakout strategies.

## Recommended Combinations

- Donchian Channel + ATR: ATR confirms whether a Donchian breakout is accompanied by genuine volatility expansion. Breakout + rising ATR = high-probability trend initiation. Breakout + flat ATR = potential false breakout.
- Donchian Channel + ADX: ADX > 25 when a Donchian breakout occurs = the market is already trending, and the breakout represents trend acceleration. ADX < 20 = the breakout is from a range, and confirmation is critical.
- Donchian Channel + OBV: OBV confirming the breakout direction (new OBV high on upper-band breakout) adds volume conviction to the price breakout.
- Donchian Channel + MACD: MACD histogram expanding in the breakout direction confirms momentum alignment.

## Caveats

- Donchian Channel is purely price-based — it does not incorporate volume. Always cross-reference breakouts with volume indicators.
- In ranging markets, the channel bands are flat and breakout signals generate frequent whipsaws. Use ADX or channel-width analysis to filter out range-bound conditions.
- The standard 20-period lookback is designed for daily charts. For intraday trading, shorter periods (10-15) may be appropriate. For position trading, longer periods (50-55) reduce noise.
- Donchian Channel breakout systems have a historically low win rate (typically 35-45%) but achieve profitability through large average wins exceeding small average losses. Traders must be psychologically prepared for frequent small losses.
- The simplicity of Donchian Channel is both its strength and weakness — it reacts identically to genuine breakouts and false breakouts. Filters (ATR, volume, ADX) are essential companions.
