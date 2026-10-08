---
name: 삼중바닥
description: 세 개의 저점이 거의 같은 가격 수준에서 형성되는 상승 반전 신호
type: pattern
category: reversal_bullish
pattern: triple_bottom
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
  triggers: [triple_bottom]
token_cost: 909
digest_hash: "b920f76a"
---

## Detection Criteria

- Three distinct troughs must form at approximately the same price level, within 2-3% of each other.
- Two clear peaks must exist between the three troughs, forming a neckline when connected.
- Each trough must be separated by a meaningful rally (at least 3% from the trough average to the neckline).
- The three troughs must span a minimum of 20 bars to ensure structural validity — Triple Bottom requires more time to form than Double Bottom.
- The closer the three trough prices are to each other, the higher the pattern reliability.
- The pattern is confirmed when price closes above the neckline (the line connecting the two peaks between troughs).
- Engine rule: Pivots are confirmed swings: a swing counts once price reverses 1.5 ATR from it, measured with the ATR of the bar that confirms it, so a confirmed pivot never moves when bars are added, and no bar is both a swing high and a swing low. The troughs are the last three confirmed swing lows (a trough still in progress is not one); the spread between the highest and lowest of the three is at most min(1 ATR, 3% of their average price), each consecutive pair is at least 10 bars apart, and no bar between the first and the last goes beyond the matched troughs by more than 0.25 ATR. The neckline is the highest confirmed peak between them. The pattern height (average trough to neckline) must be at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars). If the peaks between the run of equal lows clearly fall toward them (the line through the first and last of them moves down 1.5 ATR or more) it is a descending triangle, not a triple bottom. The last trough must be no more than max(20 bars, half the first-to-last span) before the last bar — an older pattern is not listed.

## Confidence Weight Rationale

confidence_weight: 0.7 — Bulkowski (thepatternsite.com/tb.html, bull market): performance rank 12 of 39, break-even failure rate 13%, 74% meet the price target. Weight: failure 11–20% → 0.7. It measures clearly better than Triple Top (tt.html: failure 25%); three successful defenses of support demonstrate persistent accumulation, but the pattern is rare and volume at bottoms is less distinct.

Factors that increase confidence:
- All three trough prices within 1.5% of each other
- Volume decreasing on the third trough compared to the first
- Volume surge on neckline break
- Pattern duration > 30 bars
- RSI or MACD showing bullish divergence across the three troughs

Factors that decrease confidence:
- Trough prices differing by more than 3%
- No volume pattern across troughs
- Shallow peaks between troughs (< 3% from trough average)
- Pattern forming in a strong downtrend with no sign of stabilization
- Third trough notably deeper than the first two (may indicate accelerating downtrend)

## Key Signals

- **Volume decline on third trough**: Ideally, volume decreases on each successive trough, indicating selling pressure is exhausting. The third trough with the lowest volume shows sellers have been absorbed.
- **Neckline break with volume surge**: A close above the neckline accompanied by increased volume confirms the bullish reversal. The neckline connects the two peaks between the three troughs.
- **RSI divergence**: If RSI makes progressively higher lows across the three troughs while price remains at similar levels, this triple bullish divergence is a powerful confirmation of accumulation.
- **Successful retest**: After the neckline break, a pullback that holds above the neckline level strengthens the bullish case and provides a second entry reference point.
- **Third trough strength**: The third trough bouncing more quickly than previous troughs indicates growing buyer confidence.

## False Positive Conditions

