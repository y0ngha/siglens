---
name: 역헤드앤숄더
description: 세 개의 저점 중 가운데가 가장 낮은 형태로 상승 반전 신호
type: pattern
category: reversal_bullish
pattern: inverse_head_and_shoulders
indicators: []
confidence_weight: 0.75
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "넥라인"
gating:
  tier: gated
  signal_kind: event
  triggers: [inverse_head_and_shoulders]
token_cost: 860
digest_hash: "c8f269a4"
---

## Detection Criteria

- Three distinct troughs must be present: left shoulder, head (center), and right shoulder.
- The head must be the lowest trough, clearly below both shoulders.
- Left and right shoulder lows must be within 5% of each other in price.
- The neckline is drawn by connecting the two peaks between the three troughs.
- A neckline slope closer to horizontal increases pattern reliability.
- The pattern requires a minimum of 20 bars from left shoulder to right shoulder for structural validity.
- The distance from neckline to head must be at least 3% of the neckline price to qualify as a meaningful pattern.
- Engine rule: five consecutive confirmed swing pivots (shoulder low, trough, head low, trough, shoulder low) with the head clearing both shoulders by at least 1 ATR; the neckline is the line through the two peaks (containing the bars between them within 0.25 ATR) and may slope; the pattern height is measured from the neckline at the head's bar and must be at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars). The right shoulder may be up to 2 confirmed pivots old, so the pattern stays listed while price works through the neckline.

## Confidence Weight Rationale

confidence_weight: 0.75 — Bulkowski (thepatternsite.com/hsb.html, bull market): performance rank 13 of 39, break-even failure rate 11%, 71% meet the price target. Weight: failure 11–20% → 0.7, +0.05 for independent academic support (Savin, Weller & Zvingelis 2007, H&S-conditioned strategy). Its three-trough structure with a defined neckline provides clear, objective detection criteria; volume confirmation on the neckline break still matters.

Factors that increase confidence:
- Near-horizontal neckline (slope < 2%)
- Symmetric shoulders (price difference < 3%)
- Volume confirmation on neckline break
- Pattern duration > 30 bars

Factors that decrease confidence:
- Steeply sloped neckline (slope > 5%)
- Highly asymmetric shoulders (price difference > 5%)
- Pattern forming within a strong downtrend with no prior support

## Key Signals

- **Right shoulder volume**: Bulkowski (thepatternsite.com/hsb.html) finds volume "highest on the left shoulder or head, diminished on the right shoulder" and trending downward 65% of the time — a quiet right shoulder is normal, not a warning. The buying confirmation to look for is the volume surge on the neckline break.
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

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the sloped neckline's value at the break bar (the first close above it; the last bar while it has not broken) — the neckline is a line through the two peaks, not necessarily a horizontal level; `extremeLevel` = the breakout level minus the pattern height (the head's distance from the neckline measured at the head's own bar — equal to the head price only for a flat neckline); `direction` = 'up'; `invalidationLevel` = the right shoulder low (a close below it negates the pattern). When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The right shoulder low serves as the invalidation level. A close below this level negates the bullish pattern.
- **Time factor**: Patterns that take longer to form (> 40 bars) tend to produce larger projected moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the neckline price level, head price, left shoulder price, and right shoulder price.
- **patternSummaries**: Describe the pattern status (forming / right shoulder in progress / completed / neckline broken), the neckline slope direction, and shoulder symmetry assessment.
- **Volume context**: State whether volume behavior confirms or contradicts the pattern (volume highest on the left shoulder or head and diminished on the right shoulder, volume surge on break).
- **Completion status**: Clearly indicate whether the pattern is still forming or fully confirmed by a neckline break with a closing price above.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
역헤드앤숄더 (Inverse Head & Shoulders) — bullish reversal, confidence_weight 0.75 (Bulkowski hsb.html: rank 13/39, failure 11%, 71% meet target; +0.05 Savin et al. 2007). Three troughs: left shoulder, head (center), right shoulder.

### Detection
- Head must be lowest trough, clearly below both shoulders.
- Left & right shoulder lows within 5% of each other in price.
- Neckline = line connecting the two peaks between the three troughs.
- Near-horizontal neckline → higher reliability.
- Minimum 20 bars from left to right shoulder.
- Neckline-to-head distance must be ≥3% of neckline price (else too shallow, reject).
- Engine: five confirmed swing pivots (shoulder, peak, head, peak, shoulder), head clears both shoulders by ≥1 ATR; sloped neckline through the two peaks; height measured from the neckline at the head, ≥2.5 ATR and the price-share minimum; right shoulder may be up to 2 confirmed pivots old.

### Grading
- Increase: near-horizontal neckline (slope <2%); symmetric shoulders (price diff <3%); volume confirmation on neckline break; duration >30 bars.
- Decrease: steep neckline (slope >5%); asymmetric shoulders (price diff >5%); forming in strong downtrend with no prior support.
- Volume: typically highest on left shoulder or head, diminished on right shoulder (Bulkowski hsb.html; trends down 65%) — quiet right shoulder is normal; the confirmation is the break-volume surge.
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

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the sloped neckline's value at the break bar (the last bar while unbroken), extremeLevel: breakout minus the pattern height (the head's distance from the neckline at the head's bar), direction: 'up', invalidationLevel: the right shoulder low (a close below it negates the pattern) }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: neckline, head, left shoulder, right shoulder prices.
- patternSummaries: status (forming / right shoulder in progress / completed / neckline broken), neckline slope direction, shoulder symmetry.
- Volume context: whether volume confirms (highest on left shoulder/head, diminished right shoulder; break surge) or contradicts.
- Completion status: forming vs confirmed by close above neckline.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- trend: bullish when pattern confirmed.
<!-- PROMPT_DIGEST:END -->
