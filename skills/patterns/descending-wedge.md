---
name: 하락쐐기
description: 고점과 저점이 모두 하락하지만 폭이 좁아지는 형태로 상승 반전 신호
type: pattern
category: continuation_bullish
pattern: descending_wedge
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "추세선"
---

## Detection Criteria

- Both highs and lows must be falling, forming a series of lower highs and lower lows.
- The upper trendline (connecting highs) and lower trendline (connecting lows) must converge, meaning the range between highs and lows narrows over time.
- A minimum of 3 touches on each trendline (3 highs and 3 lows) is required for structural validity.
- The upper trendline must have a steeper slope than the lower trendline for the convergence to be valid.
- The convergence ratio (narrowing of the range from start to end) should be at least 30% for the pattern to be meaningful.
- The pattern requires a minimum of 15 bars for structural validity.
- A break above the upper trendline confirms the bullish reversal signal.

## Confidence Weight Rationale

confidence_weight: 0.7 — Descending Wedge carries the same confidence weight as the Ascending Wedge. While descending wedges predominantly break upward, the absence of a clear neckline or defined reversal point makes timing and confirmation more ambiguous compared to Head and Shoulders or Double Bottom patterns. Trendline placement can be subjective, introducing detection variability.

Factors that increase confidence:
- Clear convergence with at least 4 touches per trendline
- Volume decline during pattern formation followed by surge on breakout
- Decisive break above upper trendline with volume surge
- Pattern duration > 25 bars

Factors that decrease confidence:
- Fewer than 3 touches per trendline
- No volume pattern during formation
- Break occurs near the apex (less room for measured move)
- Ambiguous convergence (trendlines nearly parallel)

## Key Signals

- **Decreasing volume during formation**: Volume should progressively decline as the wedge narrows. This indicates selling pressure is exhausting despite falling prices.
- **Break above upper trendline**: A decisive close above the upper trendline confirms the bullish reversal. The break should occur in the first two-thirds of the wedge (measured from start to projected apex) for maximum reliability.
- **Volume surge on breakout**: A significant increase in volume accompanying the trendline break confirms buying pressure and validates the reversal signal.
- **Momentum divergence**: RSI or MACD showing bullish divergence (rising indicator values while prices continue to fall within the wedge) strengthens the reversal signal.

## False Positive Conditions

- **Parallel channel confusion**: If the upper and lower trendlines have nearly equal slopes (convergence < 15%), the pattern is a descending channel, not a wedge. Channels have different continuation/reversal implications.
- **Insufficient convergence**: If the range narrows by less than 30% from the pattern start to the current position, the wedge structure is not well-defined.
- **Fewer than 3 trendline touches**: Without sufficient touches, the trendlines are statistically unreliable and the pattern identification is premature.
- **Strong bearish catalyst**: A descending wedge forming during a period of deteriorating fundamentals or sector weakness may break downward instead of the typical upward resolution.
- **Break near the apex**: If the break occurs very close to the apex (last 10% of the wedge), the measured move potential is minimal and the signal is less actionable.

## Entry/Exit Considerations

- **Target price calculation**: Measure the height of the wedge at its widest point (the vertical distance between the upper and lower trendlines at the pattern start). Project this distance upward from the breakout point. Example: if the wedge starts with a $10 range and breaks at $95, the target is $105.
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the lower trendline defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The most recent swing low within the wedge or the lower trendline serves as the invalidation level. A close below this level negates the bullish pattern.
- **Partial target**: 50% of the wedge height serves as a conservative initial target.
- **Breakout timing**: Breaks that occur in the first half to two-thirds of the wedge (before reaching the apex) tend to produce stronger moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the current upper and lower trendline values, the projected apex price and bar, and the breakout target price if the upper trendline is broken.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / upper trendline broken), the convergence rate, number of trendline touches, and position within the wedge (early, mid, late).
- **Volume context**: State whether volume is declining as expected within the wedge and whether a volume surge accompanied any trendline break.
- **Completion status**: Clearly indicate whether the wedge is still forming or confirmed by a close above the upper trendline.
- **Target projection**: Calculate and state the measured move target using the widest wedge height projected from the breakout point.
