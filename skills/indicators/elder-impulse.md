---
name: Elder Impulse System Signal Guide
description: 엘더 임펄스 시스템 신호 해석 가이드 — 검열/허가 게이트(녹색=숏 금지, 적색=매수 금지, 청색=양쪽 허용)
type: indicator_guide
indicators: ['elderImpulse']
confidence_weight: 0.45
gating:
  tier: gated
  signal_kind: state
  state:
    feature: elderImpulse
    predicate: level
token_cost: 0
---

## Overview

The Elder Impulse System was introduced by Dr. Alexander Elder in Come Into My Trading Room (Wiley, 2002). It colors each price bar by combining a trend read and a momentum read.

- **Formula (bar color)**: GREEN if EMA13 is rising AND the MACD histogram is rising; RED if both are falling; BLUE otherwise. MACD uses the standard (12,26,9).
- **Two-engine logic**: EMA13 captures trend (inertia), the MACD histogram captures momentum (the second derivative). A bar is only green/red when both agree.

## Signal Interpretation — Censorship / Permission

Elder's own framing is a **censorship rule**, not an entry rule: "It doesn't tell me what to do but rather what I'm *not allowed* to do."

- **GREEN** → longs are allowed; **shorting is forbidden.**
- **RED** → shorts are allowed; **buying is prohibited.**
- **BLUE** → both directions are permitted (momentum and trend disagree, so neither side is censored).
- The actionable moment is the **flip off a color** — green→blue, blue→red, etc. — because it changes *what is forbidden*. The **state gate fires when the latest bar carries a color and either flipped versus the previous colored bar or is non-blue** (green/red actively forbid one side). Elder's rule of thumb: "Enter cautiously, exit fast."

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.45** — advisory / permission gate, not a standalone signal. Our forward-edge study found **0 of 18 cells significant** (all |t| < 1.8) — and this is the **strongest "working-as-designed" result** in the set. A censorship rule is *not supposed* to have a standalone forward edge: its value is the **conditional lift it adds to a separate entry method** (by suppressing counter-trend entries), not its own t-stat. Evaluating it by its own forward return is the wrong test.

As a **direction-permission gate it is moderate-to-high**; as a standalone signal it is low / not-applicable.

## Recommended Combinations

- **Elder Impulse + any entry method**: use the color to veto trades — never short on green, never buy on red. This is the intended use and where the conditional lift lives.
- **Elder Impulse + Bollinger %B event**: a daily %B overbought short is only permitted when the impulse is red or blue, never green.
- **Elder Impulse + regime lens**: the permission gate is most valuable in a clean trend (high R² / H > 0.5), where counter-trend entries are most punished.

## Caveats

- Do not score this indicator by its own forward return — it is a filter, evaluated by the lift it gives a separate entry, not by a standalone t-stat.
- Green/red is a *permission*, not a buy/sell command; acting on color alone over-trades.
- Because it combines EMA13 and the MACD histogram, it inherits both lags; the color can flip a bar or two after the underlying turn.
