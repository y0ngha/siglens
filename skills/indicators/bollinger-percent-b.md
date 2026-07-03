---
name: Bollinger %B & BandWidth Signal Guide
description: 볼린저 %B·BandWidth 신호 해석 가이드 — 평균 회귀 이벤트(일봉 숏의 측정 엣지), 스퀴즈, "태그는 신호가 아니다" 원칙
type: indicator_guide
indicators: ['bollingerDerived']
confidence_weight: 0.55
usage_roles: [signal, confirmation, measurement]
gating:
  tier: gated
  signal_kind: event
  triggers: [bollinger_percentb_oversold, bollinger_percentb_overbought]
token_cost: 669
digest_hash: "b87d3178"
---

## Overview

%B and BandWidth are John Bollinger's two derived indicators from his Bollinger Bands (Bollinger on Bollinger Bands, McGraw-Hill, 2001). They distill band position and band width into normalized series.

- **%B** = `(Close − Lower) / (Upper − Lower)` on standard 20/2 bands. 0 = price at the lower band, 1 = at the upper band, > 1 = above the upper band, < 0 = below the lower band. %B answers "where is price within the bands."
- **BandWidth** = `((Upper − Lower) / Middle) × 100`. A pure volatility gauge with no directional content; it underlies "the Squeeze" — when BandWidth contracts to a local minimum, volatility is compressed and a breakout is loading (direction unknown).

This guide drives an **event-gated** signal: %B crossing through the extreme bounds is the one place in this pro-indicator set with a measured forward edge.

## Signal Interpretation

### %B Mean-Reversion Crosses (the event signal)

- **`bollinger_percentb_overbought`** — %B crosses *down* through ~0.95: price has retreated from the upper-band extreme. Bearish mean-reversion (short-side) read.
- **`bollinger_percentb_oversold`** — %B crosses *up* through ~0.05: price is bouncing off the lower-band extreme. Bullish mean-reversion (long-side) read.
- Sustained %B > 0.80 or < 0.20 *without* a cross back is trend behavior (a band-walk), not a reversion setup — do not fade it.
- W-bottom / M-top divergences (%B making a higher low while price makes a lower low, or vice versa) are Bollinger's higher-quality reversal variant.

### BandWidth / Squeeze

- A BandWidth contraction to a multi-period low = squeeze: volatility is compressed, a directional expansion is imminent, but **BandWidth gives no direction**. Pair it with a trend filter (MACD, ADX) or price structure to choose a side.
- BandWidth expansion confirms that a breakout has real volatility behind it.

## Measured Reliability (신뢰도 가중치)

This is the **single pro-indicator with a measured standalone edge**, and even that edge is modest — confidence weight 0.55, the highest of the twelve, but still well below the textbook RSI/MACD guides (0.9).

Our 2-year, look-ahead-safe forward-edge study (10 large-cap US equities, pooled) found:

- **%B overbought-reversal SHORT on the DAILY timeframe** (cross down through 0.95) is the real signal: roughly +0.94% excess return at h=5 (t ≈ 2.19, n=113) and +2.00% at h=10 (t ≈ 3.10, n=112) — coherent across two horizons with the right sign.
- The %B oversold-long side was *not* confirmed: its only significant cell (1H, h=24) is isolated and likely an artifact. **Treat the long-side cross as weaker than the short-side.**
- Across 126 cells only 3 cleared significance versus ~6 expected by chance, so even %B is best described as MODEST, consistent with the literature ("contrarian Bollinger works, naive breakout does not"; edge decays over time).

The practical implication: the daily short reversion is the designated edge, but it still **requires confirmation** before acting — never trade a bare %B cross.

## Recommended Combinations

- **%B + uncorrelated confirmer**: pair the %B reversion with a confirmer that is *not* another momentum oscillator — money-flow (MFI), volume, or a reversal candle. Stacking %B with RSI/MACD just re-measures the same momentum and inflates false confidence.
- **%B + BandWidth**: only take reversion crosses when BandWidth is in a normal/expanded regime; inside a tight squeeze, an extreme %B is more likely the start of an expansion than a reversion.
- **%B + regime lens (Hurst / Variance Ratio / Regression R²)**: reversion edge is strongest in a mean-reverting / low-R² regime; in a clean trend (high R², H > 0.5), suppress the counter-trend %B short.

## Caveats

- **Bollinger's own Rule 6**: "Tags of the bands are just that, tags — not signals." A %B touch or extreme is context, never a standalone trigger. This guide encodes that as the event-gate-plus-confirmation requirement.
- The long-side oversold cross is empirically weaker than the short-side overbought cross; weight it down accordingly.
- BandWidth predicts volatility expansion, not direction — never infer a side from the squeeze alone.
- The measured edge is daily and short-horizon (≈5–10 bars). Do not extrapolate it to intraday or to multi-week holds.

<!-- PROMPT_DIGEST:START -->
### Bollinger %B & BandWidth Signal Guide
- %B = (Close−Lower)/(Upper−Lower) on 20/2 bands: 0 = at lower band, 1 = at upper, >1 = above upper, <0 = below lower. "Where is price within the bands."
- BandWidth = ((Upper−Lower)/Middle)×100 — pure volatility gauge, no directional content; underlies "the Squeeze."

%B mean-reversion crosses (the event signal):
- `bollinger_percentb_overbought` — %B crosses DOWN through ~0.95: retreat from upper-band extreme → bearish (short-side) mean-reversion.
- `bollinger_percentb_oversold` — %B crosses UP through ~0.05: bounce off lower-band extreme → bullish (long-side) mean-reversion.
- Sustained %B >0.80 or <0.20 WITHOUT a cross back = band-walk (trend behavior), not a reversion setup — do NOT fade it.
- W-bottom / M-top divergence (%B higher low while price lower low, or vice versa) = Bollinger's higher-quality reversal variant.

BandWidth / Squeeze:
- Contraction to a multi-period low = squeeze: compressed volatility, directional expansion imminent, but NO direction — pair with a trend filter (MACD/ADX) or price structure.
- BandWidth expansion confirms a breakout has real volatility behind it.

Measured reliability: the single pro-indicator with a measured standalone edge, and even that is modest — confidence weight 0.55 (highest of the twelve, still well below RSI/MACD 0.9).
- DAILY %B overbought-reversal SHORT (cross down through 0.95) is the real signal: ~+0.94% excess return at h=5 (t≈2.19, n=113) and +2.00% at h=10 (t≈3.10, n=112) — coherent across two horizons.
- %B oversold-LONG side NOT confirmed (only significant cell 1H h=24, isolated/likely artifact) — treat the long-side cross as WEAKER than the short-side.
- Across 126 cells only 3 cleared significance vs ~6 expected by chance — MODEST. Requires confirmation; never trade a bare %B cross.

Combinations:
- %B + uncorrelated confirmer (MFI / volume / reversal candle — NOT another momentum oscillator like RSI/MACD, which just re-measures the same momentum).
- %B + BandWidth: only take reversion crosses when BandWidth is normal/expanded; inside a tight squeeze an extreme %B is more likely the start of an expansion than a reversion.
- %B + regime lens (Hurst / Variance Ratio / Regression R²): reversion edge strongest in mean-reverting / low-R² regime; suppress the counter-trend %B short in a clean trend (high R², H>0.5).

Caveats: Bollinger's Rule 6 — "tags of the bands are just tags, not signals" (context + confirmation always required); long-side oversold cross empirically weaker than short-side; BandWidth = vol expansion not direction; edge is daily short-horizon (≈5–10 bars), do not extrapolate to intraday or multi-week holds.
<!-- PROMPT_DIGEST:END -->
