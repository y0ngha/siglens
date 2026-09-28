---
name: 피봇 포인트
description: 전일 가격 데이터를 기반으로 당일의 지지/저항 레벨을 자동 산출하는 클래식 데이트레이딩 도구
type: support_resistance
category: neutral
indicators: []
confidence_weight: 0.75
gating:
  tier: always_on
token_cost: 328
digest_hash: "ec8f1198"
---

## Overview

Floor pivots are computed from the prior session's High, Low and Close — an intraday tool built for floor traders and still watched by day traders. On daily or longer charts treat them as secondary references only: there the "prior session" is just the previous bar, and the levels carry far less meaning than swing structure or moving averages.

The Pivot Point (PP) is the session's equilibrium: price above PP = bullish session bias, below PP = bearish. R1–R3 are resistance, S1–S3 support.

## Methods

The app computes every level; the formulas are listed only so the labels make sense.

| Method | Character | Levels the app lists |
|---|---|---|
| Standard (Classic) | PP = (H + L + C) / 3; equal weight | PP, R1–R3, S1–S3 |
| Fibonacci Pivot | Standard PP ± 0.382 / 0.618 / 1.000 × range | PP, R1–R3, S1–S3 |
| Woodie | PP weights the Close double | PP, R1, R2, S1, S2 |
| Camarilla | Tight levels around the Close; scalping / intraday mean reversion | R3, R4, S3, S4 |
| DeMark | PP from a conditional X based on Open vs Close | PP, R1, S1 |

## Signal Interpretation

- Opening above PP → bullish session bias; below PP → bearish.
- Bounce off S1 on rising volume → possible long; rejection at R1 with a bearish candle → possible short.
- Close through R1 (or S1) with volume → continuation in that direction.
- The R1–S1 band is the session's main activity zone. The first touch of a level matters most; repeated touches wear it down.
- Gap opens reduce the relevance of the prior session's levels.
- A pivot that coincides with an MA, a Bollinger band or a Fibonacci level is stronger.

## AI Analysis Instructions

`## Market Reference` already lists the computed pivot levels — use those numbers; never calculate a pivot yourself:

- Nearest-list rows (Standard and Camarilla only): `Pivot PP`, `Pivot R1`–`Pivot R3`, `Pivot S1`–`Pivot S3`; `Camarilla R3`, `Camarilla R4`, `Camarilla S3`, `Camarilla S4` (the only Camarilla levels computed).
- A complete `Pivot table:` line, pipe-separated by method: `Standard PP x R1 x … | Pivot Fib PP x R1 x … S3 x | Woodie PP x R1 x R2 x S1 x S2 x | DeMark PP x R1 x S1 x | Camarilla R3 x R4 x S3 x S4 x`. It is the ONLY source for Fibonacci Pivot, Woodie and DeMark levels, and the source for any Standard/Camarilla level further from price than the nearest-list rows cover.

When analyzing:

1. Check the timeframe first. On intraday charts pivots are a primary S/R reference; on daily or longer charts mention them only as secondary references behind swing structure and MAs.
2. Prioritize the Standard rows and the Fibonacci Pivot segment of the `Pivot table:` line; Camarilla (scalping), Woodie (close-weighted) and DeMark are secondary.
3. State the price position relative to the listed `Pivot PP` and the nearest listed levels above and below.
4. Note convergence with other listed levels (MAs, Bollinger Bands, Fibonacci).
5. Put relevant levels in `keyLevels`, citing the pivot method as the reason — Standard/Camarilla from the rows (or the table for a further level), Fibonacci/Woodie/DeMark from the table.

<!-- PROMPT_DIGEST:START -->
Pivot Points (floor pivots from the prior session's H/L/C)
Floor pivots are computed from the prior session's H/L/C — an intraday tool. On daily or longer charts treat them as secondary references only (behind swing structure and MAs).
PP = session equilibrium: price above PP = bullish session bias, below = bearish. R1–R3 resistance, S1–S3 support. R1–S1 = main activity zone. Bounce off S1 on rising volume → possible long; rejection at R1 + bearish candle → possible short; close through R1/S1 with volume → continuation. First touch matters most; repeated touches weaken a level; gap opens reduce relevance. Confluence with MA / Bollinger / Fib = stronger.
Market Reference already lists the levels — cite, never calculate: nearest-list rows (Standard + Camarilla only) `Pivot PP`/`Pivot R1..R3`/`Pivot S1..S3` and `Camarilla R3`/`R4`/`S3`/`S4`; plus a complete `Pivot table:` line pipe-separated by method (`Standard … | Pivot Fib … | Woodie … | DeMark … | Camarilla …`) — the ONLY source for Fibonacci Pivot/Woodie/DeMark, and for Standard/Camarilla levels further than the rows cover.
Prioritize Standard + the Fibonacci Pivot table segment; Camarilla (scalping), Woodie, DeMark are secondary. State price vs listed PP and the nearest listed levels; put relevant levels in keyLevels citing the method.
<!-- PROMPT_DIGEST:END -->
