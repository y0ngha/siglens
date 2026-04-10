---
name: 삼중천장
description: 세 개의 고점이 거의 같은 가격 수준에서 형성되는 하락 반전 신호
type: pattern
category: reversal_bearish
pattern: triple_top
indicators: []
confidence_weight: 0.8
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "넥라인"
---

## Detection Criteria

- Three distinct peaks must form at approximately the same price level, within 2-3% of each other.
- Two clear troughs must exist between the three peaks, forming a neckline when connected.
- Each peak must be separated by a meaningful retracement (at least 3% from the peak average to the neckline).
- The three peaks must span a minimum of 20 bars to ensure structural validity — Triple Top requires more time to form than Double Top.
- The closer the three peak prices are to each other, the higher the pattern reliability.
- The pattern is confirmed when price closes below the neckline (the line connecting the two troughs between peaks).

## Confidence Weight Rationale

confidence_weight: 0.8 — Triple Top has a higher confidence weight than Double Top (0.75) because the third failed attempt at breaking resistance provides additional confirmation of bearish reversal. Thomas Bulkowski's statistical analysis shows an 88% success rate. The three-peak structure offers more structural evidence than the two-peak Double Top, making false positives less likely.

Factors that increase confidence:
- All three peak prices within 1.5% of each other
- Volume progressively declining on each successive peak
- Neckline break with volume surge
- Pattern duration > 30 bars
- Clear volume decline on the third peak compared to the first

Factors that decrease confidence:
- Peak prices differing by more than 3%
- No progressive volume decline across peaks
- Shallow troughs between peaks (< 3% from peak average)
- Pattern forming in a choppy, directionless market
- Third peak significantly lower than first two (may indicate gradual downtrend instead)

## Key Signals

- **Progressive volume decline**: Volume should decrease on each successive peak. The third peak should show the lowest volume, indicating exhausted buying pressure after three failed attempts to break resistance.
- **Neckline break with volume**: A close below the neckline accompanied by increased volume confirms the bearish reversal. The neckline is drawn by connecting the two troughs between the three peaks.
- **RSI divergence**: If RSI makes progressively lower highs across the three peaks while price remains at similar levels, this triple bearish divergence is a powerful confirmation.
- **Failed retest**: After the neckline break, a retest that fails to reclaim the neckline level strengthens the bearish case.
- **Third peak weakness**: The third peak showing noticeably weaker momentum (shorter time at the high, quicker rejection) reinforces the pattern.

## False Positive Conditions

- **Strong uptrend consolidation**: In a powerful uptrend, three peaks at similar levels may represent extended consolidation (a rectangle pattern) rather than a reversal. Check the broader trend context and volume behavior.
- **No volume divergence**: If volume remains consistent or increases across the three peaks, buying pressure has not weakened and the pattern may resolve upward as a rectangle breakout.
- **Insufficient time between peaks**: If the three peaks form too quickly (< 20 bars total), the structure may be noise rather than a meaningful reversal pattern.
- **Ascending peaks**: If each successive peak is notably higher than the previous one (> 3% difference), this is a rising channel, not a Triple Top.
- **Premature neckline break**: An intraday wick below the neckline without a closing break is not confirmation. Wait for a decisive close below.
- **Confusion with Head and Shoulders**: If the middle peak is significantly higher than the other two, the pattern is Head and Shoulders, not Triple Top. All three peaks must be at approximately the same level.

## Entry/Exit Considerations

- **Target price calculation**: Measure the vertical distance from the average of the three peaks to the neckline. Project this distance downward from the neckline break point. Example: if peaks average $150 and neckline is at $143, the target is $136 ($143 - $7).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the highest peak defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The highest of the three peaks serves as the invalidation level. A close above this level negates the bearish pattern.
- **Partial target**: 50% of the full projected distance serves as a conservative initial target.
- **Time factor**: Triple Tops that take longer to form (> 40 bars) tend to produce larger projected moves due to greater distribution.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include all three peak prices, the neckline price level (connecting the two troughs), and the projected target price if the neckline is broken.
- **patternSummaries**: Describe the pattern status (first/second/third peak formed / completed / neckline broken), the price difference percentage among the three peaks, the spacing between them, and how it differs from Double Top or Head and Shoulders.
- **Volume context**: State whether volume behavior confirms the pattern (progressive decline across peaks, volume surge on neckline break). Note volume comparison between each successive peak.
- **Completion status**: Clearly indicate whether the pattern is still forming (which peak is in progress) or fully confirmed by a neckline break.
- **Target projection**: Calculate and state the measured move target using peak-to-neckline distance projected below the neckline.
