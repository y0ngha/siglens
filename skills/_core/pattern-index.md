---
name: Pattern Index Reference
description: 계산되는 모든 차트 패턴의 1줄 형태·방향 요약 — 상시 주입되는 압축 인덱스(개별 판정 기준은 프리스크리너가 후보로 지목한 패턴만 게이팅)
type: indicator_guide
indicators: []
confidence_weight: 1.0
gating:
  tier: always_on
token_cost: 1100
digest_hash: "bf9f511c"
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

- **head_and_shoulders:** three peaks, middle (head) highest, neckline break down = bearish reversal. Target: head→neckline depth projected down from the break; invalidated by a close above the right shoulder high (stop reference).
- **inverse_head_and_shoulders:** three troughs, middle (head) lowest, neckline break up = bullish reversal. Target: neckline→head depth projected up from the break; invalidated by a close below the right shoulder low (stop reference).
- **double_top:** two roughly equal highs (M shape), neckline (intervening low) break down = bearish reversal. Target: peak-average→neckline depth projected down from the break; invalidated by a close above the higher peak.
- **double_bottom:** two roughly equal lows (W shape), neckline (intervening high) break up = bullish reversal. Target: neckline→trough-average depth projected up from the break; invalidated by a close below the lower trough.
- **triple_top:** three roughly equal highs at resistance, neckline (support) break down = bearish reversal. Target: peak-average→neckline depth projected down from the break; invalidated by a close above the highest peak.
- **triple_bottom:** three roughly equal lows at support, neckline (resistance) break up = bullish reversal. Target: neckline→trough-average depth projected up from the break; invalidated by a close below the lowest trough.
- **rounding_bottom:** slow U-shaped (saucer) base, gradual momentum shift, break up above the left rim = bullish reversal. Target: saucer depth (rim→bottom) projected up from the rim breakout; stop = recent right-side trough (wider = saucer bottom).

### Continuation patterns

- **ascending_triangle:** flat resistance on top + rising lows, breakout up = bullish continuation. Target: triangle height (resistance→start low) projected up from the breakout; invalidated by a close below the ascending trendline.
- **descending_triangle:** flat support on bottom + falling highs, breakdown = bearish continuation. Target: triangle height (start high→support) projected down from the breakdown; invalidated by a close above the descending trendline.
- **ascending_wedge (rising wedge):** both bounds slope up and converge, break down = bearish (reversal/continuation-against). Target: wedge height (start width) projected down from the breakdown; invalidated by a close above the recent swing high / upper trendline.
- **descending_wedge (falling wedge):** both bounds slope down and converge, break up = bullish (reversal/continuation-against). Target: wedge height (start width) projected up from the breakout; invalidated by a close below the recent swing low / lower trendline.
- **bull_flag:** sharp rally (pole) then a slight downward-drifting channel, break up = bullish continuation. Target: flagpole length projected up from the breakout; invalidated by a close below the lower flag channel / swing low.
- **bear_flag:** sharp drop (pole) then a slight upward-drifting channel, break down = bearish continuation. Target: flagpole length projected down from the breakdown; invalidated by a close above the upper flag channel / swing high.
- **cup_and_handle:** rounded U cup + small pullback handle near the rim, break up = bullish continuation. Target: cup depth (rim→bottom) projected up from the breakout; invalidated by a close below the handle bottom (wider = cup midpoint).

### Neutral / bilateral patterns

- **symmetrical_triangle:** lower highs + higher lows converge; resolves in the prevailing trend direction on break (neutral until it breaks). Target: triangle height (widest) projected from the breakout in the break direction; stop = opposite trendline.
- **pennant:** sharp move (pole) then a small symmetrical triangle; continues in the pole's direction on break. Target: flagpole length projected from the breakout; stop = opposite trendline / recent swing within the pennant.
- **rectangle:** price oscillates between horizontal support and resistance; direction is decided by which side breaks. Target: rectangle height (support→resistance) projected from the breakout in the break direction; stop = opposite boundary.

### Reporting directive

