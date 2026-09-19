---
name: Pattern Index Reference
description: 계산되는 모든 차트 패턴의 1줄 형태·방향·geometry 요약 — 상시 주입되는 압축 인덱스(개별 판정 기준은 프리스크리너가 후보로 지목한 패턴만 게이팅)
type: indicator_guide
indicators: []
confidence_weight: 1.0
gating:
  tier: always_on
token_cost: 1168
digest_hash: "80be9fd3"
---

## Pattern Index (compressed)

Always-on one-line index of **every** chart pattern the engine can detect. Its
job is coverage, not judgement: the model should always know that all 17
patterns exist and be able to **name** any pattern it can clearly see on the
chart, even when that pattern's detailed skill was not injected this run.

The **detailed** judging criteria for a pattern — geometry tolerances,
confirmation nuance, wider invalidation context — arrive in a separate skill
only when the pre-screener flags that specific pattern as a plausible
candidate on the current chart. This index is the cheap always-present
fallback so no visible pattern goes unnamed just because its full guide
wasn't gated in — and each entry below already carries a compact `geom:`
definition (breakoutLevel/extremeLevel/direction/invalidationLevel) so the
`patternSummaries[].geometry` field can always be filled, gated or not.

`type: indicator_guide` is used deliberately (not `type: pattern`): this file is
a cross-cutting always-on reference for the whole pattern category, mirroring
`_core/indicator-core.md`. It is not a single detectable pattern, so it carries
no `pattern:` id and is exempt from `usage_roles` (the always-on exemption).

Each entry's `geom:` line uses this compact notation: `B` = breakoutLevel, `E`
= extremeLevel, `dir` = direction (`up`/`down`), `inv` = invalidationLevel —
the same definitions as that pattern's own gated skill (one source of
wording). Fill `patternSummaries[].geometry` from this line; **never** compute
a measured target, conservative target, or risk/reward yourself — the app
derives 측정 목표가/보수 목표가(50%) from `geometry`.

### Reversal patterns

- **head_and_shoulders:** three peaks, middle (head) highest, neckline break down = bearish reversal. geom: B=neckline@break, E=head, dir=down, inv=right-shoulder high.
- **inverse_head_and_shoulders:** three troughs, middle (head) lowest, neckline break up = bullish reversal. geom: B=neckline@break, E=head, dir=up, inv=right-shoulder low.
- **double_top:** two roughly equal highs (M shape), neckline (intervening low) break down = bearish reversal. geom: B=neckline, E=avg(2 peaks), dir=down, inv=higher peak.
- **double_bottom:** two roughly equal lows (W shape), neckline (intervening high) break up = bullish reversal. geom: B=neckline, E=avg(2 troughs), dir=up, inv=lower trough.
- **triple_top:** three roughly equal highs at resistance, neckline (support) break down = bearish reversal. geom: B=neckline, E=avg(3 peaks), dir=down, inv=highest peak.
- **triple_bottom:** three roughly equal lows at support, neckline (resistance) break up = bullish reversal. geom: B=neckline, E=avg(3 troughs), dir=up, inv=lowest trough.
- **rounding_bottom:** slow U-shaped (saucer) base, gradual momentum shift, break up above the left rim = bullish reversal. geom: B=rim, E=saucer bottom, dir=up, inv=recent right-side trough.

### Continuation patterns

- **ascending_triangle:** flat resistance on top + rising lows, breakout up = bullish continuation. geom: B=horizontal resistance, E=support trendline@start(widest), dir=up, inv=support trendline@last bar.
- **descending_triangle:** flat support on bottom + falling highs, breakdown = bearish continuation. geom: B=horizontal support, E=resistance trendline@start(widest), dir=down, inv=resistance trendline@last bar.
- **ascending_wedge (rising wedge):** both bounds slope up and converge, break down = bearish (reversal/continuation-against). geom: B=lower trendline@breakdown, E=upper trendline@start(widest), dir=down, inv=upper trendline@last bar.
- **descending_wedge (falling wedge):** both bounds slope down and converge, break up = bullish (reversal/continuation-against). geom: B=upper trendline@breakout, E=lower trendline@start(widest), dir=up, inv=lower trendline@last bar.
- **bull_flag:** sharp rally (pole) then a slight downward-drifting channel, break up = bullish continuation. geom: B=upper channel bound@breakout, E=flagpole start(base), dir=up, inv=lower channel bound.
- **bear_flag:** sharp drop (pole) then a slight upward-drifting channel, break down = bearish continuation. geom: B=lower channel bound@breakdown, E=flagpole start(top), dir=down, inv=upper channel bound.
- **cup_and_handle:** rounded U cup + small pullback handle near the rim, break up = bullish continuation. geom: B=handle resistance, E=cup bottom, dir=up, inv=handle low.

### Neutral / bilateral patterns

- **symmetrical_triangle:** lower highs + higher lows converge; resolves in the prevailing trend direction on break (neutral until it breaks). geom: B=broken trendline@breakout, E=opposite trendline@start(widest), dir=break side, inv=opposite trendline@last bar.
- **pennant:** sharp move (pole) then a small symmetrical triangle; continues in the pole's direction on break. geom: B=pennant trendline@break (upper=bull/lower=bear), E=flagpole start, dir=pole direction, inv=opposite trendline.
- **rectangle:** price oscillates between horizontal support and resistance; direction is decided by which side breaks. geom: B=broken boundary, E=opposite boundary, dir=break side, inv=opposite boundary.

### Reporting directive

