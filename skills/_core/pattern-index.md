---
name: Pattern Index Reference
description: 계산되는 모든 차트 패턴의 1줄 형태·방향 요약 — 상시 주입되는 압축 인덱스(개별 판정 기준은 프리스크리너가 후보로 지목한 패턴만 게이팅)
type: indicator_guide
indicators: []
confidence_weight: 1.0
gating:
  tier: always_on
token_cost: 523
digest_hash: "47de8c4e"
---

## Pattern Index (compressed)

Always-on one-line index of **every** chart pattern the engine can detect. Its
job is coverage, not judgement: the model should always know that all 17
patterns exist and be able to **name** any pattern it can clearly see on the
chart, even when that pattern's detailed skill was not injected this run.

The **detailed** judging criteria for a pattern — geometry tolerances, measured
targets, confirmation/invalidation levels — arrive in a separate skill only when
the pre-screener flags that specific pattern as a plausible candidate on the
current chart. This index is the cheap always-present fallback so no visible
pattern goes unnamed just because its full guide wasn't gated in.

`type: indicator_guide` is used deliberately (not `type: pattern`): this file is
a cross-cutting always-on reference for the whole pattern category, mirroring
`_core/indicator-core.md`. It is not a single detectable pattern, so it carries
no `pattern:` id and is exempt from `usage_roles` (the always-on exemption).

### Reversal patterns

- **head_and_shoulders:** three peaks, middle (head) highest, neckline break down = bearish reversal.
- **inverse_head_and_shoulders:** three troughs, middle (head) lowest, neckline break up = bullish reversal.
- **double_top:** two roughly equal highs (M shape), neckline (intervening low) break down = bearish reversal.
- **double_bottom:** two roughly equal lows (W shape), neckline (intervening high) break up = bullish reversal.
- **triple_top:** three roughly equal highs at resistance, support break down = bearish reversal.
- **triple_bottom:** three roughly equal lows at support, resistance break up = bullish reversal.
- **rounding_bottom:** slow U-shaped (saucer) base, gradual momentum shift, break up = bullish reversal.

### Continuation patterns

- **ascending_triangle:** flat resistance on top + rising lows, breakout up = bullish continuation.
- **descending_triangle:** flat support on bottom + falling highs, breakdown = bearish continuation.
- **ascending_wedge (rising wedge):** both bounds slope up and converge, break down = bearish (reversal/continuation-against).
- **descending_wedge (falling wedge):** both bounds slope down and converge, break up = bullish (reversal/continuation-against).
- **bull_flag:** sharp rally (pole) then a slight downward-drifting channel, break up = bullish continuation.
- **bear_flag:** sharp drop (pole) then a slight upward-drifting channel, break down = bearish continuation.
- **cup_and_handle:** rounded U cup + small pullback handle near the rim, break up = bullish continuation.

### Neutral / bilateral patterns

- **symmetrical_triangle:** lower highs + higher lows converge; resolves in the prevailing trend direction on break (neutral until it breaks).
- **pennant:** sharp move (pole) then a small symmetrical triangle; continues in the pole's direction on break.
- **rectangle:** price oscillates between horizontal support and resistance; direction is decided by which side breaks.

### Reporting directive

- Patterns **not** in the current prompt's detailed set may still be reported if clearly visible — name them and describe the structure, but at **reduced confidence** (the detailed geometry/target/invalidation criteria were not supplied for them this run).

<!-- PROMPT_DIGEST:START -->
Pattern Index — one-line index of EVERY detectable chart pattern. Always know all 17 exist and NAME any pattern clearly visible on the chart, even when its detailed skill was not injected. Detailed judging (geometry tolerances, measured targets, confirmation/invalidation) arrives separately ONLY for patterns the pre-screener flags as candidates.
Reversal:
- head_and_shoulders: three peaks, middle (head) highest, neckline break down = bearish reversal.
- inverse_head_and_shoulders: three troughs, middle (head) lowest, neckline break up = bullish reversal.
- double_top: two ~equal highs (M), neckline break down = bearish reversal.
- double_bottom: two ~equal lows (W), neckline break up = bullish reversal.
- triple_top: three ~equal highs at resistance, support break down = bearish reversal.
- triple_bottom: three ~equal lows at support, resistance break up = bullish reversal.
- rounding_bottom: slow U (saucer) base, break up = bullish reversal.
Continuation:
- ascending_triangle: flat top resistance + rising lows, break up = bullish continuation.
- descending_triangle: flat bottom support + falling highs, break down = bearish continuation.
- ascending_wedge (rising): both bounds up + converging, break down = bearish.
- descending_wedge (falling): both bounds down + converging, break up = bullish.
- bull_flag: sharp rise (pole) + slight down channel, break up = bullish continuation.
- bear_flag: sharp drop (pole) + slight up channel, break down = bearish continuation.
- cup_and_handle: rounded U cup + small handle, break up = bullish continuation.
Neutral/bilateral:
- symmetrical_triangle: lower highs + higher lows converge; breaks in prevailing trend direction (neutral until break).
- pennant: sharp move (pole) + small symmetrical triangle; continues in pole direction.
- rectangle: range between horizontal support & resistance; direction = side that breaks.
Directive: patterns NOT in this prompt's detailed set may still be reported if clearly visible — name and describe them, but at REDUCED confidence (detailed criteria were not supplied for them this run).
<!-- PROMPT_DIGEST:END -->
