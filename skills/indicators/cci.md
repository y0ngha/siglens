---
name: CCI Signal Guide
description: CCI(20) signal interpretation guide — +100/-100 thresholds, zero-line, and trend persistence signals
indicators: ['cci']
confidence_weight: 0.75
---

## Overview

CCI (Commodity Channel Index) measures the deviation of the Typical Price (TP = (high + low + close) / 3) from its simple moving average, normalized by the mean absolute deviation and a scaling constant of 0.015. Unlike RSI or Stochastic, CCI has no fixed bounds — values can extend well beyond ±100 or even ±200 during extreme price movements. The standard setting uses a 20-period window.

## Signal Interpretation

### Primary Thresholds

- CCI > +100: price has moved significantly above its statistical average — potential overbought condition or the beginning of a strong trend. Sustained values above +100 indicate an uptrend in progress, not necessarily a sell signal.
- CCI < -100: price is significantly below its statistical average — potential oversold condition or a strong downtrend. Sustained negative values below -100 indicate a downtrend in progress.
- CCI crossing above -100 from below: a buy signal — downside momentum is weakening and price is returning toward fair value.
- CCI crossing below +100 from above: a sell signal — upside momentum is fading.

### Zero-Line Crossover

- CCI crossing above 0 from below: an early bullish momentum shift signal. Useful as a direction filter to confirm the overall trend has turned positive.
- CCI crossing below 0 from above: an early bearish momentum shift.

### Trend Persistence Signals

- CCI consistently above +100 for multiple bars: a strong uptrend is in progress. In this environment, pullbacks toward the +100 level are buying opportunities rather than sell signals.
- CCI consistently below -100 for multiple bars: a strong downtrend is in progress.
- Lower highs in CCI while price makes higher highs (bearish divergence): upside momentum is weakening — potential reversal.
- Higher lows in CCI while price makes lower lows (bullish divergence): downside momentum is weakening — potential recovery.

### Extreme CCI Readings

- CCI > +200: very rare condition indicating extreme upside deviation from the mean. Historical pattern: price tends to eventually revert, though the timing is unpredictable.
- CCI < -200: extreme downside deviation. May signal a climax move or panic selling.

## Key Combinations

- CCI + RSI: Both are oscillators measuring different aspects of momentum. When both simultaneously signal overbought or oversold, the confluence strengthens the signal.
- CCI + Bollinger Bands: CCI > +100 while price is near the Bollinger upper band = strong confluence for overbought; CCI < -100 near lower band = strong confluence for oversold.
- CCI + MACD: CCI zero-line crossover in the same direction as MACD crossover provides early confirmation of a trend shift.
- CCI + Volume: CCI extreme readings combined with volume spikes often mark price reversals. Volume surge at CCI > +200 may signal climax buying.

## Caveats

- CCI has no fixed upper or lower bounds. Do not set mechanical hard limits for overbought/oversold — context determines interpretation.
- In trending markets, CCI values above +100 indicate trend strength and should not trigger automatic sell signals without additional context.
- CCI is sensitive to the 0.015 normalization constant. While this constant standardizes the distribution, real-world readings frequently exceed ±300 during gap moves or earnings events.
- Shorter CCI periods (10–14) respond faster but generate more noise; longer periods (25–50) smooth the signal but lag more.
