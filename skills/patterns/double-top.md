---
name: 이중천장
description: 두 개의 고점이 거의 같은 가격 수준에서 형성되는 하락 반전 신호
type: pattern
category: reversal_bearish
pattern: double_top
indicators: []
confidence_weight: 0.6
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "넥라인"
gating:
  tier: gated
  signal_kind: event
  triggers: [double_top]
token_cost: 779
digest_hash: "4df9ba68"
---

## Detection Criteria

- Two distinct peaks must form at approximately the same price level, within 3% of each other.
- A clear trough (neckline) must exist between the two peaks, with a depth of at least 3% from the peak average.
- The two peaks must be separated by a minimum of 10 bars to distinguish the pattern from short-term noise.
- The closer the two peak prices are to each other, the higher the pattern reliability.
- The pattern is confirmed when price closes below the neckline (the trough between the two peaks).
- Engine rule: Pivots are confirmed swings: a swing counts once price reverses 1.5 ATR from it, measured with the ATR of the bar that confirms it, so a confirmed pivot never moves when bars are added, and no bar is both a swing high and a swing low. The peaks are the last two confirmed swing highs (a peak still in progress is not one); their prices differ by no more than min(1 ATR, 3% of their average price), they are at least 10 bars apart, and no bar between the first and the last goes beyond the matched peaks by more than 0.25 ATR. The neckline is the lowest confirmed trough between them, and it must sit in the middle half of the span (at least 25% of the first-to-last distance from either peak) — a trough right after the first peak followed by a slow climb to the second is a leg, not two tops. The pattern height (average peak to neckline) must be at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars). If the troughs between the run of equal highs clearly rise toward them (the line through the first and last of them moves up 1.5 ATR or more) it is an ascending triangle, not a double top. The last peak must be no more than max(20 bars, half the first-to-last span) before the last bar — an older pattern is not listed.

## Confidence Weight Rationale

confidence_weight: 0.6 — Bulkowski (thepatternsite.com/aadt.html, aedt.html, eadt.html, eedt.html, bull market) splits double tops into four Adam/Eve variants: break-even failure rates 25% (Adam & Adam), 21% (Adam & Eve), 21% (Eve & Adam), 20% (Eve & Eve); performance ranks 19, 10, 16, 12 of 36; 43–64% meet the price target. Weight: median variant failure rate 21% → 0.6. The simpler two-peak structure (no head as a third reference point) makes it more prone to false positives than Head and Shoulders, so volume confirmation and a clear neckline close matter.

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

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the neckline price (the lowest confirmed trough between the peaks; both peaks must be confirmed swing highs, so a second peak still in progress is not a listed candidate); `extremeLevel` = the average of the two peak prices; `direction` = 'down'; `invalidationLevel` = the higher of the two peaks (a close above it negates the pattern). Copy these values from `## Chart Pattern Candidates (computed)` only when this pattern instance is listed there (set its Candidate id as candidateId); when it is not listed, you may still name and describe the pattern, but `geometry` is null and candidateId is empty — only listed patterns carry levels and targets. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The higher of the two peaks serves as the invalidation level. A close above this level negates the bearish pattern.
- **Time symmetry**: Patterns where the two peaks are roughly equidistant in time from the neckline tend to be more reliable.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include both peak prices and the neckline price level.
- **patternSummaries**: Describe the pattern status (first peak formed / second peak in progress / completed / neckline broken), the price difference percentage between the two peaks, and spacing between them.
- **Volume context**: State whether volume behavior confirms the pattern (declining volume on second peak, volume increase on neckline break).
- **Completion status**: Clearly indicate whether the pattern is still forming (second peak in progress) or fully confirmed by a neckline break.
- **geometry**: For a listed pattern instance (with a Candidate id), fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. For an unlisted pattern, `geometry` is null and candidateId is empty. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Double Top (bearish reversal)

Geometry:
- Two distinct peaks at ~same price, within 3% of each other (closer = more reliable).
- Clear trough (neckline) between peaks, depth ≥3% from peak average.
- Peaks separated by minimum 10 bars.
- Confirmed: close BELOW neckline (the trough between peaks).
- Engine: pivots = confirmed swings (1.5 ATR reversal measured with the confirming bar's ATR; fixed once confirmed; one pivot per bar); last two confirmed swing highs; price difference ≤ min(1 ATR, 3% of average price); peaks ≥10 bars apart; no bar between them beyond the matched peaks by >0.25 ATR; neckline = lowest confirmed trough between them, in the middle half of the span (≥25% of the distance from either peak); height ≥2.5 ATR and the price-share minimum; rejected if the troughs under the equal highs clearly rise (≥1.5 ATR, = triangle); last peak ≤ max(20 bars, half the span) before the last bar.

Confidence (weight 0.6) — Bulkowski Adam/Eve double-top pages: failure 20–25% (median 21%), ranks 10–19 of 36, 43–64% meet target.
- Increase: peak prices within 1%, volume decline on second peak, neckline break with volume surge, spacing > 15 bars.
- Decrease: peaks differ > 2.5%, no volume divergence, shallow trough (< 3% from peak avg), pattern in narrow range.

Signals: second-peak volume LOWER than first (weakening buying); neckline break with volume; RSI lower high on second peak = bearish divergence; failed retest that can't reclaim neckline.

False positives / invalidation:
- Strong uptrend: two peaks may be consolidation before continuation — check trend context.
- Peaks < 10 bars apart = intraday noise.
- No volume divergence (2nd peak equal/higher volume) = less likely reversal.
- Trough < 3% of peak price = invalid neckline.
- Intraday wick below neckline without close = not confirmed.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the neckline price (the lowest confirmed trough between the extremes), extremeLevel: the average of the two peak prices, direction: 'down', invalidationLevel: the higher of the two peaks (a close above it negates the pattern) }. Copy from `## Chart Pattern Candidates (computed)` only when this instance is listed there (with its Candidate id); when not listed, the pattern may be described but `geometry` is null and candidateId empty. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: both peak prices, neckline price.
- patternSummaries: status (first peak formed / second peak in progress / completed / neckline broken), price difference % between peaks, spacing.
- Volume context: declining on second peak, increase on neckline break.
- Completion status: forming (second peak in progress) vs confirmed (neckline break).
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R; only for a listed instance, else `geometry` null and candidateId empty.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
