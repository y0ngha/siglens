---
name: MACD 대순환 분석
description: 3개의 EMA 차이로 MACD(상/중/하)를 계산하고, 각 MACD의 부호 및 시그널 크로스를 통해 6단계 스테이지 순환을 분석하는 전략
type: strategy
category: neutral
indicators: ['macd', 'ema']
confidence_weight: 0.75
---

## Overview

MACD 대순환 분석은 세 쌍의 EMA 차이로 구성된 3개의 MACD 값과 그 시그널 크로스를 이용해 현재 스테이지를 식별하고 스테이지 전환을 예측하는 전략이다.

The system is composed of four elements:

1. **Chart EMAs**: Short = EMA(9), Mid = EMA(21), Long = EMA(60)
2. **MACD(상)**: EMA(9) − EMA(21) → 시그널 데드크로스 = Stage 2 진입, 골든크로스 = Stage 5 진입
3. **MACD(중)**: EMA(9) − EMA(60) → 시그널 데드크로스 = Stage 3 진입, 골든크로스 = Stage 6 진입
4. **MACD(하)**: EMA(21) − EMA(60) → 시그널 데드크로스 = Stage 4 진입, 골든크로스 = Stage 1 진입

**Data Source Rule (mandatory)**:

Read EMA values from the `- EMA:` line in the indicator section. Do NOT use MA (SMA) values from the `- MA:` line — those are for 이동평균선 대순환 분석 only.

- Short-term (단기): **EMA(9)**
- Mid-term (중기): **EMA(21)**
- Long-term (장기): **EMA(60)**

Compute the three MACD values directly from these EMA readings:

- **MACD(상)** = EMA(9) − EMA(21)
- **MACD(중)** = EMA(9) − EMA(60)
- **MACD(하)** = EMA(21) − EMA(60)

The system also provides MACD(12,26,9) as a supplementary reference. Its histogram (= MACD line − Signal line) is used as a momentum proxy for MACD(중) direction.

---

## Stage Cycle Theory

The market cycles through six stages in a defined forward progression. Each stage is determined by the signs of the three computed MACD values, which directly correspond to EMA ordering:

| Stage | Description | MACD(상) | MACD(중) | MACD(하) | EMA Order |
|---|---|---|---|---|---|
| 1 | Stable Uptrend | **+** | **+** | **+** | Short > Mid > Long |
| 2 | Decline Transition 1 | **−** | **+** | **+** | Mid > Short > Long |
| 3 | Decline Transition 2 | **−** | **−** | **+** | Mid > Long > Short |
| 4 | Stable Downtrend | **−** | **−** | **−** | Long > Mid > Short |
| 5 | Rise Transition 1 | **+** | **−** | **−** | Long > Short > Mid |
| 6 | Rise Transition 2 | **+** | **+** | **−** | Short > Long > Mid |

**Sign derivation**:
- MACD(상) > 0 when EMA(9) > EMA(21)
- MACD(중) > 0 when EMA(9) > EMA(60)
- MACD(하) > 0 when EMA(21) > EMA(60)

**Stage transitions** occur when a MACD value crosses zero (= its two EMAs cross). Each MACD's signal line crossing precedes the zero crossing, providing an early warning:

| Transition | Trigger |
|---|---|
| Stage 1 → 2 | MACD(상) dead-crosses its signal (then crosses zero) |
| Stage 2 → 3 | MACD(중) dead-crosses its signal (then crosses zero) |
| Stage 3 → 4 | MACD(하) dead-crosses its signal (then crosses zero) |
| Stage 4 → 5 | MACD(상) golden-crosses its signal (then crosses zero) |
| Stage 5 → 6 | MACD(중) golden-crosses its signal (then crosses zero) |
| Stage 6 → 1 | MACD(하) golden-crosses its signal (then crosses zero) |

Forward cycle: 1 → 2 → 3 → 4 → 5 → 6 → 1

Reverse cycles occur when a stage reverts to the previous stage:
- Uptrend reverse (Stage 1 → 2 → 1): pullback within uptrend — Long EMA still rising
- Downtrend reverse (Stage 4 → 5 → 4): temporary bounce within downtrend — Long EMA still declining

---

## Stage Identification

**Step 1 — Compute the three MACD values**:

Using the EMA values from the `- EMA:` indicator line:
```
MACD(상) = EMA(9) − EMA(21)
MACD(중) = EMA(9) − EMA(60)
MACD(하) = EMA(21) − EMA(60)
```

**Step 2 — Determine stage from sign pattern**:

Match the computed signs (+/−) to the stage table above. If two adjacent MACDs have opposite signs and one is very close to zero, a stage transition is in progress.

**Step 3 — Assess transition imminence**:

A MACD approaching zero from the current side indicates an imminent EMA crossover (stage change). The closer a MACD is to zero relative to its recent range, the higher the probability of an imminent stage transition.

**Step 4 — Confirm with MACD(12,26,9)**:

