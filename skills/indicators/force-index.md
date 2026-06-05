---
name: Force Index Signal Guide
description: 엘더 Force Index 신호 해석 가이드 — 0선 교차, 거래량 확인, 다이버전스 경고 (단독 사용 금지)
type: indicator_guide
indicators: ['forceIndex']
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: state
  state:
    feature: forceIndex
    predicate: level
token_cost: 0
---

## Overview

The Force Index was created by Dr. Alexander Elder (Trading for a Living, Wiley, 1993). It fuses three pieces of a move — direction, extent, and volume — into a single "force behind the move" reading.

- **Formula**: `FI(1) = (Close − PrevClose) × Volume`; the default smoothed form is `FI(13) = EMA13 of FI(1)`.
- **Time horizons**: FI(2) is a fast short-term timer, FI(13) is the trend/divergence read, and FI(~100) acts as a longer-term bias filter.

## Signal Interpretation

### Zero-Line Cross (the state gate)

- FI crossing the 0-line = the force behind price flipped sign — buyers took over (cross up) or sellers took over (cross down). The **state gate fires on this sign flip** versus the previous bar.
- A 0-cross is a momentum-turn marker, not a trade trigger on its own.

### Divergence (the primary read)

- Bullish divergence: price makes a lower low while FI makes a higher low → selling force is fading. Bearish divergence is the mirror. Elder treats divergence as the indicator's most useful output — but explicitly "not a trade signal in itself."

### Buy-the-Dip Timer

- In an established uptrend (price above a 22-EMA), a FI(2) dip into negative territory is a pullback-entry timer — used *with* the trend filter, never alone.

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.4** — advisory only. Our forward-edge study found **0 of 18 cells significant** (all |t| < 1.8). This matches the literature, which is unusually explicit: Force Index "shouldn't be used on its own," and a divergence "is not a trade signal in itself."

Use it as **volume confirmation plus a divergence warning**, layered onto a directional method — not as a trigger.

## Recommended Combinations

- **Force Index + 22-EMA trend filter**: take FI(2) pullback dips only in the direction of the EMA trend.
- **Force Index + price/oscillator divergence**: a FI divergence that agrees with an RSI/MACD divergence at a key level is a higher-quality reversal warning.
- **Force Index + the volume layer (CMF / MFI / OBV)**: FI is a volume-weighted force read; corroborate it with an independent volume indicator rather than another momentum oscillator.

## Caveats

- Standalone forward edge measured at ≈0 — present as confluence/confirmation, never a signal.
- FI is volume-scaled, so absolute levels are not comparable across symbols or across volume regimes; read sign and slope, not magnitude.
- Divergence is a warning, not timing — it can persist for many bars before (or without) a reversal.
