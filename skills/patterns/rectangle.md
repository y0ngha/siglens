---
name: 직사각형
description: 수평 지지선과 저항선 사이에서 횡보하는 연속 또는 반전 패턴
type: pattern
category: continuation
pattern: rectangle
indicators: []
confidence_weight: 0.65
display:
  chart:
    show: true
    type: line
    color: "#78909c"
    label: "지지/저항선"
---

## Detection Criteria

- A horizontal resistance line must be present, with at least 2 touches at approximately the same price level (within 2%).
- A horizontal support line must be present, with at least 2 touches at approximately the same price level (within 2%).
- Both lines must be clearly horizontal (slope < 1.5%), distinguishing this from a channel or wedge.
- The vertical distance between support and resistance must be at least 3% of the support price to constitute a meaningful range.
- Price must oscillate between support and resistance with clear bounces — not a gradual drift.
- The pattern requires a minimum of 15 bars for structural validity.
- A prior trend must exist before the rectangle forms, establishing it as either a continuation (Rectangle Top in uptrend, Rectangle Bottom in downtrend) or potential reversal.
- The pattern is confirmed when price decisively closes outside either boundary with increased volume.

## Rectangle Top vs Rectangle Bottom

- **Rectangle Top**: Forms after an uptrend. The horizontal resistance represents a ceiling where the prior advance stalls. If price breaks upward through resistance, the uptrend continues. If it breaks downward through support, the trend reverses.
- **Rectangle Bottom**: Forms after a downtrend. The horizontal support represents a floor where the prior decline stalls. If price breaks downward through support, the downtrend continues. If it breaks upward through resistance, the trend reverses.

## Confidence Weight Rationale

confidence_weight: 0.65 — Rectangle patterns have a lower confidence weight because the breakout direction is inherently unpredictable — price can break in either direction with roughly equal probability. However, Bulkowski's research shows that Rectangle Tops produce an average 51% profit when they break out, making them the most profitable chart pattern by average return. The pattern's value lies in its clear, objective boundaries and well-defined risk parameters, not in directional prediction.

Factors that increase confidence:
- 3+ touches on both support and resistance
- Volume declining during the pattern with a surge on breakout
- Breakout direction aligns with the prior trend
- Pattern duration > 20 bars (more established boundaries)
- Previous trend was strong and well-defined

Factors that decrease confidence:
- Fewer than 2 touches on either boundary
- High, erratic volume during the pattern
- No clear prior trend
- Boundaries are not horizontal (sloping channel instead)
- Multiple false breakouts have already occurred

## Key Signals

- **Volume contraction during formation**: Volume should gradually decline as the rectangle develops. This compression precedes a decisive breakout. Sustained high volume within the range suggests ongoing distribution or accumulation.
- **Breakout with volume surge**: A close outside the rectangle boundary accompanied by significantly increased volume confirms the directional move. This is the most critical signal — low-volume breakouts often fail.
- **Touch count reliability**: More touches on support and resistance increase the significance of a breakout. However, too many touches (> 6-7) without resolution may indicate the pattern is "stale" and losing energy.
- **Prior trend context**: The prior trend provides a continuation bias. Rectangle Tops in uptrends more often break upward; Rectangle Bottoms in downtrends more often break downward. But reversal breakouts, while less frequent, can be powerful.
- **Accumulation/Distribution signals**: In Rectangle Tops, check for accumulation signs (higher volume on bounces from support). In Rectangle Bottoms, check for distribution signs (higher volume on rejections from resistance).

## False Positive Conditions

- **False breakout**: The most common failure mode. Price briefly closes outside the rectangle then reverses back inside. Wait for a second consecutive close outside the boundary, or require a meaningful extension (1-2% beyond the boundary).
- **Sloped boundaries**: If either the support or resistance line has a slope > 1.5%, the pattern is a channel or wedge, not a rectangle. These have different breakout characteristics.
- **Too narrow range**: If the rectangle height is less than 3% of the support price, the range is too small to produce a meaningful measured move, and breakout noise may dominate.
- **Declining touch quality**: If bounces from support or resistance become weaker over time (smaller bounces, quicker reversals), the boundary may be about to fail.
- **No prior trend**: Without a preceding trend, the rectangle is a range-bound market with no continuation or reversal context, reducing its predictive value.

## Entry/Exit Considerations

- **Target price calculation**: Measure the height of the rectangle (the vertical distance from support to resistance). Project this distance in the breakout direction from the breakout point. Example: if support is at $90 and resistance is at $100, an upward breakout targets $110 ($100 + $10) and a downward breakdown targets $80 ($90 - $10).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the opposite boundary defines the risk/reward ratio. Rectangles often provide favorable ratios because the stop level (opposite boundary) is well-defined.
- **Stop-loss reference level**: The opposite boundary of the rectangle from the breakout direction serves as the invalidation level. For an upward breakout, support is the stop reference. For a downward breakdown, resistance is the stop reference.
- **Partial target**: 50% of the rectangle height serves as a conservative initial target.
- **Multiple targets**: Bulkowski's data shows that Rectangle Top breakouts often exceed the measured move target — consider using the full target as a minimum expectation.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the support level, resistance level, rectangle height, and the projected target prices in both breakout directions.
- **patternSummaries**: Describe the rectangle type (Top or Bottom based on prior trend), the pattern status (forming / support broken / resistance broken), the number of touches on each boundary, the rectangle height as a percentage of price, and the pattern duration. Note the prior trend direction and its implication for breakout bias.
- **Volume context**: State whether volume is declining during formation, whether volume favors one direction (accumulation or distribution), and whether a volume surge confirmed the breakout. Note any false breakout attempts.
- **Completion status**: Clearly indicate whether the rectangle is still forming or confirmed by a decisive close outside a boundary with volume confirmation.
- **Target projection**: Calculate and state the measured move target in both directions using the rectangle height projected from each boundary.