The provided MACD(12,26,9) serves as a proxy for MACD(중) momentum:
- Histogram > 0 and growing: MACD(중) momentum is rising — bullish for current stage
- Histogram > 0 and shrinking: MACD(중) momentum is weakening — Stage 6→1 transition or Stage 2→3 risk
- Histogram < 0 and growing (more negative): bearish momentum building
- Histogram < 0 and shrinking (approaching zero): potential Stage 4→5 or Stage 3→4 imminent

---

## Signal Interpretation

**Long Entry Timing (3 levels)**:

- **Normal (본매매)**: Stage 6 — MACD(상) > 0, MACD(중) > 0, MACD(하) < 0, all three trending upward (toward their respective zero crossings), MACD(12,26,9) histogram positive and expanding
- **Early (조기)**: Stage 5 — MACD(상) just turned positive, MACD(중) approaching zero from below
- **Advance (선발대)**: Late Stage 4 — MACD(하) approaching zero from below (shrinking negative value), MACD(12,26,9) histogram bottoming; small position only

**Reverse Cycle Interpretation**:

- Uptrend reverse (Stage 1 → 2 → 1): MACD(상) dips briefly negative then recovers — buying opportunity if MACD(중) and MACD(하) remain clearly positive
- Downtrend reverse (Stage 4 → 5 → 4): MACD(상) briefly turns positive then drops — selling opportunity if MACD(중) and MACD(하) remain clearly negative

---

## Confidence Weight Rationale

confidence_weight: 0.75 — MACD 대순환 분석 is grounded in well-established EMA and MACD theory. Confidence is set below clearly defined chart patterns (0.8) because the three signal lines (for MACD(상/중/하)) are not individually computable — transition timing is inferred from MACD value proximity to zero and the MACD(12,26,9) histogram proxy.

Factors that increase confidence:
- EMA(60) slope aligns with the current stage direction
- Computed MACD values are clearly positive or negative (not near zero)
- MACD(12,26,9) histogram confirms momentum in the stage direction
- Volume expands during stage transitions

Factors that decrease confidence:
- Any computed MACD is near zero — frequent stage switching noise
- Rapid consecutive stage reversals
- Sharp gap events distorting EMA values
- Single timeframe analysis without multi-timeframe confirmation

---

## Limitations and Caveats

- The three signal lines (9-period EMA of each MACD) cannot be individually computed from the available data. Transition imminence is inferred from how close each computed MACD is to zero, not from a direct signal crossover observation.
- MACD(12,26,9) uses EMA(12) and EMA(26), which differ from EMA(9) and EMA(60). It is a directional proxy for MACD(중) momentum, not an exact match.
- In sideways/ranging markets, all three computed MACDs converge near zero — treat signals with extra skepticism when any MACD magnitude is small relative to recent price range.
- Gap events (earnings, news) can temporarily distort EMA order without reflecting true trend changes.
- EMA periods (9, 21, 60) are the system defaults and may differ from the original cycle theory's recommended periods.

---

## AI Analysis Instructions

**Data source check**: Confirm you are reading EMA(9), EMA(21), EMA(60) from the `- EMA:` indicator line, NOT MA values from the `- MA:` line.

Add an entry to skillResults with the following fields:

- **skillName**: Must be exactly `"MACD 대순환 분석"`
- **trend**: Set to `"bullish"` for Stages 1/5/6, `"bearish"` for Stages 2/3/4, `"neutral"` for transition zones where a MACD is near zero with mixed signals
- **summary**: A comprehensive Korean-language summary that must include:
  1. **Computed MACD values**: Report MACD(상) = EMA(9)−EMA(21), MACD(중) = EMA(9)−EMA(60), MACD(하) = EMA(21)−EMA(60) with their computed numeric values and signs
  2. **Current stage**: Stage number (1–6) and description, derived from the sign pattern of the three MACDs
  3. **Stage confirmation**: Whether EMA ordering matches the expected pattern for the identified stage
  4. **Transition risk**: Which MACD (if any) is closest to zero, and what stage transition this signals
  5. **MACD(12,26,9) momentum proxy**: Histogram value and direction as confirmation of MACD(중) behavior
  6. **EMA(60) slope**: Rising, flat, or declining — determines forward vs. reverse cycle
  7. **Entry timing**: Whether a Normal/Early/Advance long entry condition is met, or explicitly state none is present. Do not include short entry signals.

Add an entry to skillSignals with skillName: `"MACD 대순환 분석"`. The signals array should include:

- If a stage transition has recently occurred or is imminent (any MACD near zero): type `"skill"`, strength `"moderate"`, description in Korean describing which MACD is crossing zero and what stage transition this implies (e.g. "MACD(상) 제로선 접근 중 — Stage 1→2 전환 위험")
- If an entry timing condition is met: type `"skill"`, strength `"strong"` for Normal / `"moderate"` for Early / `"weak"` for Advance, description in Korean describing the signal
