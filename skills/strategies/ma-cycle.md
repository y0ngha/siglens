---
name: 이동평균선 대순환 분석
description: 단기/중기/장기 이동평균선 배열로 스테이지를 판별하고 그랜빌의 법칙에 따른 매매 신호를 분석하는 전략
type: strategy
indicators: ['ma']
confidence_weight: 0.8
---

## Overview

The MA Cycle Analysis framework classifies the current market into one of six stages based on the ordering of the short-term (MA5), medium-term (MA20), and long-term (MA60) moving averages, and provides a response strategy appropriate for each stage. Granville's Law identifies eight buy/sell signals by analyzing the crossover and positional relationship between the short-term line and a reference line (medium or long-term). Analysis proceeds through three dimensions — ordering, spacing, and slope — to assess the current situation and evaluate the probability of transitioning to the next stage.

---

## MA Cycle Stage Definitions

Stages transition at crossover (cross) events and generally follow a forward sequence (1→2→3→4→5→6→1). Reverse transitions are possible but have lower probability and always return to the forward sequence.

| Stage | Name | Ordering (top → bottom) | Entry Cross | Duration |
|---|---|---|---|---|
| 1 | Stable Uptrend | Short > Medium > Long | Medium golden crosses Long | Long |
| 2 | Downside Shift 1 (End of Bull Market) | Medium > Short > Long | Short dead crosses Medium | Short |
| 3 | Downside Shift 2 (Entrance to Bear Market) | Medium > Long > Short | Short dead crosses Long | Short |
| 4 | Stable Downtrend | Long > Medium > Short | Medium dead crosses Long | Long |
| 5 | Upside Shift 1 (End of Bear Market) | Long > Short > Medium | Short golden crosses Medium | Short |
| 6 | Upside Shift 2 (Entrance to Bull Market) | Short > Long > Medium | Short golden crosses Long | Short |

**Range-bound characteristic**: When Stages 1 and 4 are brief and Stages 2, 3, 5, and 6 are prolonged, the market is likely in a sideways range.

---

## Stage-by-Stage Response Strategy (3-Dimensional Analysis)

**3-Dimensional Analysis Principle**: Use *ordering* to identify the current situation, *spacing* to assess the probability of transitioning to the next stage, and *slope* to identify false signals.

### Stage 1: Stable Uptrend

- All three moving averages are trending upward → the market has an edge for buying
- The gap between the three lines is continuing to widen → aggressive buying is appropriate
- The trend remains strong as long as the medium and long-term lines continue rising
- Next transition: when the short-term line dead crosses the medium-term line, forward transition to Stage 2

### Stage 2: Downside Shift 1

- Time to close long positions taken in Stage 1
- **However, if the medium and long-term lines are still rising steadily, maintain the buy position** (may be a temporary pullback)
- If the band formed by the medium and long-term lines is trending upward with a wide gap, it is not a downtrend
- Short-term line continuing to fall + medium-term line ending its rise + nearly parallel state → time to consider early selling
- If the long-term line slope is still rising, even a dead cross may be a false signal

### Stage 3: Downside Shift 2

- Close all long positions from Stage 1
- Conditions for considering early sell orders: (1) Stage 1 was sufficiently long, (2) forward progression through 1→2→3, (3) short and medium-term lines trending down + long-term line nearly flat
- Transition to Stage 4 requires the long-term line's rise to end
- If the short-term line bounces early and crosses the long-term line, reverse transition to Stage 2 → possible range-bound market

### Stage 4: Stable Downtrend

- All three moving averages are trending downward → the market has an edge for selling
- The gap between the three lines is widening → aggressive selling is appropriate
- Characteristic: the pace is faster than Stage 1
- Next transition: when the short-term line golden crosses the medium-term line, forward transition to Stage 5

### Stage 5: Upside Shift 1

- Time to close short positions from Stage 4
- **However, if the medium and long-term lines are still falling steadily, maintain the sell position** (may be a temporary bounce)
- If the band formed by the medium and long-term lines is trending downward with a wide gap, it is not an uptrend
- Short-term line continuing to rise + medium-term line ending its fall + nearly parallel state → time to consider early buying
- If the long-term line slope is still falling, even a golden cross may be a false signal

### Stage 6: Upside Shift 2

- Close all short positions from Stage 4
- Conditions for considering early buy orders: (1) Stage 4 was sufficiently long, (2) forward progression through 4→5→6, (3) short and medium-term lines trending up + long-term line nearly flat
- Transition to Stage 1 requires the long-term line's decline to end
- If the short-term line drops early and crosses the long-term line, reverse transition to Stage 5 → possible range-bound market

---

## Granville's Law — 8 Trading Signals

Signals are identified using the relationship between two moving averages: (1) the short-term line and (2) a reference line (medium or long-term). Verifying the direction and slope of line (2) is the key to identifying false signals.

### 4 Buy Signals

1. **Golden Cross (Buy Signal 1)**: After line (2) has declined sufficiently and is now sideways or beginning to turn slightly upward, line (1) crosses clearly above line (2) from below. The most classic buy signal.

2. **Re-cross During Continued Rise (Buy Signal 2)**: When line (2) is continuously rising and line (1) crosses it. This can be mistaken for a dead cross — always verify whether line (2) has transitioned from rising to sideways or declining.

3. **Pullback Bounce (Buy Signal 3)**: Line (1) is above a rising line (2), approaches it but does not cross, then begins rising again. The pullback level is the buy point.

