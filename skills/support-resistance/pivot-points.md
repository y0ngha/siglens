---
name: 피봇 포인트
description: 전일 가격 데이터를 기반으로 당일의 지지/저항 레벨을 자동 산출하는 클래식 데이트레이딩 도구
type: support_resistance
category: neutral
indicators: []
confidence_weight: 0.7
---

## Overview

Pivot Points calculate intraday support and resistance levels from the previous bar's High, Low, and Close. Originally developed for floor traders, they remain one of the most widely used tools by day traders, institutional traders, and market makers worldwide.

The core principle: the Pivot Point (PP) acts as the central equilibrium level. Price above PP indicates bullish bias; price below PP indicates bearish bias. Three resistance levels (R1–R3) and three support levels (S1–S3) provide actionable reference points for entries, exits, and stop placement.

---

## Calculation Methods

### 1. Standard Pivot (Classic)

The most commonly used method. Equally weights High, Low, and Close.

- **PP** = (Previous High + Previous Low + Previous Close) / 3
- **R1** = (2 × PP) − Previous Low
- **R2** = PP + (Previous High − Previous Low)
- **R3** = Previous High + 2 × (PP − Previous Low)
- **S1** = (2 × PP) − Previous High
- **S2** = PP − (Previous High − Previous Low)
- **S3** = Previous Low − 2 × (Previous High − PP)

### 2. Woodie Pivot

Gives double weight to the Close, making it more responsive to the most recent settlement price.

- **PP** = (Previous High + Previous Low + 2 × Previous Close) / 4
- R1, R2, S1, S2 use the same formulas as Standard but with the Woodie PP.

### 3. Camarilla Pivot

Produces tighter levels clustered around the Close. Designed for scalping and intraday mean-reversion strategies.

- **R1** = Close + (High − Low) × 1.1 / 12
- **R2** = Close + (High − Low) × 1.1 / 6
- **R3** = Close + (High − Low) × 1.1 / 4
- **R4** = Close + (High − Low) × 1.1 / 2
- **S1** = Close − (High − Low) × 1.1 / 12
- **S2** = Close − (High − Low) × 1.1 / 6
- **S3** = Close − (High − Low) × 1.1 / 4
- **S4** = Close − (High − Low) × 1.1 / 2

### 4. Fibonacci Pivot

Applies Fibonacci ratios (38.2%, 61.8%, 100%) to the price range around the Standard PP.

- **PP** = (Previous High + Previous Low + Previous Close) / 3
- **R1** = PP + 0.382 × (Previous High − Previous Low)
- **R2** = PP + 0.618 × (Previous High − Previous Low)
- **R3** = PP + 1.000 × (Previous High − Previous Low)
- **S1** = PP − 0.382 × (Previous High − Previous Low)
- **S2** = PP − 0.618 × (Previous High − Previous Low)
- **S3** = PP − 1.000 × (Previous High − Previous Low)

### 5. DeMark Pivot

Uses a conditional X value based on the relationship between the previous Open and Close.

- If Close < Open: **X** = High + 2 × Low + Close
- If Close > Open: **X** = 2 × High + Low + Close
- If Close = Open: **X** = High + Low + 2 × Close
- **PP** = X / 4
- **R1** = X / 2 − Low
- **S1** = X / 2 − High

---

## Signal Interpretation

### Bullish Signals
- Price opens above PP → bullish bias for the session
- Price bounces off S1 with increasing volume → potential long entry
- Price breaks above R1 with volume confirmation → continuation long
- First touch of PP from below with a bullish candle → strong support reaction

### Bearish Signals
- Price opens below PP → bearish bias for the session
- Price rejects R1 with a bearish candle pattern → potential short entry
- Price breaks below S1 with volume confirmation → continuation short
- First touch of PP from above with a bearish candle → resistance confirmation

### Key Rules
- The R1–S1 range defines the primary activity zone for the session
- First touch of any pivot level has the highest reliability
- Repeated touches of the same level weaken it (each test erodes supply/demand)
- Gap opens may invalidate pivot levels — reduced reliability on gap days

---

## AI Analysis Instructions

When analyzing with Pivot Points:

1. Calculate Standard Pivot levels using the previous bar's High, Low, Close from the provided bar data.
2. Determine the current price position relative to PP, R1, R2, R3, S1, S2, S3.
3. Identify which pivot levels are nearest to the current price as immediate support/resistance.
4. Note any pivot levels that converge with other technical levels (moving averages, Bollinger Bands, Fibonacci levels) — convergence increases reliability.
5. Assess the session's directional bias based on price position relative to PP.
6. Include relevant pivot levels in the keyLevels response field with calculation basis as the reason.

**Caveats:**
- Pivot points are primarily designed for daily timeframe analysis. For intraday timeframes (1Min, 5Min, 15Min, 1Hour), use the most recent daily bar for calculation.
- On gap-open days, pivot levels may have reduced accuracy.
- Weekly/monthly pivots can be used for swing trading context but are secondary to daily pivots for intraday analysis.
