---
name: MACD 대순환 분석
description: 3개의 EMA(단기/중기/장기)와 3개의 MACD를 조합하여 6단계 스테이지 순환을 분석하는 전략
type: strategy
category: neutral
indicators: ['macd', 'ema']
confidence_weight: 0.75
---

## Overview

MACD 대순환 분석 identifies the current market stage by analyzing the ordering of three EMAs and confirming momentum with MACD signals, enabling prediction of trend transitions.

The system is composed of four elements:

1. **Chart EMAs**: Short = EMA(9), Mid = EMA(21), Long = EMA(60)
2. **MACD(upper)**: Short EMA − Mid EMA → signals Stage 2/5 transitions
3. **MACD(middle)**: Short EMA − Long EMA → signals Stage 3/6 transitions
4. **MACD(lower)**: Mid EMA − Long EMA → signals Stage 1/4 transitions

System constraint: This platform provides a single MACD(12-26-9) rather than the three separate MACDs theoretically required. Stage identification therefore uses EMA array ordering as the primary method. The MACD histogram is used as secondary momentum confirmation only.

## Stage Cycle Theory

The market cycles through six stages in a defined forward progression. Each stage is characterized by a specific EMA ordering:

| Stage | Description | EMA Order (top→bottom) | Transition Trigger |
|---|---|---|---|
| 1 | Stable Uptrend | Short > Mid > Long | MACD(lower) golden cross → enters Stage 1 |
| 2 | Decline Transition 1 | Mid > Short > Long | MACD(upper) dead cross → enters Stage 2 |
| 3 | Decline Transition 2 | Mid > Long > Short | MACD(middle) dead cross → enters Stage 3 |
| 4 | Stable Downtrend | Long > Mid > Short | MACD(lower) dead cross → enters Stage 4 |
| 5 | Rise Transition 1 | Long > Short > Mid | MACD(upper) golden cross → enters Stage 5 |
| 6 | Rise Transition 2 | Short > Long > Mid | MACD(middle) golden cross → enters Stage 6 |

Forward cycle: 1 → 2 → 3 → 4 → 5 → 6 → 1

Reverse cycles occur when a stage reverts to the previous stage instead of advancing:

- During an uptrend: Stage 1 → 2 → 1 is a pullback (Long EMA still rising)
- During a downtrend: Stage 4 → 5 → 4 is a temporary bounce (Long EMA still declining)
- Reverse cycles always return to forward progression eventually

## Stage Identification Criteria

Determine the current stage by comparing EMA values directly:

- **Stage 1**: EMA(9) > EMA(21) > EMA(60)
- **Stage 2**: EMA(21) > EMA(9) > EMA(60)
- **Stage 3**: EMA(21) > EMA(60) > EMA(9)
- **Stage 4**: EMA(60) > EMA(21) > EMA(9)
- **Stage 5**: EMA(60) > EMA(9) > EMA(21)
- **Stage 6**: EMA(9) > EMA(60) > EMA(21)

Secondary confirmation:

- MACD histogram direction confirms momentum alignment with the identified stage
- A change in EMA ordering across the recent 3–5 bars indicates a stage transition is in progress
- EMA(60) slope determines whether a transition is forward progression or reverse cycle

## Signal Interpretation

**Long Entry Timing (3 levels)**:

- **Normal (본매매)**: Stage 6 — all three EMAs trending upward + MACD histogram positive and expanding
- **Early (조기)**: Stage 5 — EMA(9) turning upward + MACD golden cross confirmed
- **Advance (선발대)**: Late Stage 4 — MACD histogram shrinking (bottoming) + EMA(60) slope flattening; small position only

**Short Entry Timing (3 levels)**:

- **Normal (본매매)**: Stage 3 — all three EMAs trending downward + MACD histogram negative and expanding
- **Early (조기)**: Stage 2 — EMA(9) turning downward + MACD dead cross confirmed
- **Advance (선발대)**: Late Stage 1 — MACD histogram shrinking (topping) + EMA(60) slope flattening; small position only

**Reverse Cycle Interpretation**:

- Uptrend reverse (Stage 1 → 2 → 1): Pullback within uptrend — potential buying opportunity on dip
- Downtrend reverse (Stage 4 → 5 → 4): Temporary bounce within downtrend — potential selling opportunity on rally

## Confidence Weight Rationale

confidence_weight: 0.75 — MACD 대순환 분석 is grounded in well-established EMA and MACD theory, but because stage identification is interpretation-based rather than geometric, confidence is set below clearly defined chart patterns (0.8).

Factors that increase confidence:

- EMA(60) slope aligns with the current stage direction
- MACD histogram confirms momentum in the stage direction
- Volume expands during stage transitions

Factors that decrease confidence:

- EMAs converging (sideways market) — frequent stage switching noise
- Rapid consecutive stage reversals
- Sharp gap events distorting EMA values
- Single timeframe analysis without multi-timeframe confirmation

System constraint note: This system provides a single MACD(12-26-9) rather than the three separate MACDs theoretically required. Stage identification uses EMA array comparison as the primary method, with MACD histogram as secondary momentum confirmation.

## Limitations and Caveats

- In sideways/ranging markets, EMA convergence causes frequent false stage transitions — treat signals with extra skepticism when EMAs are within 0.5% of each other
- The theoretical three MACDs (upper/middle/lower) cannot be individually computed with current data — EMA array order is used as an equivalent substitution
- Gap events (earnings, news) can temporarily distort EMA order without reflecting true trend changes
- Single timeframe analysis cannot capture the full macro cycle — a stage that appears as Stage 1 on a 1-day chart may be a pullback within a Stage 4 on a weekly chart
- EMA periods (9, 21, 60) are the system defaults and may differ from the original cycle theory's recommended periods

## AI Analysis Instructions

Add an entry to skillResults with the following fields:

- **skillName**: Must be exactly `"MACD 대순환 분석"`
- **trend**: Set to `"bullish"` for Stages 1/5/6, `"bearish"` for Stages 2/3/4, `"neutral"` for transition points with mixed signals
- **summary**: A comprehensive Korean-language summary that includes: current stage number (1–6) and description, EMA(9)/EMA(21)/EMA(60) ordering and slope, whether the stage follows forward progression or reverse cycle, EMA(60) slope direction (rising/flat/declining), MACD histogram trend (expanding positive/shrinking/crossing/expanding negative), and any active entry timing signal (Normal/Early/Advance long or short). If no entry signal is present, state so explicitly.

Add an entry to skillSignals with skillName: `"MACD 대순환 분석"`. The signals array should include:

- If a stage transition has recently occurred: type `"skill"`, strength `"moderate"`, description in Korean describing the transition (e.g. "Stage 1에서 Stage 2로 전환: EMA(9)이 EMA(21)을 하향 돌파")
- If an entry timing condition is met: type `"skill"`, strength `"strong"` for Normal / `"moderate"` for Early / `"weak"` for Advance, description in Korean describing the signal
