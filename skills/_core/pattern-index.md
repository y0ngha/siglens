---
name: Pattern Index Reference
description: 계산되는 모든 차트 패턴의 1줄 형태·방향·geometry 요약 — 상시 주입되는 압축 인덱스(개별 판정 기준은 프리스크리너가 후보로 지목한 패턴만 게이팅)
type: indicator_guide
indicators: []
confidence_weight: 1.0
gating:
  tier: always_on
token_cost: 1768
digest_hash: "08c65fd4"
---

## Pattern Index (compressed)

Always-on one-line index of **every** chart pattern the engine can detect. Its
job is coverage, not judgement: the model should always know that all 22
patterns exist and be able to **name** any pattern it can clearly see on the
chart, even when that pattern's detailed skill was not injected this run.

The **detailed** judging criteria for a pattern — geometry tolerances,
confirmation nuance, wider invalidation context — arrive in a separate skill
only when the engine measures that specific pattern (or something close to it)
on the current chart. This index is the cheap always-present
fallback so no visible pattern goes unnamed just because its full guide
wasn't gated in. Each entry below carries a compact `geom:` definition
(breakoutLevel/extremeLevel/direction/invalidationLevel) that defines what the
fields of a **listed** Candidate's printed geometry mean; `patternSummaries[].geometry`
itself is copied only from a listed Candidate id, never derived from this index.

`type: indicator_guide` is used deliberately (not `type: pattern`): this file is
a cross-cutting always-on reference for the whole pattern category, mirroring
`_core/indicator-core.md`. It is not a single detectable pattern, so it carries
no `pattern:` id and is exempt from `usage_roles` (the always-on exemption).

Each entry's `geom:` line uses this compact notation: `B` = breakoutLevel, `E`
= extremeLevel, `dir` = direction (`up`/`down`; for symmetrical triangle, rectangle, channels and broadening it is the prior-trend direction, and with no prior trend it is undetermined and `geometry` is null), `inv` = invalidationLevel (a fixed confirmed-pivot price, not a trendline's current value) —
the same definitions as that pattern's own gated skill (one source of
wording). It defines the fields of a listed candidate's printed geometry; copy
that geometry only for a listed Candidate id (never derive it from this line); **never** compute
a measured target, conservative target, or risk/reward yourself — the app
derives 측정 목표가/보수 목표가(50%) from `geometry`.

### Reversal patterns

