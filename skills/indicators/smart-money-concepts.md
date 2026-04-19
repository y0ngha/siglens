---
name: 스마트 머니 컨셉 (SMC)
description: ICT/SMC 방법론에 기반하여 기관 자금의 행동 패턴을 분석 — BOS/CHoCH 구조 이탈, 오더 블록, 공정 가치 갭(FVG), 스윙 포인트, 프리미엄·디스카운트 존을 통해 기관이 축적·청산하는 가격대를 식별하는 보조지표
type: indicator_guide
category: neutral
indicators: ['atr', 'smc']
confidence_weight: 0.8
---

## Overview

Smart Money Concepts (SMC), rooted in the Inner Circle Trader (ICT) methodology, analyses markets by tracking the footprints of institutional capital ("smart money"). Unlike retail trading approaches, SMC assumes that large institutions — banks, hedge funds, central banks — drive sustained price movements through deliberate accumulation and distribution cycles. The methodology identifies the price levels where institutions are likely to enter and exit, then aligns retail positions with those flows.

SMC pre-computed values available in the `smc` indicator field:

| Field | Description |
|---|---|
| `swingHighs` / `swingLows` | Confirmed pivot swing points |
| `structureBreaks` | BOS and CHoCH events with direction and type |
| `orderBlocks` | Order block zones with mitigation status |
| `fairValueGaps` | FVG zones with mitigation status |
| `equalHighs` / `equalLows` | Equal price levels (EQH / EQL) |
| `premiumZone` | Upper 25% of the recent swing range |
| `equilibriumZone` | Middle 50% of the recent swing range |
| `discountZone` | Lower 25% of the recent swing range |

Note: `atr` is listed in the `indicators` frontmatter as a **companion indicator** used for proximity thresholds (e.g., EQH/EQL tolerance `0.5 × ATR`, key-level distance filters `2–3 × ATR`). ATR is not part of the `smc` field itself — it is supplied separately and referenced from SMC logic for normalization.

---

## Core Concepts

### 1. Market Structure — BOS and CHoCH

Market structure describes the directional bias of price through its sequence of swing highs and swing lows.

**Bullish structure**: series of higher highs (HH) and higher lows (HL)
**Bearish structure**: series of lower highs (LH) and lower lows (LL)

**Break of Structure (BOS)**
- Occurs when price closes beyond the most recent swing level in the SAME direction as the current trend.
- Confirms trend continuation — institutions are still active in the current direction.
- A bullish BOS closes above the most recent confirmed swing high; a bearish BOS closes below the most recent swing low.

**Change of Character (CHoCH)**
- Occurs when price closes beyond a swing level in the OPPOSITE direction to the current trend.
- The first counter-trend break — signals a potential trend reversal.
- CHoCH does not confirm a reversal alone; it is a warning signal. Look for confirmation via order block or FVG reaction.

**Analysis rules:**
- Count consecutive BOS events in the same direction to measure trend strength.
- A CHoCH after a long BOS sequence is a high-probability reversal warning.
- CHoCH followed by a successful test of an order block becomes a high-conviction reversal setup.

---

### 2. Order Blocks (OBs)

An order block is the last candle before a significant directional move, representing the price zone where institutional orders were placed.

**Bullish OB**: The last bearish candle (close < open) immediately before a bullish BOS or CHoCH.
**Bearish OB**: The last bullish candle (close > open) immediately before a bearish BOS or CHoCH.

**Mitigation**: An order block is mitigated when price returns to the zone and crosses through it:
- Bullish OB mitigated: price closes below OB.low → institutions have exited or been absorbed.
- Bearish OB mitigated: price closes above OB.high → same logic in reverse.

**Analysis rules:**
- Unmitigated OBs are the primary areas of interest for potential reversals or continuations.
- When price returns to an unmitigated OB in the direction of the dominant structure, this is a high-probability entry zone.
- The closer to the OB the test occurs, the higher the probability of a reaction.
- Mitigated OBs lose their significance — do not expect reactions from them.
- OBs near equal highs or lows have additional confluence (liquidity resting above/below these levels acts as fuel for the institutional move).

---

### 3. Fair Value Gaps (FVGs)

