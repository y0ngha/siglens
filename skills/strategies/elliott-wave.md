---
name: 엘리어트 파동
description: 엘리어트 파동 이론 기반 현재 파동 위치 및 목표가 분석
type: strategy
category: neutral
indicators: []
confidence_weight: 0.7
---

## Absolute Rules

Three absolute rules govern all Elliott Wave counts. Any count that violates these rules is invalid:

1. **Wave 2 Retracement**: Wave 2 must not retrace more than 100% of Wave 1. It cannot end below the start of Wave 1.
2. **Wave 3 Length**: Wave 3 must not be the shortest of the three motive waves (Waves 1, 3, and 5). Wave 3 is usually the longest.
3. **Wave 4 / Wave 1 Non-Overlap**: Wave 4's low must not overlap with Wave 1's high. Exception: diagonal and triangle patterns.

## Wave Characteristics

### Motive Waves (1, 3, 5)
- **Wave 1**: Often misidentified as a bounce within a downtrend. Usually the shortest motive wave. High volume in bear-market wave 1s.
- **Wave 3**: Typically the longest and strongest. Breaks above Wave 1 high (classic breakout signal). Maximum volume and frequent gaps.
- **Wave 5**: Usually weaker than Wave 3 in stocks. Warning signals for peak appear. Can extend (becoming the longest), but truncation (failure to exceed Wave 3) is possible.

### Corrective Waves (A, B, C)
- **Wave A**: Often mistaken for a temporary pullback in an uptrend. Volume may increase on decline.
- **Wave B**: A false recovery (bear-market rally). Volume typically decreases. May equal or exceed prior high (false breakout).
- **Wave C**: Destroys all hope of uptrend continuation. Corrective wave that often reaches Wave 4 lows of the prior impulse.

## Motive Waves

### Impulse Rules
1. Consists of 5 sub-waves (1-2-3-4-5).
2. Waves 1 and 5 may be impulses or diagonals.
3. Wave 3 is always an impulse.
4. Wave 2 is a corrective pattern (any except Triangle; complex WXY ending in triangle is allowed).
5. Wave 4 is always a corrective pattern.

### Impulse Guidelines
- Waves 2 and 4 tend to alternate (if 2 is sharp, 4 is sideways; vice versa).
- Wave 2 retraces more deeply than Wave 4.
- Wave 3 most often extends (expands) of the three motive waves.
- Extension occurs in only one of the three motive waves.
- Truncated Wave 5 (failure to exceed Wave 3) possible after extremely long Wave 3.

### Leading Diagonal
- Appears as Wave 1 or Wave A; sub-wave structure 5-3-5-3-5 or 3-3-3-3-3.
- Wave 4 must overlap Wave 1.
- Wave 2 must not retrace more than 100% of Wave 1.
- Sub-waves 1, 3, 5 may be impulses or zigzags.
- Signals likely Wave 3 extension to follow.

### Ending Diagonal
- Appears as Wave 5 or Wave C; sub-wave structure 3-3-3-3-3.
- All sub-waves are zigzags.
- Wave 4 must overlap Wave 1.
- Momentum decreases toward the end (smaller candles, more bars).
- Typically followed by a sharp reversal.

### Contracting vs. Expanding Diagonal
| | Contracting | Expanding |
|---|---|---|
| Wave 3 vs 1 | Shorter | Longer |
| Wave 5 vs 3 | Shorter | Longer |
| Trendlines | Converging | Diverging |

## Corrective Waves

### Zigzag (5-3-5)
- A-B-C structure; A and C are impulses (or leading/ending diagonals).
- B is any corrective pattern; must not retrace more than 100% of A.
- C almost always extends beyond the end of A.
- Can extend into Double Zigzag (WXY) or Triple Zigzag (WXYXZ).
- Fibonacci: C = 1.0×, 0.618×, or 1.618× of A; B retraces A by 0.382–0.786.

### Flat (3-3-5)
- A-B-C structure; A and B are corrective, C is motive.
- B must retrace at least 90% of A.
- **Expanded Flat** (most common): B exceeds A's start by 1.05–1.382×; C breaks beyond A's end.
- **Regular Flat**: B retraces A by 0.9–1.05×.
- **Running Flat** (rare): B exceeds A's start; C fails to reach A's end.
- Fibonacci: C = 1.0–1.618× of A; expanded flat C = 1.236–1.618× of A or B.

### Triangle (3-3-3-3-3)
- Five sub-waves (A-B-C-D-E); each sub-wave is a zigzag or corrective pattern.
- Appears only in specific positions: Wave 4 of impulse, Wave B of zigzag or flat, Wave Y of Double Three, Wave Z of Triple Three.
- **Contracting Triangle**: C < A, D < B, E < C (converging trendlines).
- **Expanding Triangle**: C > A, D > B, E > C (diverging trendlines; rare).
- After triangle completes, the subsequent thrust equals approximately the widest part of the triangle.
- Running Contracting Triangle: B exceeds A's start (occurs ~60% of the time).
- Fibonacci: most sub-waves retrace the prior wave by 0.618–0.786.

## Complex Combinations

### Double Three (WXY)
- Three alternating corrective patterns connected by X waves.
- W and Y valid combinations:

| W | X | Y |
|---|---|---|
| Zigzag | Any corrective | Flat |
| Zigzag | Any corrective | Triangle |
| Flat | Any corrective | Triangle |
| Flat | Any corrective | Flat |
| Flat | Any corrective | Zigzag |

