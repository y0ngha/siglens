---
name: Hurst Exponent Signal Guide
description: 허스트 지수(R/S) 신호 해석 가이드 — 추세 vs 평균회귀 레짐 컨디셔너, R/S 소표본 편향 주의
type: indicator_guide
indicators: ['hurst']
confidence_weight: 0.4
usage_roles: [regime]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: hurst
    predicate: level
token_cost: 388
digest_hash: "68b865cf"
---

## Overview

The Hurst exponent originates with hydrologist Harold Edwin Hurst (1951, Transactions of the ASCE 116:770–808) and was placed on a fractional-Brownian-motion footing by Mandelbrot & Van Ness (1968, SIAM Review 10:422–437).

- **Formula (classical R/S)**: over a window of length n, compute the rescaled range; `E[R/S]ₙ = c · nᴴ`, and H is the slope of log(R/S) against log(n).
- **Interpretation**: H ∈ [0,1]. H > 0.5 = persistent / trending (a move tends to continue); H < 0.5 = anti-persistent / mean-reverting; H ≈ 0.5 = random walk.

## Signal Interpretation — Regime Conditioner

Hurst is a **regime classifier**, not a directional signal. It tells you *which kind of strategy the tape favors*, then conditions the other reads.

- **H > 0.5** → up-weight trend-following; fade signals are lower quality.
- **H < 0.5** → up-weight mean-reversion (e.g. the Bollinger %B short); trend-continuation bets are lower quality.
- **H ≈ 0.5** → low confidence either way; reduce conviction.
- The **state gate fires when |H − 0.5| clears a decisive margin** (≈0.1), i.e. far enough off the random-walk midpoint to actually lean a regime. Inside that margin the read is noise and the skill stays dormant.

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.4** — a conditioner, not a signal; standalone reliability is medium-low. There is no directional t-stat to report because Hurst does not produce a directional forecast; its job is to weight other reads. Its reliability is best when the estimate is bias-corrected and confirmed by an independent regime tool (Variance Ratio).

## Recommended Combinations

- **Hurst + Variance Ratio + Regression R²**: the three-tool regime lens. Agreement (e.g. H > 0.5, VR > 1, high R²) is a confident trend regime; disagreement means low confidence.
- **Hurst as a weight on directional skills**: in H < 0.5, up-weight the mean-reversion event (Bollinger %B short); in H > 0.5, up-weight trend-following confluence (MACD-V under a trend filter).

## Caveats

- **Classical R/S has a small-sample positive bias** (Anis–Lloyd 1976 correction; Weron confidence intervals) and is window-sensitive — short rolling windows overstate H.
- **Lo (1991, Econometrica 59:1279–1313) modified R/S** showed classical R/S confounds genuine long-memory with short-range autocorrelation; much apparent equity long-memory vanishes under the corrected statistic.
- In liquid markets H sits near 0.5 and drifts; treat a marginal reading as noise. DFA/MFDFA are often preferred estimators — read H as a soft conditioner, never as a hard regime verdict.

<!-- PROMPT_DIGEST:START -->
### Hurst Exponent (R/S) — REGIME CONDITIONER, not a directional signal

H ∈ [0,1]. H > 0.5 = persistent/trending (moves tend to continue); H < 0.5 = anti-persistent/mean-reverting; H ≈ 0.5 = random walk. Classifies which strategy the tape favors, then conditions other reads.

Regime weighting:
- H > 0.5 → up-weight trend-following; fade signals lower quality.
- H < 0.5 → up-weight mean-reversion (e.g. Bollinger %B short); trend-continuation bets lower quality.
- H ≈ 0.5 → low confidence either way; reduce conviction.
- State gate fires when |H − 0.5| clears a decisive margin (≈0.1) off the random-walk midpoint. Inside that margin = noise, skill stays dormant.

Confidence weight 0.4 — a conditioner, not a signal; standalone reliability medium-low. No directional t-stat (no directional forecast); its job is to weight other reads. Best when bias-corrected and confirmed by Variance Ratio.

Combinations:
- Hurst + Variance Ratio + Regression R² = three-tool regime lens. Agreement (H > 0.5, VR > 1, high R²) = confident trend regime; disagreement = low confidence.
- As a weight on directional skills: H < 0.5 up-weight mean-reversion (Bollinger %B short); H > 0.5 up-weight trend-following (MACD-V under trend filter).

Caveats: classical R/S has small-sample positive bias (short windows overstate H) and is window-sensitive. Lo's modified R/S: classical confounds long-memory with short-range autocorrelation. In liquid markets H sits near 0.5 and drifts — treat marginal readings as noise. Soft conditioner, never a hard regime verdict.
<!-- PROMPT_DIGEST:END -->

