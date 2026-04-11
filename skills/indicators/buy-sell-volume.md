---
name: Buy/Sell Volume Signal Guide
description: Buy/Sell Volume 신호 해석 가이드 — 캔들 내 매수/매도 압력 분해, 추세 확인, 거래량 품질 평가
type: indicator_guide
indicators: ['buySellVolume']
confidence_weight: 0.75
---

## Overview

Buy/Sell Volume decomposes each bar's total volume into a buy component and a sell component based on where the close falls within the high-low range. The formula mirrors the TradingView "BS" indicator:

- buyVolume = volume × (close − low) / (high − low)
- sellVolume = volume × (high − close) / (high − low)
- When high equals low (doji with no range), both values are zero.

A close near the high implies buyers dominated the bar; a close near the low implies sellers dominated. This distributes volume proportionally rather than assigning it binary up/down labels, providing a continuous measure of intrabar buying and selling pressure.

## Signal Interpretation

### Current Bar Pressure

- buyVolume >> sellVolume: strong intrabar buying pressure — bulls controlled price action; supports continuation or reversal to the upside.
- sellVolume >> buyVolume: strong intrabar selling pressure — bears controlled price action; supports continuation or reversal to the downside.
- buyVolume ≈ sellVolume: balanced intrabar pressure — indecision; neither side has clear control. Watch subsequent bars for resolution.

### Buy Ratio as a Summary Metric

- Buy ratio > 60%: buyers are dominant on that bar.
- Buy ratio < 40%: sellers are dominant on that bar.
- Buy ratio between 40–60%: balanced, inconclusive.

### Cumulative Period Analysis

- Cumulative buy ratio rising over recent bars: buying pressure is building — bullish momentum confirmation.
- Cumulative sell ratio rising over recent bars: selling pressure is building — bearish momentum confirmation.
- Sudden spike in sellVolume on a bar that closes near its low: climactic selling; potential exhaustion or acceleration depending on trend context.
- Sudden spike in buyVolume on a bar that closes near its high: climactic buying; potential exhaustion or acceleration depending on trend context.

### Breakout and Trend Confirmation

- Price breaking above resistance + high buy ratio: breakout backed by genuine buying conviction — high-probability follow-through.
- Price breaking above resistance + high sell ratio: breakout lacks buy-side conviction — suspect breakout; watch for reversal.
- Price in a downtrend + persistent high sell ratios: downtrend has internal volume confirmation — avoid premature counter-trend entries.
- Price in an uptrend + persistent high buy ratios: uptrend has internal volume confirmation — trend continuation is likely.

### Divergence Signals

- Bullish divergence: price makes a lower low while buy ratio makes a higher low → selling pressure is diminishing despite lower price — potential reversal.
- Bearish divergence: price makes a higher high while sell ratio is rising → buying pressure is fading despite higher price — potential reversal.

## Recommended Combinations

- Buy/Sell Volume + OBV: OBV tracks cumulative direction; Buy/Sell Volume adds intrabar quality. Rising OBV with high buy ratios = strong accumulation signal.
- Buy/Sell Volume + CMF: CMF measures money flow over a period; Buy/Sell Volume shows bar-by-bar decomposition. Agreement between positive CMF and rising buy ratio confirms sustained buying pressure.
- Buy/Sell Volume + RSI: RSI oversold + high buy ratio on the same bar = selling exhaustion with intrabar buying absorption — strong mean reversion entry signal.
- Buy/Sell Volume + Candlestick patterns: A bullish engulfing pattern with a high buy ratio has more conviction than one with a neutral buy ratio. Use Buy/Sell Volume to confirm pattern quality.

## Caveats

- The indicator is entirely range-based: a narrow-range bar (e.g. doji) produces very small absolute buyVolume and sellVolume even if volume is high. Interpret in conjunction with total volume size.
- Gaps are not reflected. If price gaps up and the entire bar is near its low, the sell ratio will be high even in a strongly bullish gap scenario.
- On very low-volume bars, the absolute split is small and statistically less meaningful. Weight signals from high-volume bars more heavily.
- The formula treats the close position within the range as a linear proxy for buyer/seller control. This is an approximation — intrabar price paths are not captured.