- Patterns **not** in the current prompt's detailed set may still be reported if clearly visible — name them and describe the structure. The **reduced confidence** attaches ONLY to the pattern-identification claim itself (its detailed geometry/target/invalidation criteria were not supplied this run) — it does **not** reduce the confidence of the overall analysis. Everything else — key levels, indicators, strategies, and the action plan — must stay fully committed and quantified.
- **Actionability:** whenever any pattern (a gated candidate or one recognized from this index) informs the outlook, translate it into concrete numbers using the current `keyLevels` — a measured target, an invalidation/stop reference, and the resulting risk/reward (favor ≥2:1). Do not leave a named pattern as shape-only.

<!-- PROMPT_DIGEST:START -->
Pattern Index — one-line index of EVERY detectable chart pattern. Always know all 17 exist and NAME any pattern clearly visible on the chart, even when its detailed skill was not injected. Detailed judging (geometry tolerances, measured targets, confirmation/invalidation) arrives separately ONLY for patterns the pre-screener flags as candidates.
Reversal:
- head_and_shoulders: three peaks, middle (head) highest, neckline break down = bearish reversal. Target: head→neckline depth projected down from break; invalidated by close above right shoulder high.
- inverse_head_and_shoulders: three troughs, middle (head) lowest, neckline break up = bullish reversal. Target: neckline→head depth projected up from break; invalidated by close below right shoulder low.
- double_top: two ~equal highs (M), neckline break down = bearish reversal. Target: peak-avg→neckline depth projected down from break; invalidated by close above higher peak.
- double_bottom: two ~equal lows (W), neckline break up = bullish reversal. Target: neckline→trough-avg depth projected up from break; invalidated by close below lower trough.
- triple_top: three ~equal highs at resistance, neckline (support) break down = bearish reversal. Target: peak-avg→neckline depth projected down from break; invalidated by close above highest peak.
- triple_bottom: three ~equal lows at support, neckline (resistance) break up = bullish reversal. Target: neckline→trough-avg depth projected up from break; invalidated by close below lowest trough.
- rounding_bottom: slow U (saucer) base, break up above left rim = bullish reversal. Target: saucer depth (rim→bottom) projected up from rim breakout; stop = recent right-side trough (wider = saucer bottom).
Continuation:
- ascending_triangle: flat top resistance + rising lows, break up = bullish continuation. Target: triangle height projected up from breakout; invalidated by close below ascending trendline.
- descending_triangle: flat bottom support + falling highs, break down = bearish continuation. Target: triangle height projected down from breakdown; invalidated by close above descending trendline.
- ascending_wedge (rising): both bounds up + converging, break down = bearish. Target: wedge height (start width) projected down from breakdown; invalidated by close above recent swing high / upper trendline.
- descending_wedge (falling): both bounds down + converging, break up = bullish. Target: wedge height (start width) projected up from breakout; invalidated by close below recent swing low / lower trendline.
- bull_flag: sharp rise (pole) + slight down channel, break up = bullish continuation. Target: flagpole length projected up from breakout; invalidated by close below lower flag channel / swing low.
- bear_flag: sharp drop (pole) + slight up channel, break down = bearish continuation. Target: flagpole length projected down from breakdown; invalidated by close above upper flag channel / swing high.
- cup_and_handle: rounded U cup + small handle, break up = bullish continuation. Target: cup depth (rim→bottom) projected up from breakout; invalidated by close below handle bottom (wider = cup midpoint).
Neutral/bilateral:
- symmetrical_triangle: lower highs + higher lows converge; breaks in prevailing trend direction (neutral until break). Target: triangle height (widest) projected from breakout in break direction; stop = opposite trendline.
- pennant: sharp move (pole) + small symmetrical triangle; continues in pole direction. Target: flagpole length projected from breakout; stop = opposite trendline / recent swing within pennant.
- rectangle: range between horizontal support & resistance; direction = side that breaks. Target: rectangle height projected from breakout in break direction; stop = opposite boundary.
Directive: patterns NOT in this prompt's detailed set may still be reported if clearly visible — name and describe them, but the REDUCED confidence attaches ONLY to the pattern-identification claim (detailed criteria not supplied this run), NOT to the overall analysis. Key levels, indicators, strategies, and action plan stay fully committed and quantified.
Actionability: whenever any pattern (gated candidate or index-recognized) informs the outlook, translate it into concrete numbers from current keyLevels — measured target, invalidation/stop reference, and resulting R:R (favor ≥2:1). Never leave a named pattern as shape-only.
<!-- PROMPT_DIGEST:END -->
