---
name: Candle Reading Primer
description: 캔들 패턴 패밀리(반전·지속·관망) 압축 primer — 상시 주입되는 코어. 개별 패턴 풀 가이드는 해당 캔들이 실제 감지될 때만 게이팅
type: candlestick
category: neutral
indicators: []
confidence_weight: 1.0
gating:
  tier: always_on
token_cost: 433
digest_hash: "c11afe28"
---

## Candle Reading Primer (compressed)

A compact map of candlestick families. **Interpret only the candle patterns
listed in this prompt's detected-pattern section** — do not infer a pattern
that was not detected, and do not invent reversal/continuation signals from raw
OHLC. A fuller per-pattern guide is injected only when that pattern is detected.

### Core principle

- Candles are **context-dependent**: the same shape means reversal at a trend
  extreme but noise inside a range. Always read the pattern relative to the
  prior trend and nearby support/resistance.
- A single candle is a **clue, not a trigger** — confirm with the next bar,
  volume, and the indicator picture before acting.

### Reversal family (signal a turn against the prior trend)

- **Hammer / Inverted Hammer** (after downtrend), **Hanging Man / Shooting Star** (after uptrend): long single-side wick = rejection of that extreme.
- **Engulfing** (bullish/bearish): second body fully engulfs the first = momentum handover.
- **Harami / Harami Cross:** small body inside the prior large body = momentum stalling, potential turn.
- **Morning / Evening Star** (incl. doji variants): 3-bar exhaustion-then-reversal.
- **Three White Soldiers / Three Black Crows:** three strong same-direction bodies confirming a reversal thrust.
- **Piercing Line / Dark Cloud Cover, Tweezers, Belt Hold, Counterattack:** weaker 1–2 bar reversal hints; need confirmation.

### Continuation family (favor the prior trend resuming)

- **Marubozu** (bullish/bearish): full-body, no wick = one-sided conviction.
- **Gap patterns / Tasuki, Three-method-style sequences:** brief pause inside an ongoing trend rather than a turn.

### Indecision / neutral family (wait)

- **Doji** (standard, long-legged, dragonfly, gravestone): open≈close = balance; meaningful only at a trend extreme, noise in a range.
- **Spinning Top:** small body, wicks both sides = indecision; lowers conviction in either direction.

<!-- PROMPT_DIGEST:START -->
Candle Reading Primer — compact map of candlestick families.
- **Interpret ONLY the candle patterns in this prompt's detected-pattern section.** Do NOT infer a pattern that was not detected; do NOT invent reversal/continuation signals from raw OHLC. Fuller per-pattern guide is injected only when that pattern is detected.
- Candles are context-dependent: same shape = reversal at a trend extreme but noise inside a range. Read relative to prior trend and nearby support/resistance. A single candle is a clue, not a trigger — confirm with next bar, volume, and indicators.
- **Reversal family** (turn against prior trend):
  - Hammer/Inverted Hammer (after downtrend), Hanging Man/Shooting Star (after uptrend): long single-side wick = rejection of that extreme.
  - Engulfing (bull/bear): second body fully engulfs first = momentum handover.
  - Harami/Harami Cross: small body inside prior large body = momentum stalling, potential turn.
  - Morning/Evening Star (incl. doji variants): 3-bar exhaustion-then-reversal.
  - Three White Soldiers/Three Black Crows: three strong same-direction bodies = reversal thrust.
  - Piercing Line/Dark Cloud Cover, Tweezers, Belt Hold, Counterattack: weaker 1–2 bar reversal hints; need confirmation.
- **Continuation family** (favor prior trend resuming):
  - Marubozu (bull/bear): full-body, no wick = one-sided conviction.
  - Gap patterns/Tasuki, Three-method sequences: brief pause inside an ongoing trend, not a turn.
- **Indecision/neutral family** (wait):
  - Doji (standard, long-legged, dragonfly, gravestone): open≈close = balance; meaningful only at a trend extreme, noise in a range.
  - Spinning Top: small body, wicks both sides = indecision; lowers conviction either direction.
<!-- PROMPT_DIGEST:END -->
