---
name: 이중바닥
description: 두 개의 저점이 거의 같은 가격 수준에서 형성되는 상승 반전 신호
type: pattern
category: reversal_bullish
pattern: double_bottom
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

- Two distinct troughs must form at approximately the same price level, within 3% of each other.
- A clear peak (neckline) must exist between the two troughs, with a height of at least 3% from the trough average.
- The two troughs must be separated by a minimum of 10 bars to distinguish the pattern from short-term noise.
- The closer the two trough prices are to each other, the higher the pattern reliability.
- The pattern is confirmed when price closes above the neckline (the peak between the two troughs).

## Confidence Weight Rationale

confidence_weight: 0.75 — Double Bottom is the bullish mirror of the Double Top pattern and carries the same confidence level. Its two-trough structure is simpler than the three-point Head and Shoulders, making it slightly more susceptible to false signals. However, with volume confirmation and a decisive neckline break, it is a well-established bullish reversal pattern.

Factors that increase confidence:
- Trough prices within 1% of each other
- Clear volume increase on second trough
- Neckline break with volume surge
- Sufficient spacing between troughs (> 15 bars)

Factors that decrease confidence:
- Trough prices differing by more than 2.5%
- No volume divergence between troughs
- Shallow peak between troughs (< 3% from trough average)
- Pattern forming in a narrow trading range

## Key Signals

- **Second trough volume increase**: Volume on the second trough should be higher than on the first trough, or show a notable uptick. This indicates accumulation and growing buying interest at the support level.
- **Neckline break with volume**: A close above the neckline accompanied by increased volume confirms the bullish reversal. Low-volume breaks are less reliable.
- **RSI divergence**: If RSI makes a higher low on the second trough while price reaches the same level, this bullish divergence reinforces the pattern.
- **Successful retest**: After the neckline break, a pullback that holds above the neckline level strengthens the bullish case.

## False Positive Conditions

- **Downtrend continuation**: In a strong downtrend, two troughs at similar levels may simply represent a pause before further decline. Examine the broader trend context.
- **Troughs too close together (< 10 bars)**: When troughs form within a very short timeframe, the pattern may just be intraday volatility rather than a structural reversal signal.
- **No volume divergence**: If the second trough shows equal or lower volume than the first, there is no evidence of accumulation and the reversal signal is weak.
- **Shallow peak**: If the peak between troughs is less than 3% of the trough price, there is insufficient buying pressure to constitute a valid neckline.
- **Premature neckline break**: An intraday wick above the neckline without a closing break is not confirmation.

## Entry/Exit Considerations

- **Target price calculation**: Measure the vertical distance from the neckline to the average of the two troughs. Project this distance upward from the neckline break point. Example: if troughs average $80 and neckline is at $85, the target is $90 ($85 + $5).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the second trough low defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The lower of the two troughs serves as the invalidation level. A close below this level negates the bullish pattern.
- **Partial target**: 50% of the full projected distance serves as a conservative initial target.
- **Time symmetry**: Patterns where the two troughs are roughly equidistant in time from the neckline tend to be more reliable.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include both trough prices, the neckline price level, and the projected target price if the neckline is broken.
- **patternSummaries**: Describe the pattern status (first trough formed / second trough in progress / completed / neckline broken), the price difference percentage between the two troughs, and spacing between them.
- **Volume context**: State whether volume behavior confirms the pattern (increasing volume on second trough, volume increase on neckline break).
- **Completion status**: Clearly indicate whether the pattern is still forming (second trough in progress) or fully confirmed by a neckline break.
- **Target projection**: Calculate and state the measured move target using neckline-to-trough distance projected above the neckline.
