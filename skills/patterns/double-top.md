---
name: 이중천장
description: 두 개의 고점이 거의 같은 가격 수준에서 형성되는 하락 반전 신호
type: pattern
category: reversal_bearish
pattern: double_top
indicators: []
confidence_weight: 0.75
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "넥라인"
---

## Detection Criteria

- Two distinct peaks must form at approximately the same price level, within 3% of each other.
- A clear trough (neckline) must exist between the two peaks, with a depth of at least 3% from the peak average.
- The two peaks must be separated by a minimum of 10 bars to distinguish the pattern from short-term noise.
- The closer the two peak prices are to each other, the higher the pattern reliability.
- The pattern is confirmed when price closes below the neckline (the trough between the two peaks).

## Confidence Weight Rationale

confidence_weight: 0.75 — Double Top is a well-recognized bearish reversal pattern, but its simpler two-peak structure compared to Head and Shoulders makes it slightly more prone to false positives. The absence of a third reference point (the head) means there is less structural confirmation. However, when accompanied by volume confirmation and a clear neckline break, it remains a reliable signal.

Factors that increase confidence:
- Peak prices within 1% of each other
- Clear volume decline on second peak
- Neckline break with volume surge
- Sufficient spacing between peaks (> 15 bars)

Factors that decrease confidence:
- Peak prices differing by more than 2.5%
- No volume divergence between peaks
- Shallow trough between peaks (< 3% from peak average)
- Pattern forming in a narrow trading range

## Key Signals

- **Second peak volume decline**: Volume on the second peak should be lower than on the first peak. This indicates weakening buying pressure and inability to sustain higher prices.
- **Neckline break with volume**: A close below the neckline accompanied by increased volume confirms the bearish reversal. Low-volume breaks are less reliable.
- **RSI divergence**: If RSI makes a lower high on the second peak while price reaches the same level, this bearish divergence reinforces the pattern.
- **Failed retest**: After the neckline break, a retest that fails to reclaim the neckline level strengthens the bearish case.

## False Positive Conditions

- **Strong uptrend consolidation**: In a powerful uptrend, two peaks at similar levels may simply represent consolidation before continuation higher. Examine the broader trend context.
- **Peaks too close together (< 10 bars)**: When peaks form within a very short timeframe, the pattern may just be intraday volatility rather than a structural reversal signal.
- **No volume divergence**: If the second peak shows equal or higher volume than the first, buying pressure has not weakened and the pattern is less likely to result in reversal.
- **Shallow trough**: If the trough between peaks is less than 3% of the peak price, there is insufficient selling pressure to constitute a valid neckline.
- **Premature neckline break**: An intraday wick below the neckline without a closing break is not confirmation.

## Entry/Exit Considerations

- **Target price calculation**: Measure the vertical distance from the average of the two peaks to the neckline. Project this distance downward from the neckline break point. Example: if peaks average $120 and neckline is at $115, the target is $110 ($115 - $5).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the second peak high defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The higher of the two peaks serves as the invalidation level. A close above this level negates the bearish pattern.
- **Partial target**: 50% of the full projected distance serves as a conservative initial target.
- **Time symmetry**: Patterns where the two peaks are roughly equidistant in time from the neckline tend to be more reliable.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include both peak prices, the neckline price level, and the projected target price if the neckline is broken.
- **patternSummaries**: Describe the pattern status (first peak formed / second peak in progress / completed / neckline broken), the price difference percentage between the two peaks, and spacing between them.
- **Volume context**: State whether volume behavior confirms the pattern (declining volume on second peak, volume increase on neckline break).
- **Completion status**: Clearly indicate whether the pattern is still forming (second peak in progress) or fully confirmed by a neckline break.
- **Target projection**: Calculate and state the measured move target using peak-to-neckline distance projected below the neckline.
