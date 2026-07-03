---
name: Elder-Ray Signal Guide
description: 엘더-레이(Bull Power/Bear Power) 신호 해석 가이드 — 추세 내 다이버전스, 베어파워 반등 매수 셋업
type: indicator_guide
indicators: ['elderRay']
confidence_weight: 0.45
usage_roles: [signal, confirmation]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: elderRay
    predicate: level
token_cost: 474
digest_hash: "37634b1f"
---

## Overview

Elder-Ray was developed by Dr. Alexander Elder around 1989 and published in Trading for a Living (Wiley, 1993). The name evokes an X-ray of the buying and selling pressure beneath price.

- **Formula**: `Bull Power = High − EMA13`, `Bear Power = Low − EMA13`. The 13-period EMA is the "consensus of value"; the bar's high captures the maximum buyer power and the low the maximum seller power for that bar.
- **Normal regime**: Bull Power > 0 and Bear Power < 0. Their behavior *relative to that baseline* is the signal, not the raw level.

## Signal Interpretation

### Elder's Long Setup (the state gate)

Elder defined four conditions for a long; the core two drive the state gate:
1. The trend is up (EMA13 rising), and
2. **Bear Power is negative but rising** — sellers are losing grip. This "bear power turning up from below zero" is Elder's best buy setup. The mirror (Bull Power positive but falling in a downtrend) flags selling pressure entering a rally.
- The **state gate fires on these turn conditions** versus the previous bar.

### Divergence (the highest-quality variant)

- A bullish divergence (price lower low, Bear Power higher low) within an uptrend, or a bearish divergence (price higher high, Bull Power lower high), is Elder-Ray's strongest read — best used inside his Triple Screen system.

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.45** — advisory only. Our forward-edge study found **0 of 18 cells significant** (all |t| < 1.8). The naive 0-cross was never the recommended signal (it generates false signals in ranges); Elder always embedded Elder-Ray inside the Triple Screen, conditioned on a higher-timeframe trend.

Reliability is best characterized as **moderate-to-high specifically for divergence within an established trend**, and low for any standalone level read.

## Recommended Combinations

- **Elder-Ray + EMA13 trend filter (Triple Screen)**: only act on bear-power-rising long setups when the higher-timeframe trend is up; only on bull-power-falling shorts when it is down.
- **Elder-Ray + price divergence at a key level**: a Bear Power higher-low against a price lower-low at support is the canonical high-quality buy.
- **Elder-Ray + a confirming oscillator (MACD / RSI) divergence**: agreement across two independent divergence reads raises confidence.

## Caveats

- Standalone forward edge measured at ≈0 — the raw 0-cross whipsaws in ranges.
- The signal is the *turn* (negative-but-rising / positive-but-falling), not the absolute sign; reading only "Bull > 0 = bullish" misuses the indicator.
- EMA13 is the anchor, so a fast EMA regime shift can briefly distort both powers — confirm the underlying trend with a separate filter.

<!-- PROMPT_DIGEST:START -->
### Elder-Ray Signal Guide (Bull Power / Bear Power)
- Bull Power = High − EMA13; Bear Power = Low − EMA13. EMA13 = consensus of value.
- Normal regime: Bull Power > 0 and Bear Power < 0. Behavior RELATIVE to that baseline is the signal, not the raw level.

Elder's long setup (state gate) — core two conditions:
1. Trend up (EMA13 rising), AND
2. Bear Power negative but RISING (sellers losing grip) — Elder's best buy setup. Mirror: Bull Power positive but FALLING in a downtrend = selling pressure entering a rally. State gate fires on these turn conditions vs the previous bar.

Divergence (highest-quality variant): bullish (price lower low, Bear Power higher low) within an uptrend, or bearish (price higher high, Bull Power lower high) — strongest read, best inside the Triple Screen system.

Reliability: confidence weight 0.45 (advisory only). Forward-edge: 0 of 18 cells significant (all |t|<1.8). The naive 0-cross was never the recommended signal (false signals in ranges); Elder always embedded it in the Triple Screen, conditioned on a higher-timeframe trend. Moderate-to-high specifically for divergence within an established trend; low for any standalone level read.

Combinations:
- + EMA13 trend filter (Triple Screen): act on bear-power-rising longs only when higher-TF trend is up; bull-power-falling shorts only when down.
- + price divergence at a key level: Bear Power higher-low against price lower-low at support = canonical high-quality buy.
- + a confirming oscillator (MACD/RSI) divergence: agreement across two independent divergences raises confidence.

Caveats: standalone edge ≈0 (raw 0-cross whipsaws in ranges); the signal is the TURN (negative-but-rising / positive-but-falling), NOT the absolute sign — reading only "Bull>0=bullish" misuses it; EMA13 anchor — a fast EMA regime shift can briefly distort both powers, confirm the trend with a separate filter.
<!-- PROMPT_DIGEST:END -->
