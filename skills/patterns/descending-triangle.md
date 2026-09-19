---
name: 하락삼각형
description: 수평 지지선과 하락하는 저항 추세선이 수렴하는 약세 연속 패턴
type: pattern
category: continuation_bearish
pattern: descending_triangle
indicators: []
confidence_weight: 0.8
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "지지선"
gating:
  tier: gated
  signal_kind: event
  triggers: [descending_triangle]
token_cost: 607
digest_hash: "856fdd3f"
---

## Detection Criteria

- A horizontal support line must be present, with at least 2 touches at approximately the same price level (within 1%).
- A descending resistance trendline must be present, connecting at least 2 progressively lower highs.
- Price must be converging within the triangle — the range between the falling resistance and the horizontal support narrows over time.
- The pattern requires a minimum of 15 bars for structural validity.
- The horizontal support must be clearly flat (slope < 1%), distinguishing this from a symmetrical triangle.
- The descending trendline must show a clear downward slope with each successive high being meaningfully lower than the previous one.
- The pattern is confirmed when price closes below the horizontal support with increased volume.

## Confidence Weight Rationale

confidence_weight: 0.8 — Descending Triangle is one of the more reliable bearish continuation patterns. Bulkowski's Encyclopedia of Chart Patterns reports a breakdown success rate near 87% (downward breakout occurring ~64% of the time, with the breakout reaching target). The horizontal support provides a clear, objective breakdown level, and the psychological weight of repeated lower highs pressing against a flat support adds conviction. The 0.8 weight reflects this strong empirical track record and the pattern's objectivity relative to wedges or symmetrical triangles.

Factors that increase confidence:
- 3+ touches on the horizontal support
- 3+ touches on the descending resistance line
- Volume declining as the triangle narrows
- Breakdown occurring in the first 2/3 of the triangle
- Prior downtrend present before the pattern formed

Factors that decrease confidence:
- Fewer than 2 touches on either line
- Breakdown near or past the apex of the triangle
- No prior trend (pattern forming in a range-bound market)
- Volume remaining high during the pattern without breakdown
- Descending trendline with only marginal lower highs

## Key Signals

- **Volume contraction during formation**: Volume should progressively decline as the triangle narrows. This compression precedes the decisive breakdown move.
- **Support breakdown with volume surge**: A close below the horizontal support accompanied by significantly increased volume confirms the bearish breakdown.
- **Falling highs acceleration**: If the descending resistance trendline shows accelerating lower highs (the rate of decline steepens), selling pressure is intensifying.
- **Breakdown timing**: Breakdowns that occur between the 50% and 75% point of the triangle are statistically the most reliable.
- **Retest of support as resistance**: After the breakdown, a rally back to the former support level that fails to reclaim it confirms the bearish pattern.

## False Positive Conditions

- **Upward breakout (bull trap risk)**: Approximately 13% of descending triangles break upward. When this occurs, it can be a powerful bullish signal as it represents a failure of the bearish pattern. However, beware of false breakouts — check volume confirmation.
- **Apex breakdown**: Breakdowns occurring very close to or past the apex point have significantly reduced reliability and measured move potential.
- **No volume confirmation**: A breakdown below support without a volume surge may be a false breakdown. Price may quickly reverse back inside the triangle.
- **Strong support context**: If the horizontal support coincides with a major historical support level and is being tested for the first time, the likelihood of a bounce increases.
- **Premature breakdown**: An intraday wick below support without a closing break is not confirmation.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the horizontal support level; `extremeLevel` = the descending resistance trendline's value at the pattern's start (its widest point); `direction` = 'down'; `invalidationLevel` = the descending resistance trendline's current (last-bar) value — the most recent lower high. When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The most recent lower high on the descending trendline or the trendline itself serves as the invalidation level. A close above this negates the bearish pattern.
- **Breakout scenario**: If price closes above the descending trendline instead, treat the pattern as having failed/reversed to bullish (a bear trap) — this alternate scenario is not in `## Chart Pattern Candidates (computed)`, so do not compute a target for it yourself; describe the reversal qualitatively.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the horizontal support level, the current descending trendline value, and the projected apex price.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / support broken / trendline broken upward), the number of touches on support and resistance, the breakdown position relative to the apex (early, mid, late), and the prior trend direction.
- **Volume context**: State whether volume is contracting as expected during formation and whether a volume surge accompanied any breakdown or breakout.
- **Completion status**: Clearly indicate whether the triangle is still forming or confirmed by a decisive close below the horizontal support.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Descending Triangle (bearish continuation)

Geometry:
- Horizontal support line: ≥2 touches at ~same price (within 1%); slope must be < 1% (else symmetrical triangle).
- Descending resistance trendline: ≥2 progressively lower highs, clear downward slope.
- Price converges (range narrows) toward apex. Minimum 15 bars.

Confirmation: close BELOW horizontal support with increased volume. Intraday wick below support without a close = not confirmed. Volume should decline as triangle narrows.

Confidence (weight 0.8): breakdown success ~87%; downward breakout ~64% of the time.
- Increase: 3+ touches on support, 3+ on resistance, declining volume, breakdown in first 2/3 (50%–75% point most reliable), prior downtrend.
- Decrease: <2 touches either line, breakdown near/past apex, no prior trend, volume high without breakdown, only marginal lower highs.

False positives / invalidation:
- ~13% break upward (bull trap risk / powerful bullish failure signal — check volume).
- Apex/near-apex breakdown = reduced reliability & target.
- Breakdown without volume surge may be false.
- Support at major historical level tested first time → higher bounce odds.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the horizontal support level, extremeLevel: the descending resistance trendline's value at the pattern's start (its widest point), direction: 'down', invalidationLevel: the descending resistance trendline's current (last-bar) value — the most recent lower high }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: horizontal support, current descending trendline value, projected apex price.
- patternSummaries: status (forming / approaching apex / support broken / trendline broken upward), touch counts on support & resistance, breakdown position vs apex (early/mid/late), prior trend direction.
- Volume context: contraction during formation; volume surge on breakdown/breakout.
- Completion status: forming vs confirmed (decisive close below support).
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