- **head_and_shoulders:** three peaks, middle (head) highest, neckline break down = bearish reversal. geom: B=sloped neckline@break bar (last bar if unbroken), E=B+head height (head's distance from neckline at the head bar), dir=down, inv=right-shoulder high.
- **inverse_head_and_shoulders:** three troughs, middle (head) lowest, neckline break up = bullish reversal. geom: B=sloped neckline@break bar (last bar if unbroken), E=B-head height (head's distance from neckline at the head bar), dir=up, inv=right-shoulder low.
- **double_top:** two roughly equal highs (M shape), neckline (intervening low) break down = bearish reversal. geom: B=neckline (lowest confirmed trough between peaks), E=avg(2 peaks), dir=down, inv=higher peak.
- **double_bottom:** two roughly equal lows (W shape), neckline (intervening high) break up = bullish reversal. geom: B=neckline (highest confirmed peak between troughs), E=avg(2 troughs), dir=up, inv=lower trough.
- **triple_top:** three roughly equal highs at resistance, neckline (support) break down = bearish reversal. geom: B=neckline (lowest confirmed trough between peaks), E=avg(3 peaks), dir=down, inv=highest peak.
- **triple_bottom:** three roughly equal lows at support, neckline (resistance) break up = bullish reversal. geom: B=neckline (highest confirmed peak between troughs), E=avg(3 troughs), dir=up, inv=lowest trough.
- **rounding_bottom:** slow U-shaped (saucer) base, gradual momentum shift, break up above the left rim = bullish reversal. geom: B=lip (higher rim high), E=saucer bottom, dir=up, inv=latest confirmed swing low after the bottom (bottom if none).
- **rounding_top:** slow inverted-bowl (dome) top after a rise, close below the rim (lowest low in the pattern) = bearish reversal. geom: B=lip (lower rim low), E=dome top, dir=down, inv=latest confirmed swing high after the top (top if none).

### Continuation patterns

- **ascending_triangle:** flat resistance on top + rising lows, breakout up = bullish continuation. geom: B=flat resistance@last bar, E=B-triangle height (width at first touch), dir=up, inv=last confirmed touch of support line (higher low).
- **ascending_wedge (rising wedge):** both bounds slope up and converge, break down = bearish (reversal/continuation-against). geom: B=lower trendline@last bar, E=B+wedge height (width at first touch), dir=down, inv=last confirmed touch of upper trendline (swing high).
- **descending_wedge (falling wedge):** both bounds slope down and converge, break up = bullish (reversal/continuation-against). geom: B=upper trendline@last bar, E=B-wedge height (width at first touch), dir=up, inv=last confirmed touch of lower trendline (swing low).
- **bull_flag:** sharp rally (pole) then a slight downward-drifting channel, break up = bullish continuation. geom: B=upper channel line@last bar, E=B-pole height (pole base to top), dir=up, inv=flag lowest low since pole top.
- **bear_flag:** sharp drop (pole) then a slight upward-drifting channel, break down = bearish continuation. geom: B=lower channel line@last bar, E=B+pole height (pole top to bottom), dir=down, inv=flag highest high since pole bottom.
- **cup_and_handle:** rounded U cup + small pullback handle near the rim, break up = bullish continuation. geom: B=right rim price, E=cup bottom, dir=up, inv=handle low (lowest confirmed swing low after right rim).
- **high_tight_flag:** pole of +90% or more within ~2 months, then a shallow pause (give-back ≤25%); close above the pole top = bullish continuation. geom: B=pole top, E=pole base, dir=up, inv=flag low (lowest confirmed swing low after the top).

### Neutral / bilateral patterns

- **descending_triangle:** flat support on bottom + falling highs; near direction-neutral (Bulkowski dt.html: breaks up 53%) — bearish only after a close below support. geom: B=flat support@last bar, E=B+triangle height (width at first touch), dir=down, inv=last confirmed touch of resistance line (lower high).
- **symmetrical_triangle:** lower highs + higher lows converge; neutral until it breaks (Bulkowski: up 60% / down 40%). geom: B=trendline on dir side@last bar, E=B∓triangle height (width at first touch), dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite trendline.
- **pennant:** sharp move (pole) then a small symmetrical triangle; continues in the pole's direction on break. geom: B=pennant trendline@last bar (upper=bull/lower=bear), E=B∓pole height, dir=pole direction, inv=pennant lowest low (bull) or highest high (bear) since pole top.
- **rectangle:** price oscillates between horizontal support and resistance; direction is decided by which side breaks. geom: B=boundary on dir side@last bar, E=B∓rectangle height (opposite boundary), dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite boundary.
- **ascending_channel:** parallel rising trendlines; up-trend state until a close outside either line (a close below the lower line breaks the up-trend). geom: B=line on dir side@last bar, E=B∓channel height, dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite boundary.
- **descending_channel:** parallel falling trendlines; down-trend state until a close outside either line (a close above the upper line breaks the down-trend). geom: B=line on dir side@last bar, E=B∓channel height, dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite boundary.
- **broadening_formation:** higher highs + lower lows (megaphone); neutral until a close outside a line (Bulkowski bt.html/broadb.html: up 60%). geom: B=line on dir side@last bar, E=B∓height (width at last touch), dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite boundary.

### Reporting directive

- Bulkowski: many chart patterns perform worse than in the 1990s — descending triangles almost in half (thepatternsite.com/dt.html; decade table: thepatternsite.com/TimePerformance.html) — never call a trade on a pattern alone.
- Patterns **not** in the current prompt's detailed set may still be reported if clearly visible — name them and describe the structure. The **reduced confidence** attaches ONLY to the pattern-identification claim itself (its detailed skill's tolerances/nuance were not supplied this run) — it does **not** reduce the confidence of the overall analysis. Everything else — key levels, indicators, strategies, and the action plan — must stay fully committed and quantified.
- A pattern listed with a Candidate id in the computed chart-pattern section: confirm or reject it by the actual shape; when confirmed, copy its printed geometry (the `geom:` line above defines each field) and set its candidateId. A pattern you can clearly see that the section does not list may still be named and described, with candidateId empty and `geometry` null — only listed patterns carry levels and targets. A listed Candidate prints a status — `forming`, `broken` (the last close is already beyond the breakout level) or, for boundary patterns and flags, `failed breakout` (a close went beyond the breakout line after its last touch and the last close is back inside: the structure is intact but the break failed and is unconfirmed) — describe what that status means in the answer language and never print the English code itself. A boundary pattern (symmetrical triangle, rectangle, channel, broadening formation) with no prior trend (direction undetermined) has `geometry` null: it has no breakout side and no target. Never compute a measured target, conservative target, or risk/reward yourself — the app derives 측정 목표가/보수 목표가(50%) from `geometry`.
- **Beyond this catalog:** the 22 patterns above are not an exhaustive list of what you may report — you may also name any other well-established chart pattern you clearly see (e.g. diamond, island reversal), using its standard English name. There is no `geom:` line and no Candidate id for these, so set candidateId empty and `geometry` null: only a listed Candidate carries levels and targets. Never compute a measured target, conservative target, or risk/reward yourself.

<!-- PROMPT_DIGEST:START -->
Pattern Index — one-line index of EVERY detectable chart pattern. Always know all 22 exist and NAME any pattern clearly visible on the chart, even when its detailed skill was not injected. Detailed judging (tolerances, confirmation nuance) arrives separately ONLY for patterns the engine measures on this chart — and each entry below carries a compact `geom:` line (B=breakoutLevel, E=extremeLevel, dir=direction, inv=invalidationLevel) that defines the fields of a listed Candidate's printed geometry; `geometry` is copied only from a listed Candidate id.
Reversal:
- head_and_shoulders: three peaks, middle (head) highest, neckline break down = bearish reversal. geom: B=sloped neckline@break bar (last bar if unbroken), E=B+head height (head's distance from neckline at the head bar), dir=down, inv=right-shoulder high.
- inverse_head_and_shoulders: three troughs, middle (head) lowest, neckline break up = bullish reversal. geom: B=sloped neckline@break bar (last bar if unbroken), E=B-head height (head's distance from neckline at the head bar), dir=up, inv=right-shoulder low.
- double_top: two ~equal highs (M), neckline break down = bearish reversal. geom: B=neckline (lowest confirmed trough between peaks), E=avg(2 peaks), dir=down, inv=higher peak.
- double_bottom: two ~equal lows (W), neckline break up = bullish reversal. geom: B=neckline (highest confirmed peak between troughs), E=avg(2 troughs), dir=up, inv=lower trough.
- triple_top: three ~equal highs at resistance, neckline (support) break down = bearish reversal. geom: B=neckline (lowest confirmed trough between peaks), E=avg(3 peaks), dir=down, inv=highest peak.
- triple_bottom: three ~equal lows at support, neckline (resistance) break up = bullish reversal. geom: B=neckline (highest confirmed peak between troughs), E=avg(3 troughs), dir=up, inv=lowest trough.
- rounding_bottom: slow U (saucer) base, break up above left rim = bullish reversal. geom: B=lip (higher rim high), E=saucer bottom, dir=up, inv=latest confirmed swing low after the bottom (bottom if none).
- rounding_top: slow dome top after a rise, close below the rim (lowest low) = bearish reversal. geom: B=lip (lower rim low), E=dome top, dir=down, inv=latest confirmed swing high after the top (top if none).
Continuation:
- ascending_triangle: flat top resistance + rising lows, break up = bullish continuation. geom: B=flat resistance@last bar, E=B-triangle height (width at first touch), dir=up, inv=last confirmed touch of support line (higher low).
- ascending_wedge (rising): both bounds up + converging, break down = bearish. geom: B=lower trendline@last bar, E=B+wedge height (width at first touch), dir=down, inv=last confirmed touch of upper trendline (swing high).
- descending_wedge (falling): both bounds down + converging, break up = bullish. geom: B=upper trendline@last bar, E=B-wedge height (width at first touch), dir=up, inv=last confirmed touch of lower trendline (swing low).
- bull_flag: sharp rise (pole) + slight down channel, break up = bullish continuation. geom: B=upper channel line@last bar, E=B-pole height (pole base to top), dir=up, inv=flag lowest low since pole top.
- bear_flag: sharp drop (pole) + slight up channel, break down = bearish continuation. geom: B=lower channel line@last bar, E=B+pole height (pole top to bottom), dir=down, inv=flag highest high since pole bottom.
- cup_and_handle: rounded U cup + small handle, break up = bullish continuation. geom: B=right rim price, E=cup bottom, dir=up, inv=handle low (lowest confirmed swing low after right rim).
- high_tight_flag: ≥+90% pole in ~2 months + shallow pause (≤25% give-back), close above pole top = bullish continuation. geom: B=pole top, E=pole base, dir=up, inv=flag low (lowest confirmed swing low after the top).
Neutral/bilateral:
- descending_triangle: flat bottom support + falling highs; near-neutral (Bulkowski: breaks up 53%), bearish only on close below support. geom: B=flat support@last bar, E=B+triangle height (width at first touch), dir=down, inv=last confirmed touch of resistance line (lower high).
- symmetrical_triangle: lower highs + higher lows converge; neutral until break (Bulkowski: up 60% / down 40%). geom: B=trendline on dir side@last bar, E=B∓triangle height (width at first touch), dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite trendline.
- pennant: sharp move (pole) + small symmetrical triangle; continues in pole direction. geom: B=pennant trendline@last bar (upper=bull/lower=bear), E=B∓pole height, dir=pole direction, inv=pennant lowest low (bull) or highest high (bear) since pole top.
- rectangle: range between horizontal support & resistance; direction = side that breaks. geom: B=boundary on dir side@last bar, E=B∓rectangle height (opposite boundary), dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite boundary.
- ascending_channel: parallel rising lines; up-trend until a close outside (below lower = up-trend broken). geom: B=line on dir side@last bar, E=B∓channel height, dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite boundary.
- descending_channel: parallel falling lines; down-trend until a close outside (above upper = down-trend broken). geom: B=line on dir side@last bar, E=B∓channel height, dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite boundary.
- broadening_formation: higher highs + lower lows (megaphone); neutral until a close outside (Bulkowski: up 60%). geom: B=line on dir side@last bar, E=B∓height (width at last touch), dir=prior trend (up/down; none → geometry null), inv=last confirmed touch of opposite boundary.
Directive: patterns NOT in this prompt's detailed set may still be reported if clearly visible — name and describe them, but the REDUCED confidence attaches ONLY to the pattern-identification claim (detailed nuance not supplied this run), NOT to the overall analysis. Key levels, indicators, strategies, and action plan stay fully committed and quantified. Listed (Candidate id) patterns: copy their printed geometry (null when `dir` is undetermined). A listed Candidate's status (`forming` / `broken` / `failed breakout` = a close beyond the breakout line after its last touch, last close back inside: structure intact, break failed and unconfirmed) is an internal code: say what it means in the answer language, never print the code. An unlisted pattern you clearly see may be named with candidateId empty and `geometry` null. Never compute targets — the app derives 측정 목표가/보수 목표가(50%) from `geometry`.
Evidence: Bulkowski — many patterns perform worse than in the 1990s (descending triangles almost half, thepatternsite.com/dt.html); never call a trade on a pattern alone.
Beyond this catalog: the 22 above are not exhaustive — also name any other well-established chart pattern you clearly see (e.g. diamond, island reversal) by its standard English name. No `geom:` line or Candidate id exists for these: candidateId empty, `geometry` null. Never compute a target or R:R yourself.
<!-- PROMPT_DIGEST:END -->
