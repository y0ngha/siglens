---
name: 피보나치 전략
description: 피보나치 되돌림/확장 비율을 활용하여 지지·저항 레벨과 목표가를 산출하고, 패턴·지표와 결합하여 매매 시점을 판별하는 전략
type: strategy
category: neutral
indicators: []
confidence_weight: 0.65
---

## Overview

The Fibonacci Strategy uses ratios derived from the Fibonacci sequence (0, 1, 1, 2, 3, 5, 8, 13, 21, ...) to identify potential support/resistance levels and price targets. The key ratios — 23.6%, 38.2%, 50%, 61.8%, and 78.6% — are applied to price swings to project where pullbacks may find support and where trend extensions may reach.

The 61.8% ratio (the Golden Ratio, approximately 1.618) is the mathematical foundation: each Fibonacci number divided by the next approaches 0.618. The other ratios derive from relationships between numbers at various positions in the sequence.

While the mathematical basis of Fibonacci levels has limited independent predictive power in academic literature, their widespread use among traders worldwide creates a self-fulfilling prophecy effect — enough market participants watch the same levels that price frequently reacts at those points.

---

## Fibonacci Ratios

| Ratio | Source | Common Name | Significance |
|---|---|---|---|
| 0.236 (23.6%) | n / n+3 position | Shallow retracement | Minor support in strong trends |
| 0.382 (38.2%) | n / n+2 position | Moderate retracement | Key support — healthy pullback |
| 0.500 (50.0%) | Not a Fibonacci ratio | Midpoint | Practically significant despite non-Fibonacci origin |
| 0.618 (61.8%) | n / n+1 position (Golden Ratio) | Deep retracement | Most important level — make-or-break for trend |
| 0.786 (78.6%) | Square root of 0.618 | Very deep retracement | Last defense before full retracement |
| 1.272 (127.2%) | Square root of 1.618 | Extension | First extension target |
| 1.618 (161.8%) | Golden Ratio | Extension | Primary extension target |
| 2.000 (200.0%) | 2x | Extension | Round-number extension target |
| 2.618 (261.8%) | 1.618² | Extension | Extended move target |

---

## Fibonacci Retracement

Fibonacci Retracement measures how far price pulls back from a completed swing before resuming the trend.

### Application in an Uptrend

1. Identify a completed upswing: Swing Low (start) → Swing High (end)
2. Draw retracement levels from Swing Low (0%) to Swing High (100%)
3. Retracement levels act as **support**: 23.6%, 38.2%, 50%, 61.8%, 78.6%
4. As price pulls back, watch for bounces at these levels

### Application in a Downtrend

1. Identify a completed downswing: Swing High (start) → Swing Low (end)
2. Draw retracement levels from Swing High (0%) to Swing Low (100%)
3. Retracement levels act as **resistance**: 23.6%, 38.2%, 50%, 61.8%, 78.6%
4. As price bounces, watch for rejection at these levels

### Retracement Depth Interpretation

| Depth | Interpretation |
|---|---|
| 23.6-38.2% | Shallow — very strong trend, minor pause |
| 38.2-50.0% | Moderate — healthy pullback within a normal trend |
| 50.0-61.8% | Deep — trend intact but momentum weakening |
| 61.8-78.6% | Very deep — trend integrity questionable |
| Beyond 78.6% | Near-full retracement — trend likely broken |

---

## Fibonacci Extension

Fibonacci Extension projects potential price targets beyond the original swing by applying Fibonacci ratios.

### Three-Point Extension

1. Identify three points: Swing Low (A) → Swing High (B) → Retracement Low (C)
2. Extension levels project from point C using the A-B distance:
   - 127.2% extension: C + (B − A) × 1.272
   - 161.8% extension: C + (B − A) × 1.618
   - 200.0% extension: C + (B − A) × 2.000
   - 261.8% extension: C + (B − A) × 2.618
3. These levels serve as **profit targets** for positions entered at or near point C

### Target Priority

- **Conservative target**: 127.2% extension
- **Primary target**: 161.8% extension (most commonly reached)
- **Aggressive target**: 200% or 261.8% extension (strong trends only)

---

## Fibonacci Cluster

A Fibonacci Cluster forms when retracement or extension levels from multiple independent swings converge at the same price zone. Clusters create particularly strong support/resistance areas.

**Construction**:
1. Draw Fibonacci retracements from the 2-3 most recent significant swings
2. Identify zones where levels from different swings align within 0.5-1% of each other
3. More overlapping levels = stronger cluster = higher probability of price reaction

**Significance ranking**:
- 2 levels converging: notable zone
- 3+ levels converging: high-probability support/resistance
- Cluster aligned with horizontal support/resistance or moving average: highest probability

---

## Elliott Wave Integration

Fibonacci ratios have specific expected relationships with Elliott Wave positions:

| Wave | Expected Fibonacci Relationship |
|---|---|
| Wave 2 | Retraces 50-61.8% of Wave 1 (deep retracement common) |
| Wave 3 | Extends 161.8% of Wave 1 (measured from Wave 2 end) |
| Wave 4 | Retraces 23.6-38.2% of Wave 3 (shallow retracement common) |
| Wave 5 | Equals Wave 1, or extends 61.8-100% of Waves 1-3 combined |
| Wave A | Often equals Wave 5, or retraces 38.2-61.8% of the impulse |
| Wave C | Often equals Wave A, or extends 127.2-161.8% of Wave A |

When Elliott Wave analysis and Fibonacci levels agree, confidence in both increases substantially.

---

## Entry Rules

### Retracement Buy (Uptrend)