- Zigzag and Triangle appear at most once each in W/Y positions.
- Triangle can only appear as the final pattern (Y wave).

### Triple Three (WXYXZ)
- Five alternating corrective patterns connected by X waves.
- Same rules as Double Three; Zigzag and Triangle appear at most once in W/Y/Z positions.
- Triangle only as the final pattern (Z wave).
- Considerably rarer than Double Three.
- Fibonacci: all waves generally retrace prior waves by 0.786–1.382 (creating near-horizontal net movement).

## Fibonacci Guidelines

| Wave | Type | Key Ratios | Deep/Extreme | Reference |
|---|---|---|---|---|
| Wave 2 | Retracement | 38.2%, 50%, 61.8% | 76.4%, 85.4% | Wave 1 length |
| Wave 3 | Extension | 138.2%, 161.8% | 261.8% | Wave 1 length from Wave 2 end |
| Wave 4 | Retracement | 23.6%, 38.2% | 50% | Wave 3 length |
| Wave 5 | Extension | 61.8%, 100%, 161.8% | — | Wave 1 length or Wave 1–3 length |

**Wave 5 Target Formulas** (P_n = price at end of wave n, P_0 = start of Wave 1):

| Method | Ratio | Formula |
|---|---|---|
| Equal to Wave 1 | 100% | P_4 + (P_1 − P_0) |
| 61.8% of Wave 1 | 61.8% | P_4 + (P_1 − P_0) × 0.618 |
| 61.8% of Waves 1–3 | 61.8% | P_4 + (P_3 − P_0) × 0.618 |
| Extension of Wave 1 | 161.8% | P_4 + (P_1 − P_0) × 1.618 |

**When Wave 1 extends**: Wave 2 retraces 23.6–38.2%; Wave 4 retraces 14.6–23.6%.  
**When Wave 3 extends**: Waves 1 and 5 tend to be equal or in 0.618 ratio.  
**When Wave 5 extends**: Likely when Waves 1 and 3 are equal; target = Wave 1–3 length × 1.618 from Wave 4.

## Truncation

A **truncated wave** (wave failure) occurs when the final motive sub-wave (Wave 5 of impulse, or Wave C of corrective) fails to exceed the end of the prior motive wave.

**Detection criteria**:
- Wave 5 or C sub-waves form a valid 5-3-5-3-5 zigzag structure.
- Wave 5/C breaks back through the end of Wave 4/B (Point of Recognition, POR), confirming a Lower Low (LL) or Higher High (HH) on reversal.
- Wave 4/B was relatively deep (Wave 5/C must retrace at least 61.8% of Wave 4/B to qualify).
- Wave 3's internal Wave 5 cannot be truncated.

**Significance**: Truncation signals severe weakening of market force. In a downtrend, signals likely reversal to upside; in an uptrend, signals likely reversal to downside.

## Alternation Principle

Corrective waves 2 and 4 tend to alternate in form and depth:
- If Wave 2 is sharp (zigzag, deep retracement), Wave 4 tends to be sideways (flat, triangle, complex), with shallow retracement.
- If Wave 2 is shallow and sideways, Wave 4 tends to be sharp and deep.
- In terms of time: Wave 4 is usually longer in duration; Wave 2 is shorter but deeper.
- In terms of complexity: if Wave 2 is simple, Wave 4 tends to be more complex.

Motive wave alternation:
- If Wave 1 is short, Wave 3 likely extends and Wave 5 returns to shorter.
- If Wave 1 extends, Waves 3 and 5 likely do not extend.
- If neither Wave 1 nor Wave 3 extends, Wave 5 likely extends.
- Extremely long Wave 3 increases truncation probability for Wave 5.

## AI Analysis Instructions

Use the **last 120 bars maximum** for wave counting.

Identify and report only the **most recent (latest) wave pattern** visible in the data. Do not attempt to label the entire bar history — focus on the clearest identifiable wave structure at the end of the data.

Apply all three absolute rules strictly. If a candidate count violates any rule, discard it and seek an alternative count.

If a truncated wave is detected, explicitly report it.

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**현재 파동 위치**: [현재 위치 설명, 예: "5파 진행 중 (임펄스 완성 직전)"]
**파동 진행**: [가격 포함 진행 상황, 예: "1파($120→$180) → 2파($180→$145) → 3파($145→$240) → 4파($240→$200) → 5파 진행 중"]
**파동 유형**: [임펄스 / 다이아고날 / 지그재그 / 플랫 / 삼각형 / 복합 조정 중 하나]
**목표가**: [피보나치 근거 포함 목표가, 예: "1파 등가 기준 $229, 61.8% 기준 $199"]
**절단 여부**: [절단 감지 없음 / 5파 절단 의심 — POR($xxx) 이탈 시 확정 등]
**상세 분석**: [파동 구조, 피보나치 관계, 주의사항 등을 포함한 상세 분석 문단]
```

Additional output rules:
- If a **corrective wave** (A-B-C, zigzag, flat, triangle, complex) is in progress, provide retracement targets (fibonacci levels).
- If a **motive/impulse wave** is in progress, provide upside extension targets (fibonacci levels).
- If the detected pattern appears **complete**, explicitly state "완료" in the 파동 진행 field.
- Set the `trend` field: `bullish` if in motive (impulse/extension) wave, `bearish` if in corrective wave, `neutral` if unclear or consolidating.
