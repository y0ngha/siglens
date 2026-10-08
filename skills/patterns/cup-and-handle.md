---
name: 컵앤핸들
description: U자형 바닥과 작은 하향 조정 후 상향 돌파하는 강세 연속 패턴
type: pattern
category: continuation_bullish
pattern: cup_and_handle
indicators: []
confidence_weight: 0.8
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "핸들 저항선"
gating:
  tier: gated
  signal_kind: event
  triggers: [cup_and_handle]
token_cost: 949
digest_hash: "5d6b34c7"
---

## Detection Criteria

- A rounded U-shaped bottom (the cup) must be present — not a sharp V-shaped bottom. The cup should form gradually over a minimum of 7 weeks (35 daily bars).
- The cup depth should ideally be a 12-33% retracement of the prior uptrend. Cups deeper than 50% of the prior advance significantly weaken the pattern.
- After the cup right rim forms at approximately the same level as the left rim, a small downward consolidation (the handle) must form.
- The handle should retrace 5-15% from the cup rim and last 1-4 weeks (5-20 daily bars).
- The handle must form in the upper half of the cup — if the handle drops below the cup's midpoint, the pattern is invalidated.
- The left and right rims of the cup should be within 5% of each other in price.
- The pattern is confirmed when price closes above the handle's upper resistance with significantly increased volume (50%+ above average).
- Engine rule: Pivots are confirmed swings: a swing counts once price reverses 1.5 ATR from it, measured with the ATR of the bar that confirms it, so a confirmed pivot never moves when bars are added, and no bar is both a swing high and a swing low. Both rims are confirmed swing highs at least 30 bars apart (inclusive) and within 7% of the higher rim's price (looser than the 5% textbook figure because a right rim often recovers short of the left), AND the rim gap is at most 25% of the cup depth measured from the lower rim (so a shallow base with a 6% rim gap is not a cup). No bar between the rims may go more than 0.25 ATR above the lower rim once price has left the rims (the higher rim's own leg is not counted), the depth from the lower rim must be at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars), and at least 40% of the closes between the rims must sit in the bottom third of the depth (right rim down to the lowest low) — a U, not a V. The left rim must be the highest high of the bars before it over half the cup's width (price advanced into it, within 0.25 ATR), and the bottom must lie in the middle half of the rim-to-rim span by time (25%–75%). The right rim must be 5–20 bars before the last bar (the earliest right rim in that window, then the earliest left rim, that passes is used, so the cup does not jump to a later high); the handle low is the lowest confirmed swing low after the right rim and must be at or above the cup's midpoint (no more than 50% of the cup depth below the right rim). The pivots drawn run from the left rim to the handle low.

## Confidence Weight Rationale

confidence_weight: 0.8 — Bulkowski (thepatternsite.com/cup.html, bull market): performance rank 3 of 39, break-even failure rate 5%, 61% meet the price target. Weight: failure ≤ 10% → 0.8. Developed by William O'Neil as part of the CANSLIM strategy, it combines price structure with volume confirmation. The gradual U-shape of the cup indicates orderly accumulation, and the handle provides a final shake-out of weak holders before the advance resumes.

Factors that increase confidence:
- Cup forms a smooth, rounded U-shape (not V-shaped)
- Cup depth between 12-33% of the prior advance
- Handle retracement less than 10% from the rim
- Volume dramatically increases (50%+) on the handle breakout
- Prior uptrend of at least 30% before the cup formed
- Handle forms in the upper third of the cup

Factors that decrease confidence:
- V-shaped bottom instead of U-shaped
- Cup deeper than 40% of the prior advance
- Handle drops into the lower half of the cup
- No volume surge on breakout
- Flat or declining volume during the breakout attempt
- Handle lasting longer than 4 weeks (may indicate failed pattern)

## Key Signals

- **Rounded cup shape**: The cup must form gradually with a rounded bottom, not a sharp V. A rounded shape indicates patient accumulation by institutional buyers. V-shaped bottoms suggest panic selling and recovery, which is a different dynamic.
- **Volume U-shape**: Volume should follow the cup shape — declining during the left side of the cup, reaching a minimum at the bottom, and gradually increasing during the right side. This mirrors the accumulation process.
- **Handle shake-out**: The handle represents a final shake-out of weak holders. Volume should decline during the handle formation, indicating lack of selling pressure.
- **Breakout volume surge**: The breakout above the handle resistance must be accompanied by at least a 50% increase in volume above the recent average. This confirms institutional buying.
- **Prior uptrend**: Cup and Handle is a continuation pattern — a meaningful uptrend (at least 30%) should precede the cup formation. Without a prior uptrend, the pattern loses its continuation context.

## False Positive Conditions

