---
name: 헤드앤숄더
description: 세 개의 고점 중 가운데가 가장 높은 형태로 하락 반전 신호
type: pattern
category: reversal_bearish
pattern: head_and_shoulders
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

- Three distinct peaks must be present: left shoulder, head (center), and right shoulder.
- The head must be the highest peak, clearly exceeding both shoulders.
- Left and right shoulder highs must be within 5% of each other in price.
- The neckline is drawn by connecting the two troughs between the three peaks.
- A neckline slope closer to horizontal increases pattern reliability.
- The pattern requires a minimum of 20 bars from left shoulder to right shoulder for structural validity.
- The distance from head to neckline must be at least 3% of the neckline price to qualify as a meaningful pattern.

## Confidence Weight Rationale

confidence_weight: 0.8 — Head and Shoulders is the most academically and practically validated reversal pattern in technical analysis. Its three-peak structure with a defined neckline provides clear, objective detection criteria. The high confidence weight reflects decades of backtesting evidence showing reliable bearish reversal signals when the pattern completes with volume confirmation.

Factors that increase confidence:
- Near-horizontal neckline (slope < 2%)
- Symmetric shoulders (price difference < 3%)
- Volume confirmation on neckline break
- Pattern duration > 30 bars

Factors that decrease confidence:
- Steeply sloped neckline (slope > 5%)
- Highly asymmetric shoulders (price difference > 5%)
- No volume decline on right shoulder
- Pattern forming within a strong uptrend with no prior resistance

## Key Signals

- **Right shoulder volume decline**: Volume during right shoulder formation should be noticeably lower than during left shoulder and head formation. This indicates weakening buying pressure.
- **Neckline break with volume surge**: A decisive close below the neckline accompanied by above-average volume confirms the pattern. A break on low volume may indicate a false breakdown.
- **Retest of neckline as resistance**: After the initial break, price often retests the neckline from below. Failure to reclaim the neckline reinforces the bearish signal.
- **Momentum divergence**: RSI or MACD showing bearish divergence (lower highs on the indicator while price makes the head) strengthens the pattern signal.

## False Positive Conditions

- **Trending market pullback**: In a strong uptrend, a temporary three-peak pullback may resemble H&S but is merely a consolidation. Check if the broader trend context supports reversal.
- **Asymmetric shoulders exceeding 10%**: When shoulder heights differ by more than 10%, the pattern loses structural integrity and should not be classified as H&S.
- **Insufficient depth**: If the head-to-neckline distance is less than 3% of the neckline price, the pattern is too shallow to produce a meaningful move.
- **Premature neckline break**: A brief intraday break below the neckline that immediately reverses (wick only, no close below) is not a confirmed break.
- **Low-volume pattern formation**: If the entire pattern forms on declining volume without a volume surge on the neckline break, the signal is unreliable.

## Entry/Exit Considerations

- **Target price calculation**: Measure the vertical distance from the head to the neckline. Project this distance downward from the neckline break point. Example: if head is at $150 and neckline at $140, the target is $130 ($140 - $10).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the right shoulder high defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The right shoulder high serves as the invalidation level. A close above this level negates the bearish pattern.
- **Partial target**: A conservative first target is 50% of the full projected distance, where partial profit-taking is commonly observed.
- **Time factor**: Patterns that take longer to form (> 40 bars) tend to produce larger projected moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the neckline price level, head price, left shoulder price, and right shoulder price. If the neckline is broken, include the projected target price.
- **patternSummaries**: Describe the pattern status (forming / right shoulder in progress / completed / neckline broken), the neckline slope direction, and shoulder symmetry assessment.
- **Volume context**: State whether volume behavior confirms or contradicts the pattern (declining volume on right shoulder, volume surge on break).
- **Completion status**: Clearly indicate whether the pattern is still forming or fully confirmed by a neckline break with a closing price below.
- **Target projection**: Calculate and state the measured move target using head-to-neckline distance projected below the neckline.
