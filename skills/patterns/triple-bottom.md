---
name: 삼중바닥
description: 세 개의 저점이 거의 같은 가격 수준에서 형성되는 상승 반전 신호
type: pattern
category: reversal_bullish
pattern: triple_bottom
indicators: []
confidence_weight: 0.75
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "넥라인"
---

## Detection Criteria

- Three distinct troughs must form at approximately the same price level, within 2-3% of each other.
- Two clear peaks must exist between the three troughs, forming a neckline when connected.
- Each trough must be separated by a meaningful rally (at least 3% from the trough average to the neckline).
- The three troughs must span a minimum of 20 bars to ensure structural validity — Triple Bottom requires more time to form than Double Bottom.
- The closer the three trough prices are to each other, the higher the pattern reliability.
- The pattern is confirmed when price closes above the neckline (the line connecting the two peaks between troughs).

## Confidence Weight Rationale

confidence_weight: 0.75 — Triple Bottom has a slightly lower confidence weight than Triple Top (0.8) because bottoming patterns generally take longer to confirm and volume patterns at bottoms are less distinct. Bulkowski reports an 80-85% success rate. The three-trough structure still provides more confirmation than a Double Bottom, as three successful defenses of support demonstrate strong accumulation.

Factors that increase confidence:
- All three trough prices within 1.5% of each other
- Volume decreasing on the third trough compared to the first
- Volume surge on neckline break
- Pattern duration > 30 bars
- RSI or MACD showing bullish divergence across the three troughs

Factors that decrease confidence:
- Trough prices differing by more than 3%
- No volume pattern across troughs
- Shallow peaks between troughs (< 3% from trough average)
- Pattern forming in a strong downtrend with no sign of stabilization
- Third trough notably deeper than the first two (may indicate accelerating downtrend)

## Key Signals

- **Volume decline on third trough**: Ideally, volume decreases on each successive trough, indicating selling pressure is exhausting. The third trough with the lowest volume shows sellers have been absorbed.
- **Neckline break with volume surge**: A close above the neckline accompanied by increased volume confirms the bullish reversal. The neckline connects the two peaks between the three troughs.
- **RSI divergence**: If RSI makes progressively higher lows across the three troughs while price remains at similar levels, this triple bullish divergence is a powerful confirmation of accumulation.
- **Successful retest**: After the neckline break, a pullback that holds above the neckline level strengthens the bullish case and provides a second entry reference point.
- **Third trough strength**: The third trough bouncing more quickly than previous troughs indicates growing buyer confidence.

## False Positive Conditions

- **Downtrend continuation**: In a strong downtrend, three troughs at similar levels may represent a temporary pause before further decline. Examine the broader trend context and fundamental backdrop.
- **No volume patterns**: If volume shows no discernible pattern across the three troughs, the accumulation thesis is weaker and the reversal may not materialize.
- **Insufficient time between troughs**: If the three troughs form too quickly (< 20 bars total), the structure may be noise rather than meaningful accumulation.
- **Descending troughs**: If each successive trough is notably lower than the previous one (> 3%), this is a descending channel, not a Triple Bottom.
- **Premature neckline break**: An intraday wick above the neckline without a closing break is not confirmation.
- **Confusion with Inverse Head and Shoulders**: If the middle trough is significantly lower than the other two, the pattern is Inverse Head and Shoulders, not Triple Bottom.

## Entry/Exit Considerations

- **Target price calculation**: Measure the vertical distance from the neckline to the average of the three troughs. Project this distance upward from the neckline break point. Example: if neckline is at $57 and troughs average $50, the target is $64 ($57 + $7).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the lowest trough defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The lowest of the three troughs serves as the invalidation level. A close below this level negates the bullish pattern.
- **Partial target**: 50% of the full projected distance serves as a conservative initial target.
- **Time factor**: Triple Bottoms that take longer to form (> 40 bars) tend to produce larger moves due to greater accumulation.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include all three trough prices, the neckline price level (connecting the two peaks), and the projected target price if the neckline is broken.
- **patternSummaries**: Describe the pattern status (first/second/third trough formed / completed / neckline broken), the price difference percentage among the three troughs, the spacing between them, and how it differs from Double Bottom or Inverse Head and Shoulders.
- **Volume context**: State whether volume behavior confirms the pattern (declining volume across troughs, volume surge on neckline break). Note volume comparison between each successive trough.
- **Completion status**: Clearly indicate whether the pattern is still forming (which trough is in progress) or fully confirmed by a neckline break.
- **Target projection**: Calculate and state the measured move target using neckline-to-trough distance projected above the neckline.