- **V-shaped cup**: A sharp V-shaped recovery is not a valid cup. The V-shape indicates a different market dynamic (panic bounce) rather than the gradual accumulation that characterizes a true Cup and Handle. The rounded bottom is a key distinguishing feature.
- **Deep cup (>50%)**: If the cup retraces more than 50% of the prior advance, the accumulation thesis is weakened — too many holders were shaken out during the decline for a strong continuation.
- **Handle too deep**: If the handle drops below the midpoint of the cup, it indicates that sellers are still in control and the pattern may fail.
- **Handle too long**: A handle lasting more than 4-5 weeks may indicate that the breakout attempt has failed and the market lacks the buying pressure to advance.
- **No volume confirmation**: A breakout without a significant volume surge suggests insufficient institutional participation to sustain the advance.
- **Descending rim**: If the right rim of the cup is more than 5% below the left rim, the pattern shows weakening momentum rather than accumulation.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the right rim's price (a confirmed swing high — the handle's resistance, the breakout level); `extremeLevel` = the cup bottom price (the lowest low between the rims); `direction` = 'up'; `invalidationLevel` = the handle low (the lowest confirmed swing low after the right rim, never deeper than the cup's midpoint; a close below it negates the pattern; the cup midpoint is a wider alternative stop). Copy these values from `## Chart Pattern Candidates (computed)` only when this pattern instance is listed there (set its Candidate id as candidateId); when it is not listed, you may still name and describe the pattern, but `geometry` is null and candidateId is empty — only listed patterns carry levels and targets. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The bottom of the handle serves as the primary invalidation level. A close below this negates the bullish pattern. For a wider stop, the cup's midpoint can be used.
- **Target reliability**: Bulkowski (cup.html): 61% reach the measure-rule target, and in his 1990–2024 sample of 300 cups 47% dropped substantially within two months of the breakout — do not treat the target as a minimum expectation.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the left rim price, right rim price, cup bottom price, handle resistance price, and handle bottom price.
- **patternSummaries**: Describe the pattern status (cup forming / right rim reached / handle forming / handle breakout), the cup depth as a percentage of the prior advance, the handle depth as a percentage of the cup, the cup shape assessment (U vs V), and the handle position within the cup (upper third, upper half, lower half).
- **Volume context**: State whether volume follows the expected U-shape during the cup, declines during the handle, and surges on the breakout. Quantify the breakout volume relative to the average.
- **Completion status**: Clearly indicate which phase the pattern is in — cup formation, handle formation, or confirmed breakout.
- **geometry**: For a listed pattern instance (with a Candidate id), fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. For an unlisted pattern, `geometry` is null and candidateId is empty. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Cup and Handle (bullish continuation)

Geometry:
- Cup: rounded U-shaped bottom (NOT sharp V). Forms gradually over minimum 7 weeks (35 daily bars).
- Cup depth ideally 12–33% retracement of prior uptrend; deeper than 50% significantly weakens.
- Handle: small downward consolidation after right rim forms at ~left-rim level. Retrace 5–15% from cup rim, last 1–4 weeks (5–20 daily bars).
- Handle must form in UPPER HALF of cup; dropping below cup midpoint invalidates.
- Left & right rims within 5% of each other.
- Confirmed: close ABOVE handle's upper resistance with volume 50%+ above average.
- Engine: pivots = confirmed swings (1.5 ATR reversal measured with the confirming bar's ATR; fixed once confirmed; one pivot per bar); confirmed swing-high rims ≥30 bars apart, within 7% of the higher rim AND rim gap ≤25% of the depth (from the lower rim); no bar between >0.25 ATR above the lower rim (the higher rim's own leg excluded); depth ≥2.5 ATR and the price-share minimum; ≥40% of closes in the bottom third of the depth (U not V); left rim = highest high of the bars before it over half the cup width; bottom in the middle half of the span (25–75%); right rim 5–20 bars before the last bar (earliest passing); handle low = lowest confirmed swing low after the right rim, at/above the cup midpoint (≤50% of the depth below the right rim).

Confidence (weight 0.8) — Bulkowski cup.html: rank 3/39, failure 5%, 61% meet target; O'Neil CANSLIM.
- Increase: smooth rounded U (not V), cup depth 12–33% of prior advance, handle retrace < 10% from rim, breakout volume +50%, prior uptrend ≥30%, handle in upper THIRD of cup.
- Decrease: V-shaped bottom, cup deeper than 40% of prior advance, handle in lower half, no breakout volume surge, flat/declining breakout volume, handle > 4 weeks.

Volume profile: U-shaped through cup (declines left side → min at bottom → rises right side); declines during handle; surges 50%+ on breakout.

False positives / invalidation:
- V-shaped cup = invalid (panic bounce not accumulation).
- Cup > 50% retrace = accumulation thesis weakened.
- Handle below cup midpoint = sellers in control, may fail.
- Handle > 4–5 weeks = failed breakout attempt.
- No volume surge on breakout.
- Right rim > 5% below left rim = weakening momentum.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the right rim's price (a confirmed swing high, the handle's resistance), extremeLevel: the cup bottom price (lowest low between the rims), direction: 'up', invalidationLevel: the handle low (the lowest confirmed swing low after the right rim, never deeper than the cup's midpoint; the cup midpoint is a wider alternative stop) }. Copy from `## Chart Pattern Candidates (computed)` only when this instance is listed there (with its Candidate id); when not listed, the pattern may be described but `geometry` is null and candidateId empty. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: left rim, right rim, cup bottom, handle resistance, handle bottom.
- patternSummaries: status (cup forming / right rim reached / handle forming / handle breakout), cup depth % of prior advance, handle depth % of cup, cup shape (U vs V), handle position (upper third / upper half / lower half).
- Volume context: U-shape in cup, decline in handle, surge on breakout (quantify vs average).
- Completion status: cup formation / handle formation / confirmed breakout.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R; only for a listed instance, else `geometry` null and candidateId empty.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
