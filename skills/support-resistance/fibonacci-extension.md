---
name: 피보나치 확장
description: 되돌림 후 추세 재개 시 목표가(Take Profit) 설정을 위한 피보나치 확장 레벨 분석 도구
type: support_resistance
category: neutral
indicators: []
confidence_weight: 0.7
gating:
  tier: always_on
token_cost: 721
digest_hash: "0c965c82"
---

## Overview

Fibonacci Extension calculates projected price targets beyond the original swing range after a retracement completes. While Fibonacci Retracement identifies where a pullback might end, Fibonacci Extension identifies where the subsequent move might reach — making it the primary tool for systematic take-profit target setting.

The tool uses a three-point method (A-B-C) where Point A is the swing start, Point B is the swing end, and Point C is the retracement completion point. Extension levels are projected from Point C using Fibonacci ratios applied to the A-B distance.

---

## Key Extension Levels

### 100% — Equal Measured Move
- Projects a move equal in size to the original A-B swing from Point C
- The 1:1 measurement — the most conservative target
- High-probability target in trending markets

### 127.2% — First Major Extension
- The first significant Fibonacci extension beyond the original move
- Common target for Wave 3 extensions and pattern projections
- Appropriate for partial profit-taking in strong trends

### 161.8% — Golden Ratio Extension
- The most important extension level — the golden ratio projection
- Primary take-profit target for most trading strategies
- Wave 3 in Elliott Wave theory often reaches 161.8% of Wave 1

### 200% — Double Measured Move
- Projects twice the original swing distance
- Indicates a very strong trend with sustained momentum
- Secondary take-profit target after 161.8% is reached

### 261.8% — Extended Projection
- Rarely reached except in exceptionally strong trends
- Indicates potential trend exhaustion when price reaches this level
- Full position exit consideration — the trend may be overextended

---

## Three-Point Application Method

### Point Identification
1. **Point A** (Swing Start): The beginning of the impulse move
2. **Point B** (Swing End): The end of the impulse move (the swing high in uptrend, swing low in downtrend)
3. **Point C** (Retracement End): Where the pullback/correction completes (confirmed by reversal signals)

### In an Uptrend
- A = Swing Low (trend start)
- B = Swing High (first impulse peak)
- C = Retracement Low (pullback completion)
- Extension levels project upward from C: Target = C + (B − A) × Fibonacci ratio

### In a Downtrend
- A = Swing High (trend start)
- B = Swing Low (first impulse trough)
- C = Retracement High (bounce completion)
- Extension levels project downward from C: Target = C − (A − B) × Fibonacci ratio

---

## Signal Interpretation

### Take-Profit Signals
- Price reaches 127.2% extension → consider partial profit-taking (25%–33% of position)
- Price reaches 161.8% extension → primary profit target, consider exiting 50%+ of position
- Price reaches 200% extension → strong profit-taking signal, trend may be maturing
- Price reaches 261.8% extension → consider full position exit, trend exhaustion likely

### Confluence Enhancement
- Extension level + other resistance/support (pivot points, prior swing levels) → stronger target confidence
- Extension level + volume climax → high probability of reversal at that level
- Multiple extension projections from different swings converging → cluster target zone

### Risk Management Integration
- Use extension levels to calculate risk-reward ratios before entry
- Entry at C, stop-loss below A (uptrend) or above A (downtrend)
- Target at 161.8% extension: if risk is C-to-A distance, reward is C-to-161.8% distance
- Only enter trades where the extension-based target provides at least 1:2 risk-reward

---

## AI Analysis Instructions

The `## Market Reference` section already lists the computed three-point extension rows, labeled `Fib ABC ext 100%`…`Fib ABC ext 261.8%`, each with its price — the nearest-to-price subset — but ONLY when a Point C (retracement completion) exists for that horizon. When it exists, that horizon also carries a complete `Fib ABC table:` line with every standard extension ratio's price (use it for a ratio further from price than the nearest-list rows cover) and a `Fib ABC anchor: A x → B y → C z (up|down)` line naming the three points. Use those numbers directly; never calculate an extension level yourself from the bars. (The simpler two-point `Fib ext N%` rows + `Fib table:`/`Fib anchor:` lines, covered by the Fibonacci Retracement/`strategies/fibonacci.md` skills, are a different projection — this skill is specifically the three-point A-B-C method.)

