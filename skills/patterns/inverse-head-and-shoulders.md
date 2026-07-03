---
name: 역헤드앤숄더
description: 세 개의 저점 중 가운데가 가장 낮은 형태로 상승 반전 신호
type: pattern
category: reversal_bullish
pattern: inverse_head_and_shoulders
indicators: []
confidence_weight: 0.8
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "넥라인"
gating:
  tier: always_on
token_cost: 674
digest_hash: "5c002a4f"
---

## Detection Criteria

- Three distinct troughs must be present: left shoulder, head (center), and right shoulder.
- The head must be the lowest trough, clearly below both shoulders.
- Left and right shoulder lows must be within 5% of each other in price.
- The neckline is drawn by connecting the two peaks between the three troughs.
- A neckline slope closer to horizontal increases pattern reliability.
- The pattern requires a minimum of 20 bars from left shoulder to right shoulder for structural validity.
- The distance from neckline to head must be at least 3% of the neckline price to qualify as a meaningful pattern.

## Confidence Weight Rationale

confidence_weight: 0.8 — Inverse Head and Shoulders is the mirror image of the standard H&S pattern and carries the same high reliability as a bullish reversal signal. Its three-trough structure with a defined neckline provides clear, objective detection criteria. Academic and practical evidence consistently supports its effectiveness when volume confirmation is present.

Factors that increase confidence:
- Near-horizontal neckline (slope < 2%)
- Symmetric shoulders (price difference < 3%)
- Volume confirmation on neckline break
- Pattern duration > 30 bars

Factors that decrease confidence:
- Steeply sloped neckline (slope > 5%)
- Highly asymmetric shoulders (price difference > 5%)
- No volume increase on right shoulder
- Pattern forming within a strong downtrend with no prior support

## Key Signals

- **Right shoulder volume increase**: Volume during right shoulder formation should be higher than during the head formation. This indicates growing buying interest and accumulation.
- **Neckline break with volume surge**: A decisive close above the neckline accompanied by above-average volume confirms the pattern. A break on low volume may indicate a false breakout.
- **Retest of neckline as support**: After the initial break, price often retests the neckline from above. Holding above the neckline reinforces the bullish signal.
- **Momentum divergence**: RSI or MACD showing bullish divergence (higher lows on the indicator while price makes the head low) strengthens the pattern signal.

## False Positive Conditions

- **Downtrend continuation bounce**: In a strong downtrend, a temporary three-trough bounce may resemble inverse H&S but is merely a consolidation before further decline. Check if the broader trend context supports reversal.
- **Asymmetric shoulders exceeding 10%**: When shoulder depths differ by more than 10%, the pattern loses structural integrity and should not be classified as inverse H&S.
- **Insufficient depth**: If the neckline-to-head distance is less than 3% of the neckline price, the pattern is too shallow to produce a meaningful move.
- **Premature neckline break**: A brief intraday break above the neckline that immediately reverses (wick only, no close above) is not a confirmed break.
- **Declining volume throughout**: If volume continues to decline through the right shoulder and neckline break without any surge, the bullish signal lacks conviction.

## Entry/Exit Considerations

- **Target price calculation**: Measure the vertical distance from the neckline to the head. Project this distance upward from the neckline break point. Example: if neckline is at $100 and head is at $90, the target is $110 ($100 + $10).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the right shoulder low defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The right shoulder low serves as the invalidation level. A close below this level negates the bullish pattern.
- **Partial target**: A conservative first target is 50% of the full projected distance, where partial profit-taking is commonly observed.
- **Time factor**: Patterns that take longer to form (> 40 bars) tend to produce larger projected moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the neckline price level, head price, left shoulder price, and right shoulder price. If the neckline is broken, include the projected target price.
- **patternSummaries**: Describe the pattern status (forming / right shoulder in progress / completed / neckline broken), the neckline slope direction, and shoulder symmetry assessment.
- **Volume context**: State whether volume behavior confirms or contradicts the pattern (increasing volume on right shoulder, volume surge on break).
- **Completion status**: Clearly indicate whether the pattern is still forming or fully confirmed by a neckline break with a closing price above.
- **Target projection**: Calculate and state the measured move target using neckline-to-head distance projected above the neckline.

<!-- PROMPT_DIGEST:START -->
역헤드앤숄더 (Inverse Head & Shoulders) — bullish reversal, confidence_weight 0.8. Three troughs: left shoulder, head (center), right shoulder.

### Detection
- Head must be lowest trough, clearly below both shoulders.
- Left & right shoulder lows within 5% of each other in price.
- Neckline = line connecting the two peaks between the three troughs.
- Near-horizontal neckline → higher reliability.
- Minimum 20 bars from left to right shoulder.
- Neckline-to-head distance must be ≥3% of neckline price (else too shallow, reject).

### Grading
- Increase: near-horizontal neckline (slope <2%); symmetric shoulders (price diff <3%); volume confirmation on neckline break; duration >30 bars.
- Decrease: steep neckline (slope >5%); asymmetric shoulders (price diff >5%); no volume increase on right shoulder; forming in strong downtrend with no prior support.
- Right shoulder volume should be HIGHER than during the head (growing buying interest / accumulation).
- Bullish momentum divergence (RSI/MACD higher lows vs price head low) strengthens signal.

### Confirmation / invalidation
- Confirmed by decisive CLOSE above neckline on above-average volume. Low-volume break may be false.
- Retest: price often retests neckline from above; holding above it reinforces bullish signal.
- Invalidation: close BELOW right shoulder low negates the pattern (stop reference).
- Wick-only intraday break with no close above = not confirmed.

### False positives (do NOT classify as inverse H&S)
- Shoulder depths differ by >10% (loses structural integrity).
- Neckline-to-head <3% of neckline price (too shallow).
- Three-trough bounce within a strong downtrend that is mere consolidation before further decline.
- Volume keeps declining through right shoulder & break with no surge (lacks conviction).

### Target (measured move)
- Vertical distance neckline→head, projected UP from neckline break point. E.g. neckline $100, head $90 → target $110 ($100+$10).
- Conservative first target = 50% of full projected distance.
- Risk/reward = (price→target) vs (price→right shoulder low); ≥2:1 favorable.
- Patterns >40 bars tend to produce larger moves.

### Output
- keyPrices: neckline, head, left shoulder, right shoulder prices; projected target if neckline broken.
- patternSummaries: status (forming / right shoulder in progress / completed / neckline broken), neckline slope direction, shoulder symmetry.
- Volume context: whether volume confirms (increasing right-shoulder volume, break surge) or contradicts.
- Completion status: forming vs confirmed by close above neckline.
- Target projection: measured-move target (neckline-to-head projected above neckline).
- trend: bullish when pattern confirmed.
<!-- PROMPT_DIGEST:END -->
