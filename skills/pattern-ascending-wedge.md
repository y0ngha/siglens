---
name: 상승쐐기
description: 고점과 저점이 모두 상승하지만 폭이 좁아지는 형태로 하락 반전 신호
type: pattern
category: continuation_bearish
pattern: ascending_wedge
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "추세선"
---

## Detection Criteria

- Both highs and lows must be rising, forming a series of higher highs and higher lows.
- The upper trendline (connecting highs) and lower trendline (connecting lows) must converge, meaning the range between highs and lows narrows over time.
- A minimum of 3 touches on each trendline (3 highs and 3 lows) is required for structural validity.
- The lower trendline must have a steeper slope than the upper trendline for the convergence to be valid.
- The convergence ratio (narrowing of the range from start to end) should be at least 30% for the pattern to be meaningful.
- The pattern requires a minimum of 15 bars for structural validity.
- A break below the lower trendline confirms the bearish reversal signal.

## Confidence Weight Rationale

confidence_weight: 0.7 — Ascending Wedge has a lower confidence weight than Head and Shoulders (0.8) or Double Top (0.75) because the breakout direction is statistically less predictable. While ascending wedges predominantly break downward, the absence of a clear neckline or defined reversal point makes timing and confirmation more ambiguous. The converging trendlines can also be subjective in their placement, introducing detection variability.

Factors that increase confidence:
- Clear convergence with at least 4 touches per trendline
- Consistent volume decline as the wedge narrows
- Decisive break below lower trendline with volume surge
- Pattern duration > 25 bars

Factors that decrease confidence:
- Fewer than 3 touches per trendline
- No volume decline during pattern formation
- Break occurs near the apex (less room for measured move)
- Ambiguous convergence (trendlines nearly parallel)

## Key Signals

- **Decreasing volume**: Volume should progressively decline as the wedge narrows. This indicates diminishing momentum despite rising prices, a hallmark of an unsustainable advance.
- **Break below lower trendline**: A decisive close below the lower trendline confirms the bearish reversal. The break should occur in the first two-thirds of the wedge (measured from start to projected apex) for maximum reliability.
- **Volume surge on breakdown**: A significant increase in volume accompanying the trendline break confirms selling pressure and validates the reversal signal.
- **Momentum divergence**: RSI or MACD showing bearish divergence (declining indicator values while prices continue to rise within the wedge) strengthens the reversal signal.

## False Positive Conditions

- **Parallel channel confusion**: If the upper and lower trendlines have nearly equal slopes (convergence < 15%), the pattern is a rising channel, not a wedge. Channels have different continuation/reversal implications.
- **Insufficient convergence**: If the range narrows by less than 30% from the pattern start to the current position, the wedge structure is not well-defined.
- **Fewer than 3 trendline touches**: Without sufficient touches, the trendlines are statistically unreliable and the pattern identification is premature.
- **Strong fundamental catalyst**: An ascending wedge forming during a period of strong earnings or sector rotation may break upward instead of the typical downward resolution.
- **Break near the apex**: If the break occurs very close to the apex (last 10% of the wedge), the measured move potential is minimal and the signal is less actionable.

## Entry/Exit Considerations

- **Target price calculation**: Measure the height of the wedge at its widest point (the vertical distance between the upper and lower trendlines at the pattern start). Project this distance downward from the breakdown point. Example: if the wedge starts with a $10 range and breaks at $105, the target is $95.
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the upper trendline defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The most recent swing high within the wedge or the upper trendline serves as the invalidation level. A close above this level negates the bearish pattern.
- **Partial target**: 50% of the wedge height serves as a conservative initial target.
- **Breakout timing**: Breaks that occur in the first half to two-thirds of the wedge (before reaching the apex) tend to produce stronger moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the current upper and lower trendline values, the projected apex price and bar, and the breakdown target price if the lower trendline is broken.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / lower trendline broken), the convergence rate, number of trendline touches, and position within the wedge (early, mid, late).
- **Volume context**: State whether volume is declining as expected within the wedge and whether a volume surge accompanied any trendline break.
- **Completion status**: Clearly indicate whether the wedge is still forming or confirmed by a close below the lower trendline.
- **Target projection**: Calculate and state the measured move target using the widest wedge height projected from the breakdown point.
