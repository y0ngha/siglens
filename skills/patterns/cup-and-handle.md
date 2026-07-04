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
token_cost: 613
digest_hash: "0e23aabf"
---

## Detection Criteria

- A rounded U-shaped bottom (the cup) must be present — not a sharp V-shaped bottom. The cup should form gradually over a minimum of 7 weeks (35 daily bars).
- The cup depth should ideally be a 12-33% retracement of the prior uptrend. Cups deeper than 50% of the prior advance significantly weaken the pattern.
- After the cup right rim forms at approximately the same level as the left rim, a small downward consolidation (the handle) must form.
- The handle should retrace 5-15% from the cup rim and last 1-4 weeks (5-20 daily bars).
- The handle must form in the upper half of the cup — if the handle drops below the cup's midpoint, the pattern is invalidated.
- The left and right rims of the cup should be within 5% of each other in price.
- The pattern is confirmed when price closes above the handle's upper resistance with significantly increased volume (50%+ above average).

## Confidence Weight Rationale

confidence_weight: 0.8 — Cup and Handle is rated by Bulkowski as "very reliable" and is one of the best-performing continuation patterns. Developed by William O'Neil as part of the CANSLIM strategy, it combines price structure with volume confirmation for high-probability setups. The gradual U-shape of the cup indicates orderly accumulation, and the handle provides a final shake-out of weak holders before the advance resumes.

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

- **Target price calculation**: Measure the depth of the cup (from rim to cup bottom). Project this distance upward from the breakout point (handle resistance). Example: if the cup rim is at $110 and the cup bottom is at $85, the target is $135 ($110 + $25).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the bottom of the handle defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The bottom of the handle serves as the primary invalidation level. A close below this negates the bullish pattern. For a wider stop, the cup's midpoint can be used.
- **Partial target**: 50% of the cup depth serves as a conservative initial target.
- **Extended targets**: Cup and Handle patterns in strong uptrends often exceed their measured move targets. The initial target serves as a minimum expectation.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the left rim price, right rim price, cup bottom price, handle resistance price, handle bottom price, and the projected target price if the handle is broken.
- **patternSummaries**: Describe the pattern status (cup forming / right rim reached / handle forming / handle breakout), the cup depth as a percentage of the prior advance, the handle depth as a percentage of the cup, the cup shape assessment (U vs V), and the handle position within the cup (upper third, upper half, lower half).
- **Volume context**: State whether volume follows the expected U-shape during the cup, declines during the handle, and surges on the breakout. Quantify the breakout volume relative to the average.
- **Completion status**: Clearly indicate which phase the pattern is in — cup formation, handle formation, or confirmed breakout.
- **Target projection**: Calculate and state the measured move target using the cup depth projected upward from the breakout point.

<!-- PROMPT_DIGEST:START -->
### Cup and Handle (bullish continuation)

Geometry:
- Cup: rounded U-shaped bottom (NOT sharp V). Forms gradually over minimum 7 weeks (35 daily bars).
- Cup depth ideally 12–33% retracement of prior uptrend; deeper than 50% significantly weakens.
- Handle: small downward consolidation after right rim forms at ~left-rim level. Retrace 5–15% from cup rim, last 1–4 weeks (5–20 daily bars).
- Handle must form in UPPER HALF of cup; dropping below cup midpoint invalidates.
- Left & right rims within 5% of each other.
- Confirmed: close ABOVE handle's upper resistance with volume 50%+ above average.

Confidence (weight 0.8): Bulkowski "very reliable"; O'Neil CANSLIM.
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

Target: cup depth (rim to cup bottom); project UP from breakout point (handle resistance) (e.g., rim $110, bottom $85 → target $135). Partial = 50% of depth. Strong uptrends often exceed target (treat as minimum).
Stop/invalidation: bottom of handle (close below negates); wider stop = cup midpoint. R/R ≥ 2:1 favorable.

Output:
- keyPrices: left rim, right rim, cup bottom, handle resistance, handle bottom, projected target.
- patternSummaries: status (cup forming / right rim reached / handle forming / handle breakout), cup depth % of prior advance, handle depth % of cup, cup shape (U vs V), handle position (upper third / upper half / lower half).
- Volume context: U-shape in cup, decline in handle, surge on breakout (quantify vs average).
- Completion status: cup formation / handle formation / confirmed breakout.
- Target projection: cup depth projected up from breakout point.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