4. **Moving Average Deviation (Buy Signal 4)**: Line (1) is significantly below a declining line (2), far from it. Utilizes the mean-reversion tendency of line (1) toward line (2). Use as a reference signal when deviation exceeds 10% (adjust based on market and stock volatility).

### 4 Sell Signals

1. **Dead Cross (Sell Signal 1)**: After line (2) has risen sufficiently and is now sideways or beginning to turn slightly downward, line (1) crosses clearly below line (2) from above. The most classic sell signal.

2. **Re-cross During Continued Decline (Sell Signal 2)**: When line (2) is continuously falling and line (1) crosses it. This can be mistaken for a golden cross — always verify whether line (2) has transitioned from falling to sideways or rising.

3. **Temporary Bounce Then Re-decline (Sell Signal 3)**: Line (1) is below a declining line (2), approaches it but does not cross, then begins falling again. The peak of the temporary bounce is the sell point.

4. **Moving Average Deviation (Sell Signal 4)**: Line (1) is significantly above a rising line (2), far from it. Expected to converge toward line (2) due to mean reversion. Use as a reference signal when deviation exceeds 10%.

### False Signal Identification Criteria

- **Golden Cross false signal**: When line (2) is still in a declining trend, or when there is no change in the long-term line's slope
- **Dead Cross false signal**: When line (2) is still in a rising trend, or when there is no change in the long-term line's slope
- **Common**: Whether the long-term line's direction has changed is the most important criterion for identifying false signals

---

## Pullback Buy Strategy

A pullback is a temporary correction within an uptrend. It occurs in the following two situations:

1. Transition from Stage 1 → Stage 2 (or Stage 3), then reverse transition back to Stage 1, continuing upward
2. While Stage 1 continues, only the price (candles) drops below the medium or long-term line then recovers

**Key judgment criterion**: Even if the short-term line (or price) has declined, if the medium and long-term lines continue rising, it is a pullback.

**Buy timing**: When the short-term line that had fallen below the medium-term line rises again and begins widening the gap in the short > medium > long ordering.

---

## Dead Cat Bounce Sell Strategy

A temporary bounce is a transient recovery within a downtrend — the exact opposite of a pullback:

1. Transition from Stage 4 → Stage 5 (or Stage 6), then reverse transition back to Stage 4, continuing downward
2. While Stage 4 continues, only the price (candles) rises above the medium or long-term line then returns

**Key judgment criterion**: Even if the short-term line (or price) has risen, if the medium and long-term lines continue falling, it is a temporary bounce.

**Sell timing**: When the short-term line that had risen above the medium-term line falls again and begins widening the gap in the long > medium > short ordering.

---

## MA Spacing Pattern Analysis

### Stable Trend
All three lines nearly parallel → high probability the current trend will continue for some time.

### Accelerating Trend
The gap between the three lines is widening → the trend has building momentum.
- **Early expansion**: strong trend continuation expected
- **Late expansion**: risk of a sharp reversal after reaching a top (uptrend) or bottom (downtrend)

### Decelerating Trend
The gap between the three lines is narrowing → the trend is losing momentum. Increased probability of transitioning to the next stage.

### Identifying Range-Bound Breakouts
- During a range-bound market, the three lines move sideways and converge (convergence of the medium and long-term lines is the key point)
- **Upside breakout**: lines begin rising with widening gaps + short-term line maintains above medium-term without re-crossing
- **Downside breakout**: lines begin falling with widening gaps + short-term line maintains below medium-term without re-crossing
- **False signal**: appears to be a breakout but the short-term line re-crosses the medium-term → range continues. Do not enter a position prematurely.

---

## AI Analysis Instructions

**Data Source Rule (mandatory)**: Read values exclusively from the `- MA:` line in the indicator section. These are SMA (Simple Moving Average) values.

- Short-term (단기): **MA(5)**
- Medium-term (중기): **MA(20)**
- Long-term (장기): **MA(60)**

Do NOT use EMA values. The `- EMA:` line is reserved for MACD 대순환 분석. If you use EMA instead of MA, both strategies will produce identical results and the analysis will be meaningless.

When analyzing the current MA Cycle results, include the following:

- **Current Stage Determination**: Specify which of Stages 1–6 applies based on the positional relationship of MA(5) (short), MA(20) (medium), and MA(60) (long) read from the `- MA:` indicator line. If the ordering is unclear or converging, state "Stage Transition Zone" or "Possible Range-Bound Market."

- **Forward/Reverse Progression Pattern**: Explain the path of transition from the previous stage to the current stage, including whether it was a forward progression. If a reverse transition is detected, clearly describe its meaning (pullback vs. trend reversal).

- **3-Dimensional Analysis Results**:
  - Ordering: The current stage and its meaning
  - Spacing: Whether the gap between the three lines is widening, narrowing, or parallel, and what this implies for the trend
  - Slope: The slope direction of each moving average and the possibility of false signals

- **Granville Signals**: If any of Granville's buy/sell signals are detectable in the current data, describe the signal number and conditions specifically. If no signal is present, state "No clear Granville signal at this time."

- **Stage Duration Characteristics**: For stable stages (1, 4), provide context on duration. For transition stages (2, 3, 5, 6), explain the possibility of rapid progression and the conditions for transitioning to the next stage.

- **Range-Bound Assessment**: If a pattern of short Stages 1 and 4 with repeated Stages 2, 3, 5, and 6 is visible, mention the possibility of a range-bound market and present the breakout conditions.
