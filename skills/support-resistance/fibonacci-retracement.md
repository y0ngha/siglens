---
name: 피보나치 되돌림
description: 주요 가격 스윙의 되돌림 비율로 잠재적 지지/저항 레벨을 식별하는 피보나치 분석 도구
type: support_resistance
category: neutral
indicators: []
confidence_weight: 0.7
gating:
  tier: always_on
token_cost: 561
digest_hash: "922c365e"
---

## Overview

Fibonacci Retracement identifies potential support and resistance levels by measuring the percentage retracement of a significant price move. The tool is based on the Fibonacci sequence ratios — particularly 23.6%, 38.2%, 50%, 61.8%, and 78.6% — which consistently appear in natural price movements due to the self-fulfilling nature of widespread trader adoption.

The core principle: after a significant price swing (impulse move), prices tend to retrace a predictable portion of that move before resuming the original trend. The retracement levels indicate where buying or selling pressure is likely to re-emerge.

---

## Key Retracement Levels

### 23.6% — Shallow Retracement
- Indicates a very strong trend with minimal pullback
- Common in momentum-driven moves and breakout continuations
- Shallow retracements suggest aggressive buying/selling pressure

### 38.2% — Moderate Retracement
- Considered a "healthy" correction within a strong trend
- One of the most reliable levels for trend continuation entries
- Frequently aligns with Wave 4 corrections in Elliott Wave theory

### 50.0% — Half Retracement
- Not a true Fibonacci ratio but widely observed (based on Dow Theory)
- Psychologically significant — the "halfway back" level
- Strong reactions at this level indicate balanced supply/demand

### 61.8% — Golden Ratio Retracement
- The most important Fibonacci level — the "Golden Pocket" zone (61.8%–65%)
- Deep retracement that often marks the final line of defense for the trend
- Strongest confluence when combined with other indicators (MA, Bollinger)

### 78.6% — Deep Retracement
- Very deep pullback that tests the trend's integrity
- If price retraces beyond 78.6%, trend reversal probability increases significantly
- Often the last viable support/resistance before a full reversal

---

## Application Method

### In an Uptrend
1. Identify the most recent significant Swing Low (0%) and Swing High (100%)
2. Apply retracement levels between these two points
3. Retracement levels act as **support** — areas where buying pressure may re-emerge
4. Entry consideration: wait for price to reach a retracement level + confirmation signal

### In a Downtrend
1. Identify the most recent significant Swing High (0%) and Swing Low (100%)
2. Apply retracement levels between these two points
3. Retracement levels act as **resistance** — areas where selling pressure may re-emerge
4. Entry consideration: wait for price to reach a retracement level + confirmation signal

### Multi-Swing Analysis
- Draw Fibonacci retracements from multiple significant swings
- Where levels from different swings cluster (overlap), the zone has higher significance
- Cluster zones represent areas of exceptionally strong support/resistance

---

## Signal Interpretation

### Bullish Signals
- Price bounces at a retracement level with a bullish reversal candle pattern → long entry signal
- Retracement stays above 38.2% → very strong uptrend (high probability of continuation)
- Fibonacci level + moving average convergence → high-confidence support zone

### Bearish Signals
- Price rejects at a retracement level with a bearish reversal candle pattern → short entry signal
- Retracement exceeds 61.8% → trend weakening, reversal probability increasing
- Fibonacci level + Bollinger Band convergence → high-confidence resistance zone

### Confluence Enhancement
- Fibonacci level + EMA/MA alignment → increased reliability
- Fibonacci level + volume spike → strong demand/supply zone
- Multiple Fibonacci levels from different swings overlapping → cluster zone (very high significance)

---

## Elliott Wave Combination

- **Wave 2**: Typically retraces 50%–61.8% of Wave 1
- **Wave 4**: Typically retraces 38.2% of Wave 3
- **Wave 3 ≠ shortest wave**: Projects to 161.8% extension of Wave 1
- Use retracement levels to validate current wave position

---

## AI Analysis Instructions

When analyzing with Fibonacci Retracement:

1. Identify the most significant recent swing points (Swing High and Swing Low) from the provided bar data.
2. Apply Fibonacci retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%) between the identified swing points.
3. Determine which retracement levels are nearest to the current price.
4. Assess the depth of the current retracement to evaluate trend strength:
   - Below 38.2%: very strong trend
   - 38.2%–50%: healthy correction
   - 50%–61.8%: deep correction, trend still intact
   - Above 61.8%: trend weakening, reversal risk
5. Check for confluence with other indicators (MAs, Bollinger Bands, pivot points) at Fibonacci levels.
6. Include significant Fibonacci levels in the keyLevels response field with the retracement percentage and context as the reason.

**Caveats:**
- Swing point selection is subjective — different traders may choose different reference points on the same chart
- Fibonacci retracement has limited standalone predictive power — always combine with other confirmation tools
- Price tends to react in a "zone" around the level rather than at the exact price
- For short timeframes (1Min, 5Min), use the most recent intraday swing; for daily, use the most prominent multi-day swing

<!-- PROMPT_DIGEST:START -->
Fibonacci Retracement (support/resistance from swing pullbacks)
- Measures % retracement of a significant price swing. Key levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%.
Level meaning:
- 23.6% — shallow; very strong trend, minimal pullback; momentum/breakout continuation.
- 38.2% — moderate/"healthy" correction; reliable trend-continuation entry; aligns with Wave 4.
- 50.0% — not a true Fib ratio (Dow Theory), psychologically significant halfway level.
- 61.8% — golden ratio, most important; "Golden Pocket" zone (61.8%–65%); often final line of defense; strongest with MA/Bollinger confluence.
- 78.6% — deep; tests trend integrity; retrace beyond 78.6% → reversal probability rises sharply; last viable S/R before full reversal.
Application:
- Uptrend: 0% = recent significant swing low, 100% = swing high; levels act as SUPPORT; wait for level + confirmation to enter.
- Downtrend: 0% = recent significant swing high, 100% = swing low; levels act as RESISTANCE; wait for level + confirmation.
- Multi-swing: cluster/overlap of levels from different swings = exceptionally strong S/R zone.
Signals: bounce at level + bullish reversal candle → long; retracement staying above 38.2% → very strong uptrend; Fib + MA convergence → high-confidence support. Rejection at level + bearish candle → short; retracement exceeding 61.8% → weakening / reversal risk; Fib + Bollinger → high-confidence resistance.
Elliott Wave: Wave 2 retraces 50%–61.8% of Wave 1; Wave 4 retraces 38.2% of Wave 3; Wave 3 (not shortest) projects to 161.8% extension of Wave 1.
AI instructions: (1) identify most significant recent swing high & low from bars. (2) apply 23.6/38.2/50/61.8/78.6% between them. (3) find levels nearest current price. (4) assess depth for trend strength: <38.2% very strong; 38.2–50% healthy correction; 50–61.8% deep but intact; >61.8% weakening/reversal risk. (5) check confluence (MAs, Bollinger, pivots). (6) include significant levels in keyLevels with retracement % + context as reason.
Caveats: swing selection is subjective. Limited standalone predictive power — always combine with confirmation. Reacts in a zone around the level, not exact price. Short timeframes → most recent intraday swing; daily → most prominent multi-day swing.
<!-- PROMPT_DIGEST:END -->
