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
token_cost: 615
digest_hash: "317ddf4a"
---

## Detection Criteria

- Price forms a gentle, rounded dome (inverted bowl / half-moon) — a slow rise, a flat-ish crest, and a slow decline. Not a sharp spike (a V-top) and not a flat range.
- Engine rule: Pivots are confirmed swings: a swing counts once price reverses 1.5 ATR from it, measured with the ATR of the bar that confirms it, so a confirmed pivot never moves when bars are added, and no bar is both a swing high and a swing low. A quadratic curve fitted to the closes between two confirmed swing-low rims (rims at least 30 bars apart, within 5% of each other in price AND at most 25% of the depth apart, depth measured from the higher rim). No bar between the rims may go below the higher rim by more than 0.25 ATR once price has left the rims (the other rim's own leg is not counted). The curve must open downward with its vertex in the middle half of the span (25%–75%), explain at least 60% of the closes' variance (R² ≥ 0.6), and have at least 40% of the closes in the top third of the dome's depth (a dome, not a spike). Depth (from the higher rim to the dome top) is at least 2.5× ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars); the right rim must be no more than max(20 bars, half the span) before the last bar. Unlike a cup, the rim match stays at 5% (a looser match turned W-shaped bases into rounding bottoms) and no prior advance is required.
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

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the lip — the lower of the two rim lows; `extremeLevel` = the dome top (the highest high between the rims); `direction` = 'down'; `invalidationLevel` = the most recent confirmed swing high after the dome top, or the dome top itself when none (a close above it is an upward breakout, negating the bearish read). Copy these values from `## Chart Pattern Candidates (computed)` only when this pattern instance is listed there (set its Candidate id as candidateId); when it is not listed, you may still name and describe the pattern, but `geometry` is null and candidateId is empty — only listed patterns carry levels and targets. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Support**: Bulkowski: "The two rims are support areas."
- **Target reliability**: Bulkowski: 14% of downward breakouts meet the price target — the conservative (50%) level is the more realistic reference.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: The rim (support) and the dome top.
- **patternSummaries**: Status (dome forming / rim tested / rim broken — confirmed / upside break — negated), dome height as a % of the rim, formation duration, rim symmetry (right rim vs left rim).
- **Volume context**: Whether volume rose on the rim breakdown.
- **Completion status**: Candidate until a close below the rim; say so explicitly.
- **geometry**: For a listed pattern instance (with a Candidate id), fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. For an unlisted pattern, `geometry` is null and candidateId is empty. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
원형천장 (Rounding Top) — bearish reversal, confidence_weight 0.7 (Bulkowski roundingtop.html: failure up/down 9%/20%, rank 2/39 up, 3/36 down, target met 58%/14%; no breakout-direction split published).

### Detection
- Gentle rounded dome (inverted bowl) — slow rise, crest, slow decline. NOT a V-top spike, NOT a flat range.
- Engine: pivots = confirmed swings (1.5 ATR reversal measured with the confirming bar's ATR; fixed once confirmed; one pivot per bar); quadratic fit on the closes between two confirmed swing-low rims (≥30 bars apart, within 5% AND ≤25% of the depth apart), no bar between below the higher rim by >0.25 ATR (the other rim's own leg excluded), crest in the middle half of the span, R² ≥ 0.6, ≥40% of closes in the top third (dome), depth from the higher rim ≥2.5× ATR and the price-share minimum, right rim ≤ max(20 bars, half the span) before the last bar.
- Prior trend up into the pattern. Rims near the same price.
- Confirmed ONLY by a CLOSE below the rim (lowest low in the pattern). Before that: candidate.

### Grading
- Increase: tall dome; heavy breakdown volume; smooth symmetric curve.
- Decrease: right rim above left rim (under-performs); pullback to the rim after breakdown; crest at an edge / spike.
- A close above the highest peak = upward breakout — dome was a pause, bearish read negated.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the lip (the lower of the two rim lows), extremeLevel: the dome top (highest high between the rims), direction: 'down', invalidationLevel: the most recent confirmed swing high after the dome top (the dome top when none) }. Copy from `## Chart Pattern Candidates (computed)` only when this instance is listed there (with its Candidate id); when not listed, the pattern may be described but `geometry` is null and candidateId empty. Never compute a measured target, conservative target, or R:R — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)). Only 14% of down breakouts reach the full target.

### Output
- keyPrices: rim, dome top.
- patternSummaries: status (forming / rim tested / rim broken / upside break — negated); height % of rim; duration; rim symmetry.
- Volume on breakdown; completion status (candidate until close below rim).
- geometry per above — never a computed target or R:R; only for a listed instance, else `geometry` null and candidateId empty.
- trend: bearish only after the rim break; neutral while forming.
<!-- PROMPT_DIGEST:END -->
