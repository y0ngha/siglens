---
name: MACD-V Signal Guide
description: MACD-V(변동성 정규화 모멘텀) 신호 해석 가이드 — ±150 OB/OS 밴드, 모멘텀 생애주기, 추세 필터 하의 컨플루언스
type: indicator_guide
indicators: ['macdV']
confidence_weight: 0.4
usage_roles: [confirmation]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: macdV
    predicate: level
token_cost: 0
---

## Overview

MACD-V (Volatility-Normalised Momentum) was introduced by Alex Spiroglou in "MACD-V: Volatility Normalised Momentum" (SSRN 4099617, 3 May 2022). It was twice-awarded in 2022 — the NAAIM Founders Award and the CMT Association's Charles H. Dow Award — and extends Gerald Appel's MACD and Thomas Aspray's histogram.

- **Formula**: `MACD-V = [(EMA(close,12) − EMA(close,26)) / ATR(26)] × 100`, with Signal = EMA(MACD-V, 9). Standard 12/26/9 momentum, normalized by ATR(26).
- **Principle**: it measures momentum *in excess of average volatility*, expressed as a percentage. Dividing by ATR makes the reading comparable both across time and across markets (a plain PPO fixes only the cross-time problem). The same ±150 band held on the S&P, the Bund, and Natural Gas in the source study.

## Signal Interpretation

### ±150 OB/OS Band

- |MACD-V| ≥ 150 is the ~95%-containment overbought/oversold zone — the **state gate fires here** (the ±150 risk zone). A cross *up* through −150 is an oversold reset; a cross *down* through +150 is an overbought rollover.
- ±50 marks the weak/strong momentum transition; the 0-line is a momentum-regime flip.

### Momentum Lifecycle

- Spiroglou maps an 8-state "momentum lifecycle" (Ranging / Rallying / Rebounding / Retracing / Reversing / Risk). The value plus its direction places price in one of these states rather than giving a binary buy/sell.

### Trend-Filtered Asymmetry

- Under a 200-EMA trend filter the OB/OS levels become asymmetric: in a bull regime, pullbacks tend to bottom near −100 (the "new oversold"), not −150. Read the band relative to the prevailing trend, not absolutely.

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.4** — advisory only. In our 2-year look-ahead-safe forward-edge study, MACD-V scored **0 of 18 cells significant** (best was 1H h=12, t ≈ 1.94, not significant). This null does **not** contradict the source paper: Spiroglou's work is descriptive/taxonomic and contains no forward-profitability test, so there was never a standalone edge claimed to refute.

Use MACD-V as **momentum-state context under a trend filter**, never as a standalone intraday trigger.

## Recommended Combinations

- **MACD-V + 200-EMA trend filter**: only act on oversold resets in an uptrend and overbought rollovers in a downtrend; the trend filter is what gives the band its asymmetric, usable meaning.
- **MACD-V + regime lens (Hurst / Variance Ratio / Regression R²)**: in a high-R² / H > 0.5 trend, treat ±150 as continuation context; in a mean-reverting regime, an extreme is closer to a reversion setup.
- **MACD-V + an event signal (e.g. Bollinger %B, MACD cross)**: let MACD-V grade the momentum backdrop while a separate event provides the trigger.

## Caveats

- Standalone forward edge measured at ≈0 — present it as confluence, not a signal.
- The ±150 band is a volatility-normalized convention, not a hard law; under a trend filter the effective oversold can sit nearer −100.
- ATR(26) normalization means very low-volatility regimes can inflate the reading; cross-check the volatility lens (Yang-Zhang / EWMA) before trusting an extreme.
