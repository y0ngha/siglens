---
name: MFI Signal Guide
description: MFI(14) 신호 해석 가이드 — 거래량 가중 과매수/과매도, 자금 흐름 다이버전스, 매집/분배 감지
type: indicator_guide
indicators: ['mfi']
confidence_weight: 0.8
---

## Overview

MFI (Money Flow Index) is a volume-weighted momentum oscillator that combines both price and volume data to measure buying and selling pressure. Often called the "Volume-Weighted RSI," MFI uses Typical Price × Volume as its input rather than price alone. This makes it more sensitive to institutional activity, where large-volume transactions drive significant capital flow. The standard period is 14 bars, and MFI ranges from 0 to 100.

## Signal Interpretation

### Overbought / Oversold Thresholds

- MFI > 80: overbought zone — heavy buying pressure has driven the indicator to extreme levels. Potential for short-term correction, especially if volume begins to decline. In a strong uptrend, MFI can remain above 80 for extended periods.
- MFI < 20: oversold zone — heavy selling pressure has pushed the indicator to extreme lows. Potential for short-term rebound, especially if selling volume is diminishing.
- MFI > 90 / MFI < 10: extreme readings — very high probability of short-term reversal. These levels are rare and carry strong signal significance.

### Money Flow Divergence

- Bullish divergence: price makes a lower low while MFI makes a higher low → selling pressure is decreasing despite falling prices — capital flow is shifting to the buy side. This is a strong reversal signal, often more reliable than RSI divergence because it incorporates volume.
- Bearish divergence: price makes a higher high while MFI makes a lower high → buying pressure is weakening despite rising prices — capital flow is shifting to the sell side.
- MFI divergence carries additional weight compared to pure price oscillators because it reflects actual capital commitment (volume × price), not just price movement.

### Failure Swing

- Bullish failure swing: MFI drops below 20, recovers, drops again but holds above the prior low, then breaks above the intermediate high — a strong buy signal.
- Bearish failure swing: MFI rises above 80, pulls back, rises again but fails to exceed the prior high, then breaks below the intermediate low — a strong sell signal.

### Zero-Flow Analysis

- MFI crossing above 50 from below: positive money flow dominates — net capital is flowing into the asset. Bullish bias.
- MFI crossing below 50 from above: negative money flow dominates — net capital is flowing out of the asset. Bearish bias.
- Sustained MFI above 50: accumulation phase — institutional buying is persistent.
- Sustained MFI below 50: distribution phase — institutional selling is persistent.

## Recommended Combinations

- MFI + RSI: MFI and RSI at the same overbought/oversold extreme provides dual confirmation — price momentum and volume-weighted momentum agree. When they diverge (RSI overbought but MFI not), the signal is weaker.
- MFI + OBV: OBV tracks cumulative volume direction; MFI measures rate of money flow. Both confirming the same direction = high-confidence volume consensus.
- MFI + Bollinger Bands: MFI oversold (< 20) + price at Bollinger lower band = high-probability mean reversion buy with volume confirmation.
- MFI + MACD: MACD golden cross + MFI rising above 50 = trend reversal with capital flow confirmation.

## Caveats

- MFI uses Typical Price, which weights high, low, and close equally. Extreme intrabar volatility (long shadows) can distort the Typical Price calculation.
- Like RSI, MFI in a strong trend can remain at extreme levels for extended periods. Do not use overbought/oversold readings as automatic reversal signals — always confirm with trend context (ADX, price structure).
- MFI requires reliable volume data. For instruments with fragmented volume (e.g., forex, some ETFs with multiple venues), MFI signals may be less reliable.
- MFI is most effective on daily or higher timeframes where volume data is more meaningful. Intraday MFI is susceptible to volume spikes from algorithmic trading that do not reflect genuine directional conviction.
- Due to volume weighting, MFI generally exhibits less extreme readings than RSI on the same price action — high-volume, less-volatile bars dampen the oscillator. A reading of 80 on MFI typically reflects stronger conviction than 80 on RSI, because it required sustained volume backing rather than pure price momentum.