- **Downtrend continuation**: In a strong downtrend, three troughs at similar levels may represent a temporary pause before further decline. Examine the broader trend context and fundamental backdrop.
- **No volume patterns**: If volume shows no discernible pattern across the three troughs, the accumulation thesis is weaker and the reversal may not materialize.
- **Insufficient time between troughs**: If the three troughs form too quickly (< 20 bars total), the structure may be noise rather than meaningful accumulation.
- **Descending troughs**: If each successive trough is notably lower than the previous one (> 3%), this is a descending channel, not a Triple Bottom.
- **Premature neckline break**: An intraday wick above the neckline without a closing break is not confirmation.
- **Confusion with Inverse Head and Shoulders**: If the middle trough is significantly lower than the other two, the pattern is Inverse Head and Shoulders, not Triple Bottom.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the neckline price (the highest confirmed peak between the troughs; all three troughs must be confirmed swing lows); `extremeLevel` = the average of the three trough prices; `direction` = 'up'; `invalidationLevel` = the lowest of the three troughs (a close below it negates the pattern). Copy these values from `## Chart Pattern Candidates (computed)` only when this pattern instance is listed there (set its Candidate id as candidateId); when it is not listed, you may still name and describe the pattern, but `geometry` is null and candidateId is empty — only listed patterns carry levels and targets. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The lowest of the three troughs serves as the invalidation level. A close below this level negates the bullish pattern.
- **Time factor**: Triple Bottoms that take longer to form (> 40 bars) tend to produce larger moves due to greater accumulation.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include all three trough prices and the neckline price level (connecting the two peaks).
- **patternSummaries**: Describe the pattern status (first/second/third trough formed / completed / neckline broken), the price difference percentage among the three troughs, the spacing between them, and how it differs from Double Bottom or Inverse Head and Shoulders.
- **Volume context**: State whether volume behavior confirms the pattern (declining volume across troughs, volume surge on neckline break). Note volume comparison between each successive trough.
- **Completion status**: Clearly indicate whether the pattern is still forming (which trough is in progress) or fully confirmed by a neckline break.
- **geometry**: For a listed pattern instance (with a Candidate id), fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. For an unlisted pattern, `geometry` is null and candidateId is empty. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
삼중바닥 (Triple Bottom) — bullish reversal, confidence_weight 0.7 (Bulkowski tb.html: rank 12/39, failure 13%, 74% meet target). Three troughs at ~equal support; neckline = line connecting the two peaks between troughs.

### Detection
- Three distinct troughs at ~same price, within 2–3% of each other.
- Two clear peaks between the troughs form the neckline.
- Each trough separated by meaningful rally ≥3% (trough average → neckline).
- Three troughs span minimum 20 bars (needs more time than Double Bottom).
- Closer trough prices → higher reliability.
- Confirmed when price CLOSES above neckline.
- Engine: pivots = confirmed swings (1.5 ATR reversal measured with the confirming bar's ATR; fixed once confirmed; one pivot per bar); last three confirmed swing lows; spread ≤ min(1 ATR, 3% of average price); consecutive troughs ≥10 bars apart; no bar between them beyond the matched troughs by >0.25 ATR; neckline = highest confirmed peak between them; height ≥2.5 ATR and the price-share minimum; rejected if the peaks under the equal lows clearly fall (≥1.5 ATR, = triangle); last trough ≤ max(20 bars, half the span) before the last bar.

### Grading
- Increase: all three troughs within 1.5% of each other; volume decreasing on third trough vs first; volume surge on neckline break; duration >30 bars; bullish RSI/MACD divergence across the three troughs.
- Decrease: troughs differ >3%; no volume pattern; shallow peaks (<3% from trough average); forming in strong downtrend with no stabilization; third trough notably deeper than first two (accelerating downtrend).
- Ideal: volume declines on each successive trough (selling exhausting); third trough with lowest volume.
- Third trough bouncing faster than prior troughs → growing buyer confidence.
- Retest holding above neckline strengthens bullish case (2nd entry ref).

### False positives
- Strong downtrend: three similar troughs may be a pause before further decline.
- No volume pattern across troughs → weak accumulation thesis.
- Troughs form too quickly (<20 bars total) → likely noise.
- Each trough notably lower than previous (>3%) → descending channel, not Triple Bottom.
- Intraday wick above neckline without closing break = not confirmed.
- Middle trough significantly LOWER than the other two → Inverse Head & Shoulders, not Triple Bottom.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the neckline price (the highest confirmed peak between the extremes), extremeLevel: the average of the three trough prices, direction: 'up', invalidationLevel: the lowest of the three troughs (a close below it negates the pattern) }. Copy from `## Chart Pattern Candidates (computed)` only when this instance is listed there (with its Candidate id); when not listed, the pattern may be described but `geometry` is null and candidateId empty. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: all three trough prices, neckline price.
- patternSummaries: status (first/second/third trough formed / completed / neckline broken); price-diff % among troughs; spacing; how it differs from Double Bottom or Inverse H&S.
- Volume context: declining volume across troughs; surge on break; compare successive troughs.
- Completion status: forming (which trough) vs confirmed by neckline break.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R; only for a listed instance, else `geometry` null and candidateId empty.
- trend: bullish when confirmed.
<!-- PROMPT_DIGEST:END -->
