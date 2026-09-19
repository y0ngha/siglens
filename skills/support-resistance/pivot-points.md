---
name: 피봇 포인트
description: 전일 가격 데이터를 기반으로 당일의 지지/저항 레벨을 자동 산출하는 클래식 데이트레이딩 도구
type: support_resistance
category: neutral
indicators: []
confidence_weight: 0.75
gating:
  tier: always_on
token_cost: 818
digest_hash: "329c08d9"
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

The `## Market Reference` section already lists the computed pivot levels under these exact labels (the nearest-to-price subset — Standard and Camarilla only) — use those numbers directly; never calculate a pivot level yourself from the previous bar's High/Low/Close:
- Standard: `Pivot PP`, `Pivot R1`–`Pivot R3`, `Pivot S1`–`Pivot S3`
- Camarilla: `Camarilla R3`, `Camarilla R4`, `Camarilla S3`, `Camarilla S4` (only these four most-watched Camarilla levels are computed; R1/R2/S1/S2 are not)

The section also carries a complete `Pivot table:` line, pipe-separated by method: `Standard PP x R1 x … | Pivot Fib PP x R1 x … S3 x | Woodie PP x R1 x R2 x S1 x S2 x | DeMark PP x R1 x S1 x | Camarilla R3 x R4 x S3 x S4 x`. This is the ONLY place Fibonacci Pivot, Woodie, and DeMark levels appear — they have no nearest-list rows of their own. Use the table for those three methods' levels, and for a Standard/Camarilla level further from price than the nearest-list rows above cover.

When analyzing with Pivot Points:

1. Prioritize the Standard rows (nearest-list) and the Fibonacci Pivot segment of the `Pivot table:` line — Fibonacci Pivot has no nearest-list rows of its own. Woodie, Camarilla, and DeMark are secondary — cite them (Camarilla from its nearest-list rows or the table; Woodie/DeMark from the table only) when the market context favors their use (e.g., Camarilla for scalping setups, Woodie when close-weighted analysis is relevant).
2. Determine the current price position relative to the listed `Pivot PP`, R1–R3, S1–S3 values.
3. Identify which LISTED pivot levels are nearest to the current price as immediate support/resistance.
4. Note any listed pivot levels that converge with other technical levels (moving averages, Bollinger Bands, Fibonacci levels) — convergence increases reliability.
5. Assess the session's directional bias based on price position relative to the listed `Pivot PP`.
6. Include the relevant pivot levels in the keyLevels response field, citing the pivot method as the reason — Standard/Camarilla from the nearest-list rows (or the `Pivot table:` line for a further level), Fibonacci/Woodie/DeMark from the `Pivot table:` line. Never calculate a pivot level yourself.

**Caveats:**
- Pivot points are primarily designed for daily timeframe analysis. For intraday timeframes (1Min, 5Min, 15Min, 1Hour), the listed levels are based on the most recent daily bar.
- On gap-open days, pivot levels may have reduced accuracy.
- Weekly/monthly pivots can be used for swing trading context but are secondary to daily pivots for intraday analysis.

<!-- PROMPT_DIGEST:START -->
Pivot Points (intraday S/R from prior bar H/L/C)
- PP = central equilibrium. Price > PP = bullish bias; price < PP = bearish bias. R1–R3 resistance, S1–S3 support.
Standard (Classic) — equal weight H/L/C:
- PP = (H + L + C) / 3
- R1 = 2×PP − L; R2 = PP + (H − L); R3 = H + 2×(PP − L)
- S1 = 2×PP − H; S2 = PP − (H − L); S3 = L − 2×(H − PP)
Woodie — double-weights Close:
- PP = (H + L + 2×C) / 4; R1,R2,S1,S2 use Standard formulas with Woodie PP.
Camarilla — tighter, Close-clustered (scalping/mean-reversion):
- R1 = C + (H−L)×1.1/12; R2 = C + (H−L)×1.1/6; R3 = C + (H−L)×1.1/4; R4 = C + (H−L)×1.1/2
- S1 = C − (H−L)×1.1/12; S2 = C − (H−L)×1.1/6; S3 = C − (H−L)×1.1/4; S4 = C − (H−L)×1.1/2
Fibonacci — Fib ratios on range around Standard PP:
- PP = (H + L + C) / 3
- R1 = PP + 0.382×(H−L); R2 = PP + 0.618×(H−L); R3 = PP + 1.000×(H−L)
- S1 = PP − 0.382×(H−L); S2 = PP − 0.618×(H−L); S3 = PP − 1.000×(H−L)
DeMark — conditional X:
- If C < O: X = H + 2×L + C; if C > O: X = 2×H + L + C; if C = O: X = H + L + 2×C
- PP = X/4; R1 = X/2 − L; S1 = X/2 − H
(H/L/C/O = previous bar's High/Low/Close/Open.)
Bullish signals: open above PP = bullish session bias; bounce off S1 + rising volume = long; break above R1 + volume = continuation long; first touch of PP from below + bullish candle = strong support.
Bearish signals: open below PP = bearish bias; reject R1 + bearish candle = short; break below S1 + volume = continuation short; first touch of PP from above + bearish candle = resistance confirmation.
Key rules: R1–S1 = primary session activity zone; FIRST touch of any level = highest reliability; repeated touches weaken the level; gap opens may invalidate pivots (reduced reliability on gap days).
## Market Reference already lists these exact nearest-list rows (Standard + Camarilla ONLY) — cite, never calculate: Standard `Pivot PP`/`Pivot R1..R3`/`Pivot S1..S3`; Camarilla `Camarilla R3`/`Camarilla R4`/`Camarilla S3`/`Camarilla S4` (only these four are computed). It also carries a complete `Pivot table:` line, pipe-separated by method: `Standard PP x R1 x … | Pivot Fib PP x R1 x … S3 x | Woodie PP x R1 x R2 x S1 x S2 x | DeMark PP x R1 x S1 x | Camarilla R3 x R4 x S3 x S4 x`. Fibonacci Pivot/Woodie/DeMark have NO nearest-list rows — the table is their only source. Use the table for those three methods, and for a Standard/Camarilla level further from price than the nearest-list rows cover.
AI instructions: (1) prioritize listed Standard rows + the Fibonacci Pivot table segment (no nearest-list rows of its own); Woodie/Camarilla/DeMark secondary (Camarilla from rows or table, Woodie/DeMark from table only; Camarilla for scalping, Woodie for close-weighted). (2) determine price position vs listed PP, R1–R3, S1–S3. (3) find nearest LISTED levels as immediate S/R. (4) note convergence with MAs, Bollinger, Fib levels (↑ reliability). (5) assess directional bias vs listed PP. (6) include levels in keyLevels citing the pivot method as reason — Standard/Camarilla from rows (or table for a further level), Fib/Woodie/DeMark from the table.
Caveats: designed for daily timeframe — for intraday (1Min/5Min/15Min/1Hour) use most recent daily bar. Gap-open days = reduced accuracy. Weekly/monthly pivots for swing context, secondary to daily for intraday.
<!-- PROMPT_DIGEST:END -->
