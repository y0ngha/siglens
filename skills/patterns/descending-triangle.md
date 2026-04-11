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

- **Target price calculation**: Measure the height of the triangle at its widest point (the vertical distance from the highest point of the descending trendline at the pattern start to the horizontal support). Project this distance downward from the breakdown point. Example: if support is at $50 and the triangle starts with a high of $60, the target is $40 ($50 - $10).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the descending trendline defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The most recent lower high on the descending trendline or the trendline itself serves as the invalidation level. A close above this negates the bearish pattern.
- **Partial target**: 50% of the triangle height serves as a conservative initial target.
- **Breakout scenario**: If price closes above the descending trendline, the bullish target is the full triangle height projected upward from the breakout point — this can produce a strong move as it traps bearish participants.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the horizontal support level, the current descending trendline value, the projected apex price, and the breakdown target price if support is broken.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / support broken / trendline broken upward), the number of touches on support and resistance, the breakdown position relative to the apex (early, mid, late), and the prior trend direction.
- **Volume context**: State whether volume is contracting as expected during formation and whether a volume surge accompanied any breakdown or breakout.
- **Completion status**: Clearly indicate whether the triangle is still forming or confirmed by a decisive close below the horizontal support.
- **Target projection**: Calculate and state the measured move target using the triangle height projected from the breakdown point.