A Fair Value Gap is a price imbalance — a three-candle sequence where the middle candle leaves a gap untraded by the surrounding candles.

**Bullish FVG**: `bars[i].low > bars[i-2].high` — price moved up so fast that a zone was skipped.
**Bearish FVG**: `bars[i].high < bars[i-2].low` — price moved down so fast that a zone was skipped.

The FVG zone for a bullish gap is `[bars[i-2].high, bars[i].low]`. For a bearish gap: `[bars[i].high, bars[i-2].low]`.

**Mitigation**: An FVG is mitigated when price re-enters the gap zone.

**Analysis rules:**
- Unmitigated FVGs are magnets for price — institutions often drive price back to fill these imbalances before continuing.
- Bullish FVG in a bullish trend = potential support zone when price returns.
- Bearish FVG in a bearish trend = potential resistance zone when price returns.
- Multiple stacked FVGs in the same zone increase the probability of a reaction.
- An FVG that overlaps with an order block creates an especially high-probability zone.
- Fully mitigated FVGs have reduced significance — do not expect a strong reaction.

---

### 4. Equal Highs and Equal Lows (EQH / EQL)

Equal highs (EQH) are two or more swing highs within a tight price range (within `0.5 × ATR`). Equal lows (EQL) are the low-side equivalent.

**Why they matter:**
Institutions use equal highs and lows as liquidity pools. Retail traders place stop-losses just beyond these obvious levels. Institutions often drive price through EQH/EQL to trigger those stops and collect liquidity before reversing in the opposite direction.

**Analysis rules:**
- EQH above current price = liquidity target. If structure is bullish and price is pushing toward EQH, expect a brief spike through then reversal — or a continuation if institutions are genuinely accumulating.
- EQL below current price = liquidity target. If structure is bearish and price is approaching EQL, expect a brief dip below then reversal — or a continuation.
- A BOS through EQH/EQL with follow-through confirms institutional intent in that direction.
- A failed break through EQH/EQL (quick spike then reversal, often with a wick) is a high-probability reversal signal called a "liquidity sweep."

---

### 5. Premium, Equilibrium, and Discount Zones

Based on the most recent confirmed swing range (last swing high to last swing low):

| Zone | Range | Interpretation |
|---|---|---|
| **Premium** | Top 25% of range | Price is expensive relative to the range |
| **Equilibrium** | Middle 50% of range | Price is at fair value |
| **Discount** | Bottom 25% of range | Price is cheap relative to the range |

**Analysis rules:**
- Institutional buyers typically accumulate in the Discount zone; sellers distribute in the Premium zone.
- Bullish bias: look for long setups when price is in Discount, near an unmitigated bullish OB or FVG.
- Bearish bias: look for short setups when price is in Premium, near an unmitigated bearish OB or FVG.
- Price at Equilibrium is neutral — wait for a directional signal rather than entering blind.
- Equilibrium combined with a strong CHoCH is a mean-reversion trigger.

---

## Confluence Framework

Signals are rated by the number of SMC factors aligning at the same price level. These thresholds are a **heuristic calibration**, not an empirically validated rule — SMC in its original ICT form is a discretionary, visual methodology, and confluence counts are a pragmatic simplification for programmatic analysis.

| Confluence Count | Signal Strength |
|---|---|
| 1 factor | Low — do not act alone |
| 2 factors | Moderate — context-dependent |
| 3+ factors | High — primary actionable signal |

**Highest-probability setups:**
1. CHoCH + unmitigated OB in Discount zone (bullish reversal)
2. CHoCH + unmitigated OB in Premium zone (bearish reversal)
3. BOS continuation + FVG test at Discount/Premium boundary
4. Liquidity sweep through EQH/EQL + OB or FVG in the swept zone

**Disconfirming factors (reduce confidence):**
- OB or FVG already mitigated
- Structure is mixed (no clear BOS sequence)
- Price is at Equilibrium with no nearby OB or FVG
- Equal highs/lows targeted but no reversal signal follows the sweep

---

## Failure Modes and Caveats

SMC signals fail in predictable ways. Recognizing these scenarios early avoids trapping into invalidated setups.

