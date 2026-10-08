---
name: 원형천장
description: 완만한 역U자(돔) 형태로 고점을 형성한 뒤 림 하향 이탈로 확정되는 약세 반전 패턴
type: pattern
category: reversal_bearish
pattern: rounding_top
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "림 지지선"
gating:
  tier: gated
  signal_kind: event
  triggers: [rounding_top]
token_cost: 479
digest_hash: "9a7e99ad"
---

## Detection Criteria

- Price forms a gentle, rounded dome (inverted bowl / half-moon) — a slow rise, a flat-ish crest, and a slow decline. Not a sharp spike (a V-top) and not a flat range.
- The engine fits a quadratic curve to the closes between two confirmed swing-low rims (rims at least 30 bars apart, within 5% of each other in price, no bar breaking below the lower rim by more than 0.25 ATR). The curve must open downward, its vertex (the crest) must sit in the middle half of the span — a crest at either edge is a partial curve, not a dome — and it must explain at least 60% of the closes' variance (R² ≥ 0.6); at least 40% of the closes must lie in the top third of the dome's height (a dome, not a V). The right rim must be recent: no more than max(20 bars, half the span) before the last bar.
- The dome must be meaningful: its depth (from the right rim up to the dome top) is at least 2.5× ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars). Shallower curves are noise.
- Prior trend: upward leading into the pattern (Bulkowski roundingtop.html: "Upward leading to the chart pattern").
- The two rims (the lows at the start and end of the dome) sit near the same price; Bulkowski: "58% of the time the end is slightly higher than the start."
- Confirmation (bearish): a CLOSE below the rim — the lowest low in the pattern. Bulkowski: "Downward breakouts are a close below the lower of the two rims (the lowest low in the pattern)." Until then the dome is only a candidate.

## Confidence Weight Rationale

confidence_weight: 0.7 — Bulkowski (thepatternsite.com/roundingtop.html, bull market): break-even failure rate for up/down breakouts 9%/20%; overall performance rank 2 of 39 (up) / 3 of 36 (down); 58%/14% meet the price target (up/down). Weight uses the down breakout (this skill's bearish direction): failure 20% → 11–20% → 0.7. The page does not publish a breakout-direction split, so no share adjustment is applied — but note that an upward breakout (a close above the highest high) is possible and performs well, so the dome alone is not bearish.

Factors that increase confidence:
- Tall pattern (Bulkowski: "Tall patterns perform better than short ones")
- Heavy volume on the rim breakdown (Bulkowski: heavy breakout volume suggests better performance)
- Smooth, symmetric curve with a clear upward trend into it

Factors that decrease confidence:
- Right rim above the left rim (Bulkowski: "When the right rim is above the left, the pattern under performs")
- A pullback to the rim after the breakdown (Bulkowski: throwbacks/pullbacks hurt post-breakout performance; pullback rate 58% on down breakouts)
- Crest near either edge of the span, or an abrupt spike instead of a curve

## Key Signals

- **Rim breakdown**: The rim (lowest low in the pattern) is the support line. A close below it is the only bearish confirmation.
- **Upside alternative**: A close above the highest peak is an upward breakout — the dome then acted as a pause, not a top. State this possibility while the pattern is unconfirmed.
- **Low target hit rate on the downside**: Only 14% of downward breakouts reach the full measure-rule target (Bulkowski) — never present the target as an expectation.

## False Positive Conditions

- **V-top / spike**: A sharp rise and fall is not a rounding top.
- **Unconfirmed dome**: Price still above the rim — the pattern is a candidate only; the bearish thesis is not active.
- **Right rim higher than left**: under-performs per Bulkowski.
- **Shallow dome**: a depth under 2.5× ATR (or under the price-share minimum) is noise, not a formation.
- **Pullback into the rim**: a quick return to the broken rim weakens the breakdown.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the lip — the lower of the two rim lows; `extremeLevel` = the dome top (the highest high between the rims); `direction` = 'down'; `invalidationLevel` = the most recent confirmed swing high after the dome top, or the dome top itself when none (a close above it is an upward breakout, negating the bearish read). When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Support**: Bulkowski: "The two rims are support areas."
- **Target reliability**: Bulkowski: 14% of downward breakouts meet the price target — the conservative (50%) level is the more realistic reference.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: The rim (support) and the dome top.
- **patternSummaries**: Status (dome forming / rim tested / rim broken — confirmed / upside break — negated), dome height as a % of the rim, formation duration, rim symmetry (right rim vs left rim).
- **Volume context**: Whether volume rose on the rim breakdown.
- **Completion status**: Candidate until a close below the rim; say so explicitly.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
원형천장 (Rounding Top) — bearish reversal, confidence_weight 0.7 (Bulkowski roundingtop.html: failure up/down 9%/20%, rank 2/39 up, 3/36 down, target met 58%/14%; no breakout-direction split published).

### Detection
- Gentle rounded dome (inverted bowl) — slow rise, crest, slow decline. NOT a V-top spike, NOT a flat range.
- Engine: quadratic fit on the closes between two confirmed swing-low rims (≥30 bars apart, within 5%), crest in the middle half of the span, R² ≥ 0.6, depth ≥2.5× ATR and the price-share minimum.
- Prior trend up into the pattern. Rims near the same price.
- Confirmed ONLY by a CLOSE below the rim (lowest low in the pattern). Before that: candidate.

### Grading
- Increase: tall dome; heavy breakdown volume; smooth symmetric curve.
- Decrease: right rim above left rim (under-performs); pullback to the rim after breakdown; crest at an edge / spike.
- A close above the highest peak = upward breakout — dome was a pause, bearish read negated.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the lip (the lower of the two rim lows), extremeLevel: the dome top (highest high between the rims), direction: 'down', invalidationLevel: the most recent confirmed swing high after the dome top (the dome top when none) }. Copy from `## Chart Pattern Candidates (computed)` when listed; else identify from the bars. Never compute a measured target, conservative target, or R:R — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)). Only 14% of down breakouts reach the full target.

### Output
- keyPrices: rim, dome top.
- patternSummaries: status (forming / rim tested / rim broken / upside break — negated); height % of rim; duration; rim symmetry.
- Volume on breakdown; completion status (candidate until close below rim).
- geometry per above — never a computed target or R:R.
- trend: bearish only after the rim break; neutral while forming.
<!-- PROMPT_DIGEST:END -->
