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
gating:
  tier: gated
  signal_kind: event
  triggers: [head_and_shoulders]
token_cost: 699
digest_hash: "58ca90c1"
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

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the neckline price at the break point; `extremeLevel` = the head price; `direction` = 'down'; `invalidationLevel` = the right shoulder high (a close above it negates the pattern). When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The right shoulder high serves as the invalidation level. A close above this level negates the bearish pattern.
- **Time factor**: Patterns that take longer to form (> 40 bars) tend to produce larger projected moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the neckline price level, head price, left shoulder price, and right shoulder price.
- **patternSummaries**: Describe the pattern status (forming / right shoulder in progress / completed / neckline broken), the neckline slope direction, and shoulder symmetry assessment.
- **Volume context**: State whether volume behavior confirms or contradicts the pattern (declining volume on right shoulder, volume surge on break).
- **Completion status**: Clearly indicate whether the pattern is still forming or fully confirmed by a neckline break with a closing price below.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
헤드앤숄더 (Head & Shoulders) — bearish reversal, confidence_weight 0.8. Three peaks: left shoulder, head (center), right shoulder.

### Detection
- Head must be highest peak, clearly above both shoulders.
- Left & right shoulder highs within 5% of each other in price.
- Neckline = line connecting the two troughs between the three peaks.
- Near-horizontal neckline → higher reliability.
- Minimum 20 bars from left to right shoulder.
- Head-to-neckline distance must be ≥3% of neckline price (else too shallow, reject).

### Grading
- Increase: near-horizontal neckline (slope <2%); symmetric shoulders (price diff <3%); volume confirmation on neckline break; duration >30 bars.
- Decrease: steep neckline (slope >5%); asymmetric shoulders (price diff >5%); no volume decline on right shoulder; forming in strong uptrend with no prior resistance.
- Right shoulder volume should be noticeably LOWER than left shoulder and head (weakening buying).
- Bearish momentum divergence (RSI/MACD lower highs vs price head) strengthens signal.

### Confirmation / invalidation
- Confirmed by decisive CLOSE below neckline on above-average volume. Low-volume break may be false.
- Retest: price often retests neckline from below; failure to reclaim it reinforces bearish signal.
- Invalidation: close ABOVE right shoulder high negates the pattern (stop reference).
- Wick-only intraday break with no close below = not confirmed.

### False positives (do NOT classify as H&S)
- Shoulder heights differ by >10% (loses structural integrity).
- Head-to-neckline <3% of neckline price (too shallow).
- Three-peak pullback within a strong uptrend that is mere consolidation.
- Entire pattern on declining volume with no break-volume surge.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the neckline price at the break point, extremeLevel: the head price, direction: 'down', invalidationLevel: the right shoulder high (a close above it negates the pattern) }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: neckline, head, left shoulder, right shoulder prices.
- patternSummaries: status (forming / right shoulder in progress / completed / neckline broken), neckline slope direction, shoulder symmetry.
- Volume context: whether volume confirms (declining right-shoulder volume, break surge) or contradicts.
- Completion status: forming vs confirmed by close below neckline.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- trend: bearish when pattern confirmed.
<!-- PROMPT_DIGEST:END -->
