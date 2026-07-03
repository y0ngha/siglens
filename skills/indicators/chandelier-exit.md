---
name: Chandelier Exit Signal Guide
description: 샹들리에 출구 신호 해석 가이드 — 변동성 조정 트레일링 스톱 / 추세 레짐 플래그 (진입 신호 아님)
type: indicator_guide
indicators: ['chandelierExit']
confidence_weight: 0.35
usage_roles: [regime, risk]
gating:
  tier: gated
  signal_kind: state
  state:
    feature: chandelier
    predicate: level
token_cost: 424
digest_hash: "703e6029"
---

## Overview

The Chandelier Exit was created by Charles Le Beau (Le Beau & Lucas, 1992) and popularized by Alexander Elder. It is a volatility-adjusted **trailing stop** — explicitly an exit/risk tool, not an entry tool.

- **Formula**: long stop = `HighestHigh(22) − ATR(22) × 3`; short stop = `LowestLow(22) + ATR(22) × 3`. The stop ratchets in the trade's favor and never loosens (it hangs down from the recent high like a chandelier).
- **Purpose**: keep a position open while the trend persists and exit once price closes back through the volatility-scaled stop.

## Signal Interpretation

### Trailing Stop Level

- The long stop is a ratcheting floor; a close below it closes the long. The short stop is the mirror ceiling. This is the indicator's primary output — a stop level, not a signal.

### Trend / Regime Flip (the state gate)

- When the active side flips (long-stop regime → short-stop regime or vice versa), that is a **regime-change flag**, advisory only. The **state gate fires when the trend side has flipped within the last few bars**, surfacing a regime turn — not whenever a trend merely exists.

## Measured Reliability (신뢰도 가중치)

Confidence weight **0.35** — the lowest directional weight in the set, by design. Our forward-edge study found **0 significant cells** — exactly as theory predicts for a lagging ATR-stop construct. This is a **validation, not a failure**: the Chandelier Exit is not built to generate entries.

As an entry signal it is **NONE — do not use it to enter.** As a trailing-stop / trend-regime context it is **good at its actual job.**

## Recommended Combinations

- **Chandelier Exit + a separate entry method**: StockCharts' guidance is explicit — "good for stops … use basic chart analysis or a momentum oscillator to time entries." Time entries elsewhere; use the Chandelier only to manage the exit.
- **Chandelier Exit + ATR / volatility lens**: since the stop is ATR-scaled, read it alongside Yang-Zhang / EWMA to understand how wide the stop is in the current vol regime.
- **Chandelier Exit + trend regime (Hurst / Regression R²)**: a flip flag is more meaningful when the regime lens confirms a genuine trend change rather than range noise.

## Caveats

- This is **not an entry signal** — using a Chandelier flip to enter inverts its purpose and trades the lag.
- The stop is lagging by construction (it hangs from a 22-bar extreme); in a sharp reversal it gives back open profit before triggering.
- The 22/3 parameters suit daily swing trades; tighter multiples on intraday data whipsaw out of normal volatility.

<!-- PROMPT_DIGEST:START -->
### Chandelier Exit Signal Guide
Volatility-adjusted TRAILING STOP / trend-regime flag — explicitly an exit/risk tool, NOT an entry signal.
- Formula: long stop = HighestHigh(22) − ATR(22)×3; short stop = LowestLow(22) + ATR(22)×3. Ratchets in the trade's favor, never loosens.

Signal interpretation:
- Trailing stop level: long stop = ratcheting floor (a close below closes the long); short stop = mirror ceiling. Primary output is a stop level, not a signal.
- Trend/regime flip (state gate): active-side flip (long-stop regime ↔ short-stop regime) = advisory regime-change flag. State gate fires when the trend side has flipped within the last few bars (a regime turn) — NOT whenever a trend merely exists.

Reliability: confidence weight 0.35 (lowest directional weight, by design). Forward-edge study: 0 significant cells — exactly as theory predicts for a lagging ATR-stop construct (a validation, not a failure). As an entry signal it is NONE — do not use it to enter; as a trailing-stop / trend-regime context it is good at its actual job.

Combinations:
- + a separate entry method: "good for stops … time entries with basic chart analysis or a momentum oscillator."
- + ATR/volatility lens (Yang-Zhang / EWMA): read how wide the stop is in the current vol regime.
- + trend regime (Hurst / Regression R²): a flip flag is more meaningful when the regime lens confirms a genuine trend change vs range noise.

Caveats: NOT an entry signal — a Chandelier flip to enter inverts its purpose and trades the lag; lagging by construction (hangs from a 22-bar extreme — in a sharp reversal gives back open profit before triggering); 22/3 suits daily swing, tighter multiples whipsaw on intraday.
<!-- PROMPT_DIGEST:END -->