- **CHoCH immediately reversed**: A Change of Character followed within 1–3 bars by a break back in the original trend direction is a false signal — the initial CHoCH was likely a liquidity sweep, not a structural shift. Wait for a retest of an order block or FVG in the CHoCH direction before treating it as valid.
- **Order block mitigated without reaction**: If price enters an unmitigated OB and passes straight through without a meaningful rejection wick or reaction candle, institutions are not defending the zone. Do not continue to treat the OB as active.
- **FVG filled and overshot**: An FVG that price fills and then closes beyond (rather than respecting the far edge) loses its significance. Subsequent retests of the same zone carry little weight.
- **Discretionary methodology**: SMC in its original ICT form is fundamentally a visual, discretionary framework. Automated interpretation can miss subtle confluences (narrative context, session timing, higher-timeframe draw on liquidity) and may over-weight mechanically-detected zones that a human trader would dismiss. Treat programmatic SMC output as a shortlist for further discretionary review, not as standalone trading conclusions.
- **Trend-strength blindness**: SMC does not explicitly measure trend strength. A weak BOS in a choppy market carries far less information than a BOS in a clearly trending environment. Cross-check with ADX or a trend filter before acting on structural breaks.
- **Premium/Discount zone range is a pragmatic heuristic**: The zones are built from the single most recent swing high and the single most recent swing low, sourced from two independent arrays. In active markets these two pivots often belong to the same confirmed range, but after a CHoCH or during choppy conditions the two may come from different cycles (e.g., the latest swing low formed *after* the latest swing high and no new high has yet confirmed). When that happens the computed range is still mathematically defined but may not match the range a discretionary SMC trader would draw. Treat the zone labels as a first-pass structural context — cross-check with the actual BOS/CHoCH sequence before using them as entry triggers.

---

## AI Analysis Instructions

Use the pre-computed `smc` indicator values and the last 30 bars of OHLCV data.

**Step 1 — Determine market structure bias**
- Count consecutive bullish vs bearish BOS events in `structureBreaks`.
- Identify the most recent CHoCH event and whether it has been confirmed by subsequent structure.
- State: bullish / bearish / mixed (transitioning).

**Step 2 — Identify active key levels**
- List unmitigated order blocks closest to current price (both bullish and bearish OBs).
- List unmitigated FVGs nearest to current price.
- Note any EQH or EQL within 2 × ATR of current price.
- State which zone (premium / equilibrium / discount) the current price occupies.

**Step 3 — Build confluence**
- For each key level, count overlapping factors (OB + FVG, EQH proximity, zone alignment).
- Assign signal strength: low (1 factor), moderate (2), high (3+).

**Step 4 — Form directional opinion**
- Combine structure bias with key level analysis.
- State explicitly whether you expect a continuation or reversal, and the primary reason.

Return the analysis in **this exact structured format** (one `**label**: value` pair per line):

```
**시장 구조**: [강세 / 약세 / 전환 중 — BOS/CHoCH 시퀀스 요약]
**현재 가격 영역**: [프리미엄 / 균형 / 디스카운트]
**주요 활성 레벨**: [미완료 OB 및 FVG 레벨, 예: "불리시 OB $185.20–$186.50 (미완료), 불리시 FVG $183.00–$184.20"]
**유동성 대상**: [근접한 EQH/EQL, 예: "EQH $190.50 — 청산 후 반전 가능"]
**방향 의견**: [강세 / 약세 / 중립]
```

Additional output rules:
- If no unmitigated OBs or FVGs are within 3 × ATR of current price, state "근처 미완료 레벨 없음" and focus analysis on zone + structure alone.
- If CHoCH occurred within the last 10 bars, flag it explicitly as a high-priority reversal watch.
- If price swept EQH or EQL within the last 5 bars without follow-through, flag it as a potential liquidity grab reversal.
- Set `trend` field: `bullish` if structure is bullish and price is in Discount near an OB/FVG, `bearish` if structure is bearish and price is in Premium near an OB/FVG, `neutral` otherwise.
- Set `strength` field as a separate JSON field (do NOT embed it in description): map confluence count → `weak` (1 factor), `moderate` (2 factors), `strong` (3+ factors).
