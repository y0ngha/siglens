---
name: Force Index Signal Guide
description: 엘더 Force Index 신호 해석 가이드 — 0선 교차, 거래량 확인, 다이버전스 경고 (단독 사용 금지)
type: indicator_guide
indicators: ['forceIndex']
confidence_weight: 0.4
usage_roles: [signal, confirmation]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: forceIndex
    predicate: level
token_cost: 375
digest_hash: "dc706c0e"
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

<!-- PROMPT_DIGEST:START -->
### Force Index (Elder) — CONFLUENCE/CONFIRMATION ONLY, never a standalone trigger

Fuses direction, extent, and volume. FI(1) = (Close − PrevClose) × Volume; FI(13) = EMA13 of FI(1). FI(2) = fast timer, FI(13) = trend/divergence read, FI(~100) = long-term bias filter.

Zero-line cross (state gate): FI crossing 0 = force behind price flipped sign — buyers took over (cross up) / sellers took over (cross down). State gate fires on this sign flip vs previous bar. A momentum-turn marker, not a trade trigger alone.

Divergence (primary read): bullish = price lower low while FI higher low → selling force fading. Bearish = mirror. Elder's most useful output but "not a trade signal in itself."

Buy-the-dip timer: in uptrend (price above 22-EMA), FI(2) dip into negative territory = pullback-entry timer — only with the trend filter, never alone.

Confidence weight 0.4 — advisory only. Forward-edge study: 0 of 18 cells significant (all |t| < 1.8). Use as volume confirmation plus divergence warning layered on a directional method.

Combinations: FI + 22-EMA (take FI(2) dips only in trend direction); FI + price/oscillator divergence (agreeing RSI/MACD divergence at a key level = higher-quality warning); FI + CMF/MFI/OBV (corroborate with independent volume indicator).

Caveats: standalone edge ≈0 — never a signal. Volume-scaled, so absolute levels not comparable across symbols/volume regimes — read sign and slope, not magnitude. Divergence is a warning not timing — can persist many bars.
<!-- PROMPT_DIGEST:END -->