When analyzing with Fibonacci Extension:

1. Check whether `Fib ABC ext`/`Fib ABC anchor` rows are present for the relevant horizon — they only appear once a Point C (retracement completion) is established. If they are not present, state that no A-B-C extension is available yet; do not identify your own A/B/C points or compute one.
2. When present, read the three reference points from that horizon's `Fib ABC anchor: A x → B y → C z (up|down)` line — do not identify your own.
3. Cite the listed `Fib ABC ext 100%`…`Fib ABC ext 261.8%` rows; for a ratio further from price than those rows cover, read it from that horizon's `Fib ABC table:` line instead. Never calculate an extension level yourself.
4. Include the relevant LISTED extension levels in the priceTargets response field as bullish or bearish targets, citing the ratio as the basis.
5. Use the LISTED extension levels (not a self-computed one) to discuss risk-reward in actionRecommendation.
6. Note any confluence between the listed extension levels and other technical levels (pivot points, prior swing levels, moving averages).

**Caveats:**
- Extension levels are only valid after Point C (retracement completion) is confirmed — do not apply during an active retracement
- Treat extension levels as target "zones" rather than exact prices
- Extension levels are profit targets, not entry signals — they indicate where to exit, not where to enter
- If the A-B swing is too small or unclear, extension projections lose reliability

<!-- PROMPT_DIGEST:START -->
Fibonacci Extension (take-profit target projection)
- Projects price targets BEYOND the original swing after a retracement completes. Three-point A-B-C method: A = swing start, B = swing end, C = retracement completion. Levels projected from C using Fib ratios on the A-B distance.
Extension levels:
- 100% — equal measured move (1:1), most conservative, high-probability in trends.
- 127.2% — first major extension; Wave 3 extensions / pattern projections; partial profit-taking in strong trends.
- 161.8% — golden ratio, most important; primary take-profit; Wave 3 often reaches 161.8% of Wave 1.
- 200% — double measured move; very strong sustained trend; secondary target after 161.8%.
- 261.8% — rarely reached; potential trend exhaustion; consider full exit / overextended.
Point identification: A = impulse start, B = impulse end (swing high in uptrend, swing low in downtrend), C = retracement completion (confirmed by reversal signals).
- Uptrend: A = swing low, B = swing high, C = retracement low. Target = C + (B − A) × ratio (projects upward).
- Downtrend: A = swing high, B = swing low, C = retracement high. Target = C − (A − B) × ratio (projects downward).
Take-profit signals: 127.2% → partial profit 25–33%; 161.8% → primary target, exit 50%+; 200% → strong profit-taking, trend maturing; 261.8% → full exit, exhaustion likely.
Confluence: extension + other S/R (pivots, prior swings) = stronger confidence; extension + volume climax = high reversal prob; multiple projections converging = cluster target zone.
Risk mgmt: compute R:R before entry; entry at C, stop below A (uptrend) / above A (downtrend); target 161.8% (risk = C-to-A, reward = C-to-161.8%); only enter if target gives ≥1:2 R:R.
## Market Reference lists `Fib ABC ext 100%`…`Fib ABC ext 261.8%` nearest-list rows + a complete `Fib ABC table:` line (every standard ratio) + a `Fib ABC anchor: A x → B y → C z (up|down)` line — ONLY when Point C exists for that horizon. Cite these, never calculate. (Different from the simpler `Fib ext`/`Fib table`/`Fib anchor` two-point rows used by the retracement skill.)
AI instructions: (1) check Fib ABC ext/anchor rows are present for the horizon (need Point C) — absent → say no A-B-C extension available yet, don't identify your own points. (2) present → read A/B/C from that horizon's Fib ABC anchor line. (3) cite listed Fib ABC ext N% rows; a ratio further than those rows cover → read it from that horizon's Fib ABC table line instead. (4) include listed levels in priceTargets as bullish/bearish with ratio as basis. (5) use listed levels (not self-computed) for R:R in actionRecommendation. (6) note confluence with pivots, prior swings, MAs.
Caveats: only valid after C confirmed — do NOT apply during active retracement. Treat levels as zones, not exact prices. Levels are profit targets, NOT entry signals. Too small/unclear A-B swing → unreliable.
<!-- PROMPT_DIGEST:END -->
