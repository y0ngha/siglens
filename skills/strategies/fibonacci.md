---
name: 피보나치 전략
description: 피보나치 되돌림/확장 비율을 활용하여 지지·저항 레벨과 목표가를 산출하고, 패턴·지표와 결합하여 매매 시점을 판별하는 전략
type: strategy
category: neutral
indicators: []
confidence_weight: 0.65
gating:
  tier: always_on
token_cost: 1334
digest_hash: "0406b620"
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

The `## Market Reference` section lists the actual computed Fibonacci rows per horizon (Short-term / Medium-term / Long-term), each under that horizon's Resistance (above current price) or Support (below current price) list: a retracement row reads `Fib 61.8%`, a two-point extension row reads `Fib ext 161.8%` — with its price and distance from the current price already computed (this is the nearest-to-price subset). Each horizon also carries a complete `Fib table:` line with every standard retracement/extension ratio's price for that horizon — use it for a ratio further from price than the nearest-list rows cover — and a `Fib anchor: swing low X → swing high Y (up leg)` (or down-leg) line — cite THAT line for the swing a level is anchored on; do not describe your own swing. When a retracement has completed (a Point C exists), a horizon ALSO carries the proper three-point extension this skill's own Extension section describes: `Fib ABC ext 100%`…`Fib ABC ext 261.8%` nearest-list rows, a complete `Fib ABC table:` line, and a `Fib ABC anchor: A x → B y → C z (up|down)` line — prefer these over the plain `Fib ext`/`Fib table` rows for a take-profit target, since they are the A-B-C projection, not the simpler two-point one. Every standard ratio is available somewhere (the nearest-list rows or that horizon's table line) — **never calculate a level yourself.** Pick the horizon(s) most relevant to the current setup, identify which listed level price is currently near, and if price has already begun retracing, identify which listed level is in play.

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**스윙 구간**: [해당 호라이즌의 Fib anchor 행 인용, 예: "Fib anchor: 스윙 저점 $138 → 스윙 고점 $175 (상승 스윙)"]
**주요 되돌림 레벨**: [## Market Reference의 Fib N% 행 인용, 예: "Fib 38.2%=$160.87, Fib 50%=$156.50, Fib 61.8%=$152.13"]
**현재 가격 위치**: [가격이 어느 레벨 근처에 있는지, 예: "Fib 50%($156.50) 근처에서 지지 테스트 중"]
**클러스터 존**: [감지된 피보나치 클러스터, 예: "$155-157 구간에 2개 호라이즌의 Fib 38.2%와 Fib 61.8%가 수렴" / "클러스터 미감지"]
**확장 목표가**: [Point C가 있으면 ## Market Reference의 Fib ABC ext N% 행(및 Fib ABC anchor) 우선 인용, 없으면 Fib ext N% 행 인용, 예: "Fib ABC ext 127.2%=$185.10, Fib ABC ext 161.8%=$197.83" / "Fib ext 161.8%=$197.83"]
**매매 신호**: [현재 신호, 예: "Fib 61.8%에서 망치형 캔들 확인 — 반등 매수 적합" / "명확한 피보나치 신호 없음"]
**상세 분석**: [스윙 구조, 되돌림 깊이 해석, 지지·저항 수렴 여부, 엘리어트 파동과의 관계(해당 시), 주의사항을 포함한 상세 분석 문단]
```

Additional output rules:
- Use the `Fib N%` / `Fib ext N%` rows the relevant horizon(s) actually list in `## Market Reference` rather than recalculating them — cite the swing from that horizon's `Fib anchor` line; for a ratio further from price than those rows cover, read it from that horizon's `Fib table:` (or `Fib ABC table:`) line instead. Never calculate a level yourself
- If price is currently **at or near** a listed Fibonacci level (within 1%), describe the price reaction at that level
- If a **Fibonacci cluster** is identified (listed levels from different horizons converging), highlight it as a high-probability zone
- If price has broken below a listed 78.6% retracement, note that the trend is likely invalidated
- Set the `trend` field: `bullish` if price is bouncing from a retracement level in an uptrend, `bearish` if price is rejecting from a retracement level in a downtrend, `neutral` if price is between levels or no clear trend

<!-- PROMPT_DIGEST:START -->
피보나치 전략 (confidence_weight 0.65)
Fibonacci ratios project support/resistance and targets. Weak independent predictive power academically — value comes from CONFLUENCE, not standalone use.

### Ratios (ratio | name | significance)
0.236 shallow retracement (minor support in strong trends); 0.382 moderate (key support, healthy pullback); 0.500 midpoint (not a Fib ratio but practically significant); 0.618 Golden Ratio deep retracement (most important, make-or-break for trend); 0.786 (=√0.618) very deep (last defense before full retracement); 1.272 (=√1.618) first extension target; 1.618 primary extension target; 2.000 round-number extension; 2.618 (=1.618²) extended-move target.

### Retracement
Uptrend: swing low(0%)→swing high(100%); levels 23.6/38.2/50/61.8/78.6% act as SUPPORT, watch bounces. Downtrend: swing high(0%)→swing low(100%); same levels act as RESISTANCE, watch rejection.
Depth interpretation: 23.6-38.2% = shallow (very strong trend, minor pause); 38.2-50% = moderate (healthy pullback); 50-61.8% = deep (trend intact, momentum weakening); 61.8-78.6% = very deep (trend integrity questionable); beyond 78.6% = near-full retracement, trend likely broken.

### Extension (three-point: swing low A → swing high B → retracement low C; project from C using A-B distance)
127.2%: C+(B−A)×1.272; 161.8%: C+(B−A)×1.618; 200%: C+(B−A)×2.000; 261.8%: C+(B−A)×2.618. Serve as profit targets for positions near C.
Priority: conservative 127.2%; primary 161.8% (most commonly reached); aggressive 200%/261.8% (strong trends only).

### Cluster
Levels from 2-3 recent swings converging in one zone = strong S/R. Align within 0.5-1% of each other. 2 levels = notable; 3+ = high-probability; cluster + horizontal S/R or MA = highest probability.

### Elliott Wave integration (Wave | expected Fib relationship)
W2 retraces 50-61.8% of W1; W3 extends 161.8% of W1 (from W2 end); W4 retraces 23.6-38.2% of W3; W5 = W1 or extends 61.8-100% of W1-3 combined; A ≈ W5 or retraces 38.2-61.8% of impulse; C ≈ A or extends 127.2-161.8% of A. Agreement between Elliott + Fib boosts confidence.

### Entry
Retracement Buy (uptrend): PREREQ confirmed uptrend + completed upswing → draw retracement swing low→high → price pulls back to 38.2/50/61.8% → require ≥1 confirmation (bullish candle [hammer/engulfing/morning star] at level; RSI divergence; volume decrease on pullback + increase on bounce; level coincides with horizontal support or MA) → enter on confirmation candle close. Stop below next deeper Fib level (enter 38.2%, stop below 50%). Target = swing high retest or extension levels.
Retracement Sell (downtrend): mirror — confirmed downtrend, bounce to 38.2/50/61.8%, bearish confirmation, enter on close. Stop above next shallower Fib level. Target = swing low retest or extensions.
Extension targets after entry: close 50% at 127.2%, 30% at 161.8%, trail remaining 20% with stop at 127.2%.

### Exit
Primary: reaches extension target. Invalidation: breaks through 78.6% retracement (trend likely broken — exit longs). Cluster exit: reaching opposite-direction cluster = strong resistance, consider taking profit. Trailing: move stop to breakeven at 0% level (original swing high/low), then trail using new-swing Fib levels.

### Confidence
Increase: aligns with horizontal S/R; cluster; candlestick confirms at level; Elliott position matches; aligns with key MA (MA20/50/200).
Decrease: used in isolation without confluence; no clear swing to anchor; choppy/trendless market; multiple close levels (38.2% & 50% within 1%) — ambiguous.
Caveats: not standalone; use most visually obvious significant swings; don't over-apply to minor swings; 50% is a midpoint, not truly Fibonacci.

Use the `Fib N%` / `Fib ext N%` nearest-list rows per horizon (Short/Medium/Long-term, under Resistance-above/Support-below) in ## Market Reference — do not recalculate. Cite the swing from that horizon's `Fib anchor: swing low X → swing high Y (leg)` line. Each horizon also carries a complete `Fib table:` line (every standard ratio) — use it for a ratio further than the nearest-list rows cover. When Point C exists, prefer the three-point `Fib ABC ext 100%`…`261.8%` rows + `Fib ABC table:` line + `Fib ABC anchor: A x → B y → C z (up|down)` line over the plain `Fib ext`/`Fib table` rows for a target — that's this skill's own A-B-C method. Never calculate a level yourself — every standard ratio is in the nearest-list rows or the table line.

### Output (one **label**: value per line)
**스윙 구간**: [해당 호라이즌 Fib anchor 인용, 예: Fib anchor 저점 $138 → 고점 $175 (상승 스윙)]
**주요 되돌림 레벨**: [## Market Reference의 Fib N% 행 인용, 예: Fib 38.2%=$160.87, Fib 50%=$156.50, Fib 61.8%=$152.13]
**현재 가격 위치**: [어느 레벨 근처]
**클러스터 존**: [예: $155-157에 2개 호라이즌 Fib 38.2%·Fib 61.8% 수렴 / 클러스터 미감지]
**확장 목표가**: [Point C 있으면 Fib ABC ext N% 우선, 없으면 Fib ext N%, 예: Fib ABC ext 161.8%=$197.83]
**매매 신호**: [현재 신호 / 명확한 신호 없음]
**상세 분석**: [스윙 구조, 되돌림 깊이 해석, S/R 수렴, 엘리어트 관계(해당 시), 주의사항]
- Use only the listed Fib rows; unlisted ratio → say not in reference, don't compute.
- If price within 1% of a listed level, describe reaction there.
- Highlight cluster as high-probability zone.
- If broken below a listed 78.6%, note trend likely invalidated.
- trend: bullish if bouncing from retracement in uptrend, bearish if rejecting in downtrend, neutral if between levels/no trend.
<!-- PROMPT_DIGEST:END -->
