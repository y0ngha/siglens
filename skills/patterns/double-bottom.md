---
name: 이중바닥
description: 두 개의 저점이 거의 같은 가격 수준에서 형성되는 상승 반전 신호
type: pattern
category: reversal_bullish
pattern: double_bottom
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "넥라인"
gating:
  tier: gated
  signal_kind: event
  triggers: [double_bottom]
token_cost: 785
digest_hash: "092b5466"
---

## Detection Criteria

- Two distinct troughs must form at approximately the same price level, within 3% of each other.
- A clear peak (neckline) must exist between the two troughs, with a height of at least 3% from the trough average.
- The two troughs must be separated by a minimum of 10 bars to distinguish the pattern from short-term noise.
- The closer the two trough prices are to each other, the higher the pattern reliability.
- The pattern is confirmed when price closes above the neckline (the peak between the two troughs).
- Engine rule: Pivots are confirmed swings: a swing counts once price reverses 1.5 ATR from it, measured with the ATR of the bar that confirms it, so a confirmed pivot never moves when bars are added, and no bar is both a swing high and a swing low. The troughs are the last two confirmed swing lows (a trough still in progress is not one); their prices differ by no more than min(1 ATR, 3% of their average price), they are at least 10 bars apart, and no bar between the first and the last goes beyond the matched troughs by more than 0.25 ATR. The neckline is the highest confirmed peak between them, and it must sit in the middle half of the span (at least 25% of the first-to-last distance from either trough) — a peak right after the first trough followed by a slow climb to the second is a leg, not two bottoms. The pattern height (average trough to neckline) must be at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars). If the peaks between the run of equal lows clearly fall toward them (the line through the first and last of them moves down 1.5 ATR or more) it is a descending triangle, not a double bottom. The last trough must be no more than max(20 bars, half the first-to-last span) before the last bar — an older pattern is not listed.

## Confidence Weight Rationale

confidence_weight: 0.7 — Bulkowski (thepatternsite.com/aadb.html, aedb.html, eadb.html, eedb.html, bull market) splits double bottoms into four Adam/Eve variants: break-even failure rates 16% (Adam & Adam), 12% (Adam & Eve), 12% (Eve & Adam), 12% (Eve & Eve); performance ranks 26, 17, 20, 5 of 39; 65–73% meet the price target. Weight: median variant failure rate 12% → 0.7. Its two-trough structure is simpler than Head and Shoulders, so volume confirmation and a decisive neckline close matter.

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

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the neckline price (the highest confirmed peak between the troughs; both troughs must be confirmed swing lows, so a second trough still in progress is not a listed candidate); `extremeLevel` = the average of the two trough prices; `direction` = 'up'; `invalidationLevel` = the lower of the two troughs (a close below it negates the pattern). Copy these values from `## Chart Pattern Candidates (computed)` only when this pattern instance is listed there (set its Candidate id as candidateId); when it is not listed, you may still name and describe the pattern, but `geometry` is null and candidateId is empty — only listed patterns carry levels and targets. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The lower of the two troughs serves as the invalidation level. A close below this level negates the bullish pattern.
- **Time symmetry**: Patterns where the two troughs are roughly equidistant in time from the neckline tend to be more reliable.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include both trough prices and the neckline price level.
- **patternSummaries**: Describe the pattern status (first trough formed / second trough in progress / completed / neckline broken), the price difference percentage between the two troughs, and spacing between them.
- **Volume context**: State whether volume behavior confirms the pattern (increasing volume on second trough, volume increase on neckline break).
- **Completion status**: Clearly indicate whether the pattern is still forming (second trough in progress) or fully confirmed by a neckline break.
- **geometry**: For a listed pattern instance (with a Candidate id), fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. For an unlisted pattern, `geometry` is null and candidateId is empty. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Double Bottom (bullish reversal)

Geometry:
- Two distinct troughs at ~same price, within 3% of each other (closer = more reliable).
- Clear peak (neckline) between troughs, height ≥3% from trough average.
- Troughs separated by minimum 10 bars.
- Confirmed: close ABOVE neckline (the peak between troughs).
- Engine: pivots = confirmed swings (1.5 ATR reversal measured with the confirming bar's ATR; fixed once confirmed; one pivot per bar); last two confirmed swing lows; price difference ≤ min(1 ATR, 3% of average price); troughs ≥10 bars apart; no bar between them beyond the matched troughs by >0.25 ATR; neckline = highest confirmed peak between them, in the middle half of the span (≥25% of the distance from either trough); height ≥2.5 ATR and the price-share minimum; rejected if the peaks under the equal lows clearly fall (≥1.5 ATR, = triangle); last trough ≤ max(20 bars, half the span) before the last bar.

Confidence (weight 0.7) — Bulkowski Adam/Eve double-bottom pages: failure 12–16% (median 12%), ranks 5–26 of 39, 65–73% meet target.
- Increase: trough prices within 1%, volume increase on second trough, neckline break with volume surge, spacing > 15 bars.
- Decrease: troughs differ > 2.5%, no volume divergence, shallow peak (< 3% from trough avg), pattern in narrow range.

Signals: second-trough volume HIGHER than first (accumulation); neckline break with volume; RSI higher low on second trough = bullish divergence; successful retest holds above neckline.

False positives / invalidation:
- Strong downtrend: two troughs may be a pause before further decline — check trend context.
- Troughs < 10 bars apart = intraday noise.
- No volume divergence (2nd trough equal/lower volume) = weak.
- Peak < 3% of trough price = invalid neckline.
- Intraday wick above neckline without close = not confirmed.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the neckline price (the highest confirmed peak between the extremes), extremeLevel: the average of the two trough prices, direction: 'up', invalidationLevel: the lower of the two troughs (a close below it negates the pattern) }. Copy from `## Chart Pattern Candidates (computed)` only when this instance is listed there (with its Candidate id); when not listed, the pattern may be described but `geometry` is null and candidateId empty. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: both trough prices, neckline price.
- patternSummaries: status (first trough formed / second trough in progress / completed / neckline broken), price difference % between troughs, spacing.
- Volume context: increasing on second trough, increase on neckline break.
- Completion status: forming (second trough in progress) vs confirmed (neckline break).
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R; only for a listed instance, else `geometry` null and candidateId empty.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