1. **Prerequisite**: Confirmed uptrend with a clear completed upswing
2. **Identify levels**: Draw retracement from the most recent swing low to swing high
3. **Wait for price**: Price pulls back to 38.2%, 50%, or 61.8% level
4. **Confirmation required**: At least one of:
   - Bullish candlestick pattern at the Fibonacci level (hammer, engulfing, morning star)
   - RSI divergence at the level
   - Volume decrease during pullback, increase on bounce
   - Level coincides with horizontal support or moving average
5. **Entry**: On confirmation candle close
6. **Stop loss**: Below the next deeper Fibonacci level (e.g., enter at 38.2%, stop below 50%)
7. **Target**: Retest of the swing high, or Fibonacci extension levels

### Retracement Sell (Downtrend)

1. **Prerequisite**: Confirmed downtrend with a clear completed downswing
2. **Identify levels**: Draw retracement from the most recent swing high to swing low
3. **Wait for price**: Price bounces to 38.2%, 50%, or 61.8% level
4. **Confirmation required**: At least one of the confirmation signals listed above (bearish equivalents)
5. **Entry**: On confirmation candle close
6. **Stop loss**: Above the next shallower Fibonacci level
7. **Target**: Retest of the swing low, or Fibonacci extension levels

### Extension Target Setting

1. After entering at a retracement level, set targets at extension levels
2. **Partial exit strategy**:
   - Close 50% at 127.2% extension
   - Close 30% at 161.8% extension
   - Trail remaining 20% with stop at 127.2%

---

## Exit Rules

- **Primary exit**: Price reaches the Fibonacci extension target
- **Invalidation**: Price breaks through the 78.6% retracement level (trend likely broken — exit long positions)
- **Cluster exit**: If price reaches a Fibonacci cluster from the opposite direction, expect strong resistance — consider taking profit
- **Trailing**: Move stop to breakeven when price reaches the 0% level (original swing high/low), then trail using Fibonacci levels of the new swing

---

## Confidence Weight Rationale

confidence_weight: 0.65 — Fibonacci levels have strong practical utility due to widespread adoption, but independent predictive power is academically weak. The self-fulfilling prophecy effect is real but not guaranteed. Fibonacci levels work best as a confluence tool — combining with other analysis rather than used in isolation.

Factors that increase confidence:
- Fibonacci level aligns with horizontal support/resistance
- Fibonacci cluster (multiple swings converge at the same level)
- Candlestick pattern confirms at the Fibonacci level
- Elliott Wave position matches expected Fibonacci relationship
- Level aligns with a key moving average (MA20, MA50, MA200)

Factors that decrease confidence:
- Fibonacci level used in isolation without any confluence
- No clear swing structure to anchor the Fibonacci drawing
- Choppy, trendless market with no defined swings
- Multiple close retracement levels (38.2% and 50% within 1%) — ambiguous zone

---

## Limitations and Caveats

- **Not a standalone tool**: Academic research consistently shows Fibonacci levels alone do not outperform random support/resistance levels. Their value comes from confluence with other analysis methods
- **Subjective swing selection**: Different traders may select different swing points, producing different levels. Use the most visually obvious, significant swings
- **Self-fulfilling prophecy**: The primary driver of Fibonacci effectiveness is that many traders watch these levels simultaneously. This means the effect can weaken in markets with fewer technical traders
- **Over-application**: Drawing Fibonacci on every minor swing produces too many levels, making the analysis meaningless. Apply only to significant, clearly defined swings
- **The 50% level is not Fibonacci**: Despite being universally included in Fibonacci tools, 50% is a simple midpoint. It works well practically, but attributing it to Fibonacci mathematics is incorrect

---

## AI Analysis Instructions

Identify the most significant recent swing(s) in the price data and calculate Fibonacci retracement levels. If price has already begun retracing, identify which level is currently in play.

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**스윙 구간**: [피보나치 적용 구간, 예: "스윙 저점 $138 → 스윙 고점 $175 (상승 스윙)"]
**주요 되돌림 레벨**: [계산된 레벨, 예: "38.2%=$160.87, 50%=$156.50, 61.8%=$152.13"]
**현재 가격 위치**: [가격이 어느 레벨 근처에 있는지, 예: "50% 레벨($156.50) 근처에서 지지 테스트 중"]
**클러스터 존**: [감지된 피보나치 클러스터, 예: "$155-157 구간에 2개 스윙의 38.2%와 61.8%가 수렴" / "클러스터 미감지"]
**확장 목표가**: [해당 시 확장 레벨, 예: "127.2%=$185.10, 161.8%=$197.83"]
**매매 신호**: [현재 신호, 예: "61.8% 레벨에서 망치형 캔들 확인 — 반등 매수 적합" / "명확한 피보나치 신호 없음"]
**상세 분석**: [스윙 구조, 되돌림 깊이 해석, 지지·저항 수렴 여부, 엘리어트 파동과의 관계(해당 시), 주의사항을 포함한 상세 분석 문단]
```

Additional output rules:
- Calculate retracement levels based on the most significant recent swing (use the largest, clearest swing visible in the data)
- If price is currently **at or near** a Fibonacci level (within 1%), describe the price reaction at that level
- If a **Fibonacci cluster** is identified (levels from multiple swings converging), highlight it as a high-probability zone
- If price has broken below 78.6% retracement, note that the trend is likely invalidated
- Set the `trend` field: `bullish` if price is bouncing from a retracement level in an uptrend, `bearish` if price is rejecting from a retracement level in a downtrend, `neutral` if price is between levels or no clear trend
