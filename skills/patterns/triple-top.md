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
gating:
  tier: gated
  signal_kind: event
  triggers: [triple_top]
token_cost: 721
digest_hash: "1cad7207"
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

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the neckline price; `extremeLevel` = the average of the three peak prices; `direction` = 'down'; `invalidationLevel` = the highest of the three peaks (a close above it negates the pattern). When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The highest of the three peaks serves as the invalidation level. A close above this level negates the bearish pattern.
- **Time factor**: Triple Tops that take longer to form (> 40 bars) tend to produce larger projected moves due to greater distribution.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include all three peak prices and the neckline price level (connecting the two troughs).
- **patternSummaries**: Describe the pattern status (first/second/third peak formed / completed / neckline broken), the price difference percentage among the three peaks, the spacing between them, and how it differs from Double Top or Head and Shoulders.
- **Volume context**: State whether volume behavior confirms the pattern (progressive decline across peaks, volume surge on neckline break). Note volume comparison between each successive peak.
- **Completion status**: Clearly indicate whether the pattern is still forming (which peak is in progress) or fully confirmed by a neckline break.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
삼중천장 (Triple Top) — bearish reversal, confidence_weight 0.8 (Bulkowski ~88% success). Three peaks at ~equal resistance; neckline = line connecting the two troughs between peaks.

### Detection
- Three distinct peaks at ~same price, within 2–3% of each other.
- Two clear troughs between the peaks form the neckline.
- Each peak separated by meaningful retracement ≥3% (peak average → neckline).
- Three peaks span minimum 20 bars (needs more time than Double Top).
- Closer peak prices → higher reliability.
- Confirmed when price CLOSES below neckline.

### Grading
- Increase: all three peaks within 1.5% of each other; progressive volume decline on each successive peak; neckline break with volume surge; duration >30 bars; clear volume decline on third peak vs first.
- Decrease: peaks differ >3%; no progressive volume decline; shallow troughs (<3% from peak average); choppy/directionless market; third peak significantly lower than first two (gradual downtrend instead).
- Ideal: volume decreases on each successive peak; third peak lowest volume (exhausted buying after three failed resistance tests).
- Third peak weakness (shorter time at high, quicker rejection) reinforces pattern.
- Failed retest that cannot reclaim neckline strengthens bearish case.

### False positives
- Powerful uptrend: three similar peaks may be extended consolidation (rectangle), not reversal.
- Volume consistent/increasing across peaks → buying not weakened, may resolve up as rectangle breakout.
- Peaks form too quickly (<20 bars total) → likely noise.
- Each peak notably higher than previous (>3%) → rising channel, not Triple Top.
- Intraday wick below neckline without closing break = not confirmed.
- Middle peak significantly HIGHER than the other two → Head & Shoulders, not Triple Top.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the neckline price, extremeLevel: the average of the three peak prices, direction: 'down', invalidationLevel: the highest of the three peaks (a close above it negates the pattern) }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: all three peak prices, neckline price.
- patternSummaries: status (first/second/third peak formed / completed / neckline broken); price-diff % among peaks; spacing; how it differs from Double Top or Head & Shoulders.
- Volume context: progressive decline across peaks; surge on break; compare successive peaks.
- Completion status: forming (which peak) vs confirmed by neckline break.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- trend: bearish when confirmed.
<!-- PROMPT_DIGEST:END -->
