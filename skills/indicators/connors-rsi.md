---
name: Connors RSI Signal Guide
description: Connors RSI(3,2,100) 신호 해석 가이드 — 10 미만 / 90 초과 극단, 단기 평균 회귀 풀백 품질, 청산 게이지
type: indicator_guide
indicators: ['connorsRsi']
confidence_weight: 0.4
usage_roles: [signal, confirmation]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: connorsRsi
    predicate: level
token_cost: 418
digest_hash: "8283b4d7"
---

## Overview

Connors RSI (CRSI) was developed by Larry Connors with Cesar Alvarez and Matt Radtke in "An Introduction to ConnorsRSI" (Connors Research, 2012, ISBN 978-0-9853072-9-5). It is a composite oscillator built to surface short-term mean-reversion setups.

- **Formula**: `CRSI(3,2,100) = [RSI(close,3) + RSI(streak,2) + PercentRank(ROC1,100)] / 3`.
- **Components**: a short price-momentum RSI(3), a streak-duration RSI(2) (how many consecutive up/down days), and a percent-rank of the 1-day return over 100 bars (return magnitude). Averaging three orthogonal views gives a majority-rules robustness — no single component dominates.

## Signal Interpretation

### Extreme Thresholds (the state gate)

- **CRSI < 10** = oversold → short-term mean-reversion long candidate.
- **CRSI > 90** = overbought → mean-reversion short candidate.
- The thresholds are extreme (10/90, not 30/70) precisely because CRSI moves fast and reaches its bounds readily. The **state gate fires at the <10 / >90 extremes.**

### Exit Gauge

- Connors' own system exits longs when CRSI recovers into the 50–80 band — CRSI is as much an exit timer as an entry filter.
- The setups are explicitly **short-hold (2–5, up to ~8 days) and counter-trend.**

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.4** — advisory only. Our forward-edge study found **0 significant cells**, with several *negative* t-stats. This is consistent with the indicator's own history: Connors' published backtests were in-sample, hypothetical, parameter-grid-selected, and stop-less over a broad 2001–2012 universe, and Connors himself has said "many of the edges I saw in the 1990s are no longer there."

Critically, his edge was the **full multi-filter system** (ADX > 30 + a measured sell-off + bottom-of-range + limit entry + a CRSI-based exit), not the lone <10 / >90 trigger. Use CRSI as a **pullback-quality and exit gauge on non-trending liquid names**, never as a standalone signal.

## Recommended Combinations

- **CRSI + ADX trend filter**: Connors' design used ADX to confirm a tradable pullback context; in choppy non-trending names CRSI extremes are best as pullback-quality reads, not triggers.
- **CRSI + Bollinger %B**: both surface short-term reversion; if the daily %B short event and a CRSI > 90 align in a mean-reverting regime, that is genuine confluence.
- **CRSI as an exit timer**: pair with a directional entry method and use the 50–80 recovery band to time the exit rather than the entry.

## Caveats

- Standalone forward edge measured at ≈0, with some negative cells — do not treat <10 / >90 as a buy/sell trigger on its own.
- Because CRSI is so fast, it whipsaws in trends; it is a range/pullback tool, not a trend tool.
- The original parameter set (3,2,100) is tuned to daily US equities; transplanting it to other timeframes/markets without re-validation is unsupported.

<!-- PROMPT_DIGEST:START -->
### Connors RSI (CRSI) Signal Guide
Composite short-term mean-reversion oscillator.
- CRSI(3,2,100) = [RSI(close,3) + RSI(streak,2) + PercentRank(ROC1,100)] / 3 (price-momentum + streak-duration + return-magnitude, majority-rules).

Extreme thresholds (state gate):
- CRSI < 10 = oversold → short-term mean-reversion LONG candidate.
- CRSI > 90 = overbought → mean-reversion SHORT candidate.
- Thresholds are extreme (10/90 not 30/70) because CRSI moves fast; state gate fires at <10 / >90.

Exit gauge: Connors exits longs when CRSI recovers into the 50–80 band — it is an exit timer as much as an entry filter. Setups are short-hold (2–5, up to ~8 days) and counter-trend.

Reliability: confidence weight 0.4 (advisory only). Forward-edge study: 0 significant cells, several negative t-stats. Connors' edge was the FULL multi-filter system (ADX>30 + measured sell-off + bottom-of-range + limit entry + CRSI-based exit), NOT the lone <10/>90 trigger. Use as a pullback-quality and exit gauge on non-trending liquid names, never standalone.

Combinations:
- + ADX trend filter: confirm a tradable pullback context; in choppy non-trending names CRSI extremes are pullback-quality reads, not triggers.
- + Bollinger %B: if the daily %B short event and CRSI>90 align in a mean-reverting regime = genuine confluence.
- as exit timer: pair with a directional entry method, use the 50–80 recovery band to time the exit not the entry.

Caveats: standalone edge ≈0 (some negative cells) — do not treat <10/>90 as a buy/sell trigger on its own; whipsaws in trends (range/pullback tool only); (3,2,100) tuned to daily US equities, transplanting without re-validation unsupported.
<!-- PROMPT_DIGEST:END -->