- Patterns **not** in the current prompt's detailed set may still be reported if clearly visible — name them and describe the structure. The **reduced confidence** attaches ONLY to the pattern-identification claim itself (its detailed skill's tolerances/nuance were not supplied this run) — it does **not** reduce the confidence of the overall analysis. Everything else — key levels, indicators, strategies, and the action plan — must stay fully committed and quantified.
- Report any pattern you can clearly see, listed by the pre-screener or not; an approximate textbook shape is enough. Fill `patternSummaries[].geometry` from the `geom:` line above (or from the pattern's own gated skill when it was injected). Never compute a measured target, conservative target, or risk/reward yourself — the app derives 측정 목표가/보수 목표가(50%) from `geometry`, so do not leave a named pattern's `geometry` empty.
- **Beyond this catalog:** the 17 patterns above are not an exhaustive list of what you may report — you may also name any other well-established chart pattern you clearly see (e.g. broadening formation, diamond, island reversal), using its standard English name. There is no `geom:` line for these, so derive `geometry` by the generic rule: `breakoutLevel` = the level the pattern breaks through; `extremeLevel` = the pattern's textbook measured-move anchor (its widest point or most extreme price); `direction` = the breakout direction; `invalidationLevel` = the level whose breach negates the pattern. As with every other pattern, never compute a measured target, conservative target, or risk/reward yourself.

<!-- PROMPT_DIGEST:START -->
Pattern Index — one-line index of EVERY detectable chart pattern. Always know all 17 exist and NAME any pattern clearly visible on the chart, even when its detailed skill was not injected. Detailed judging (tolerances, confirmation nuance) arrives separately ONLY for patterns the pre-screener flags as candidates — but every entry below already carries a compact `geom:` line (B=breakoutLevel, E=extremeLevel, dir=direction, inv=invalidationLevel) so `patternSummaries[].geometry` can always be filled.
Reversal:
- head_and_shoulders: three peaks, middle (head) highest, neckline break down = bearish reversal. geom: B=neckline@break, E=head, dir=down, inv=right-shoulder high.
- inverse_head_and_shoulders: three troughs, middle (head) lowest, neckline break up = bullish reversal. geom: B=neckline@break, E=head, dir=up, inv=right-shoulder low.
- double_top: two ~equal highs (M), neckline break down = bearish reversal. geom: B=neckline, E=avg(2 peaks), dir=down, inv=higher peak.
- double_bottom: two ~equal lows (W), neckline break up = bullish reversal. geom: B=neckline, E=avg(2 troughs), dir=up, inv=lower trough.
- triple_top: three ~equal highs at resistance, neckline (support) break down = bearish reversal. geom: B=neckline, E=avg(3 peaks), dir=down, inv=highest peak.
- triple_bottom: three ~equal lows at support, neckline (resistance) break up = bullish reversal. geom: B=neckline, E=avg(3 troughs), dir=up, inv=lowest trough.
- rounding_bottom: slow U (saucer) base, break up above left rim = bullish reversal. geom: B=rim, E=saucer bottom, dir=up, inv=recent right-side trough.
Continuation:
- ascending_triangle: flat top resistance + rising lows, break up = bullish continuation. geom: B=horizontal resistance, E=support trendline@start(widest), dir=up, inv=support trendline@last bar.
- descending_triangle: flat bottom support + falling highs, break down = bearish continuation. geom: B=horizontal support, E=resistance trendline@start(widest), dir=down, inv=resistance trendline@last bar.
- ascending_wedge (rising): both bounds up + converging, break down = bearish. geom: B=lower trendline@breakdown, E=upper trendline@start(widest), dir=down, inv=upper trendline@last bar.
- descending_wedge (falling): both bounds down + converging, break up = bullish. geom: B=upper trendline@breakout, E=lower trendline@start(widest), dir=up, inv=lower trendline@last bar.
- bull_flag: sharp rise (pole) + slight down channel, break up = bullish continuation. geom: B=upper channel bound@breakout, E=flagpole start(base), dir=up, inv=lower channel bound.
- bear_flag: sharp drop (pole) + slight up channel, break down = bearish continuation. geom: B=lower channel bound@breakdown, E=flagpole start(top), dir=down, inv=upper channel bound.
- cup_and_handle: rounded U cup + small handle, break up = bullish continuation. geom: B=handle resistance, E=cup bottom, dir=up, inv=handle low.
Neutral/bilateral:
- symmetrical_triangle: lower highs + higher lows converge; breaks in prevailing trend direction (neutral until break). geom: B=broken trendline@breakout, E=opposite trendline@start(widest), dir=break side, inv=opposite trendline@last bar.
- pennant: sharp move (pole) + small symmetrical triangle; continues in pole direction. geom: B=pennant trendline@break (upper=bull/lower=bear), E=flagpole start, dir=pole direction, inv=opposite trendline.
- rectangle: range between horizontal support & resistance; direction = side that breaks. geom: B=broken boundary, E=opposite boundary, dir=break side, inv=opposite boundary.
Directive: patterns NOT in this prompt's detailed set may still be reported if clearly visible — name and describe them, but the REDUCED confidence attaches ONLY to the pattern-identification claim (detailed nuance not supplied this run), NOT to the overall analysis. Key levels, indicators, strategies, and action plan stay fully committed and quantified. Report any pattern you can clearly see, listed by the pre-screener or not; an approximate textbook shape is enough. Fill `geometry` from the `geom:` line above; never compute targets — the app derives 측정 목표가/보수 목표가(50%) from `geometry`.
Beyond this catalog: the 17 above are not exhaustive — also name any other well-established chart pattern you clearly see (e.g. broadening formation, diamond, island reversal) by its standard English name. No `geom:` line exists for these — derive geometry by the generic rule: breakoutLevel = level the pattern breaks through; extremeLevel = its textbook measured-move anchor (widest/most extreme point); direction = breakout direction; invalidationLevel = level whose breach negates the pattern. Never compute a target or R:R yourself.
<!-- PROMPT_DIGEST:END -->
