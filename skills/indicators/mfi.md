---
name: MFI Signal Guide
description: MFI(14) 신호 해석 가이드 — 거래량 가중 과매수/과매도, 자금 흐름 다이버전스, 매집/분배 감지
type: indicator_guide
indicators: ['mfi']
confidence_weight: 0.8
usage_roles: [signal, confirmation, measurement]
gating:
  tier: gated
  signal_kind: event
  triggers: [mfi_oversold_bounce, mfi_overbought_reversal]
token_cost: 565
digest_hash: "2e919e64"
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

<!-- PROMPT_DIGEST:START -->
### MFI (Money Flow Index, 14) — volume-weighted momentum oscillator, range 0–100

"Volume-Weighted RSI": uses Typical Price × Volume. More sensitive to institutional/large-volume flow.

Overbought/oversold:
- MFI > 80 = overbought, potential short-term correction (esp. if volume declining); in a strong uptrend MFI can stay > 80 for extended periods.
- MFI < 20 = oversold, potential short-term rebound (esp. if selling volume diminishing).
- MFI > 90 / MFI < 10 = extreme, very high probability of short-term reversal; rare and strong.

Money-flow divergence:
- Bullish: price lower low while MFI higher low → selling pressure decreasing, capital shifting to buy side; strong reversal, often more reliable than RSI divergence (includes volume).
- Bearish: price higher high while MFI lower high → buying weakening, capital shifting to sell side.
- Carries extra weight vs pure price oscillators — reflects actual capital commitment (volume × price).

Failure swing:
- Bullish: MFI drops below 20, recovers, drops again but holds above prior low, then breaks above the intermediate high = strong buy.
- Bearish: MFI rises above 80, pulls back, rises again but fails to exceed prior high, then breaks below the intermediate low = strong sell.

Zero-flow (50 line): cross above 50 from below = positive money flow dominates, bullish bias; cross below 50 from above = negative money flow, bearish bias. Sustained above 50 = accumulation (institutional buying); sustained below 50 = distribution (institutional selling).

Combinations: + RSI (both at same extreme = dual confirmation; RSI OB but MFI not = weaker); + OBV (both same direction = high-confidence volume consensus); + Bollinger (MFI < 20 + price at lower band = high-prob reversion buy); + MACD (golden cross + MFI rising above 50 = reversal with capital-flow confirmation).

Caveats: Typical Price distorted by extreme intrabar volatility (long shadows). Like RSI, in strong trends can stay extreme — don't treat OB/OS as automatic reversals, confirm with ADX/structure. Needs reliable volume (weak for forex, multi-venue ETFs). Best on daily+; intraday susceptible to algo volume spikes. Generally less extreme than RSI on same action — MFI 80 typically reflects stronger conviction than RSI 80.
<!-- PROMPT_DIGEST:END -->

