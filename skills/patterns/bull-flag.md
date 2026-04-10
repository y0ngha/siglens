---
name: 상승깃발
description: 급격한 상승 후 하향 평행 채널에서 조정을 거치는 강세 연속 패턴
type: pattern
category: continuation_bullish
pattern: bull_flag
indicators: []
confidence_weight: 0.75
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "깃발 상단"
---

## Detection Criteria

- A strong, steep upward move (the flagpole) must precede the pattern. The flagpole should show above-average volume and a clear directional move.
- The flag is a downward or horizontal parallel channel that forms after the flagpole. The upper and lower boundaries of the channel should be roughly parallel.
- The flag should be relatively short in duration compared to the flagpole — typically 1-4 weeks (5-20 daily bars). The flag should retrace no more than 50% of the flagpole.
- Volume should noticeably decline during the flag formation, indicating consolidation rather than distribution.
- The flag should slope downward against the prior uptrend, or move sideways. An upward-sloping flag is less reliable.
- The pattern is confirmed when price closes above the upper boundary of the flag channel with increased volume.

## Confidence Weight Rationale

confidence_weight: 0.75 — Bull Flag is one of the most reliable short-term continuation patterns, frequently used in momentum trading. Its clear structure — a sharp advance followed by an orderly, low-volume pullback — directly reflects the pause-and-continue nature of trending markets. The well-defined flagpole provides a measurable target, and the flag's channel structure makes breakout detection objective.

Factors that increase confidence:
- Flagpole shows a gain of at least 10% with above-average volume
- Flag retraces less than 38.2% of the flagpole
- Volume declines by 50%+ during the flag relative to the flagpole
- Flag duration is short (1-2 weeks)
- Breakout occurs with volume returning to flagpole levels

Factors that decrease confidence:
- Flagpole is shallow or slow (less like an impulse move)
- Flag retraces more than 50% of the flagpole
- Volume remains high during the flag (potential distribution)
- Flag duration exceeds 4 weeks
- Flag channel is too wide or loses parallel structure

## Key Signals

- **Flagpole strength**: The flagpole must be a strong, near-vertical move with high volume. This establishes the momentum context. A weak, gradual advance does not create a valid flagpole.
- **Volume decline in flag**: Volume should drop significantly during the flag formation. This shows that the pullback is orderly profit-taking, not aggressive selling.
- **Shallow retracement**: The flag should retrace a relatively small portion of the flagpole (ideally 25-38.2%). Deep retracements weaken the continuation signal.
- **Breakout with volume return**: When price breaks above the flag's upper channel line, volume should return to levels comparable to the flagpole. This confirms renewed buying interest.
- **Tight channel structure**: The flag's parallel channel should be well-defined and relatively narrow. A widening or chaotic flag structure reduces reliability.

## False Positive Conditions

- **Deep retracement (> 50%)**: If the flag retraces more than half the flagpole, the momentum has likely been broken and the pattern should be reclassified as a potential reversal setup.
- **Extended duration**: A flag lasting more than 4 weeks loses the "pause" character and may be transitioning into a different pattern (rectangle or descending channel).
- **High volume in flag**: If volume remains elevated during the flag, sellers are actively distributing rather than resting, which undermines the continuation thesis.
- **Ascending flag**: If the flag slopes upward (creating a rising wedge-like structure), the pattern is less reliable and may indicate a weakening trend rather than a healthy consolidation.
- **No clear flagpole**: Without a sharp preceding advance, the "flag" is just a downward channel without the momentum context that makes the pattern valid.

## Entry/Exit Considerations

- **Target price calculation**: Measure the length of the flagpole (from the base of the flagpole to the top). Project this distance upward from the breakout point (where price exits the upper flag channel). Example: if the flagpole runs from $80 to $100 ($20) and the breakout occurs at $96, the target is $116 ($96 + $20).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the lower flag channel defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The lower boundary of the flag channel or the most recent swing low within the flag serves as the invalidation level.
- **Partial target**: 50% of the flagpole length serves as a conservative initial target.
- **Speed of completion**: Bull Flags that resolve quickly (within 1-2 weeks) tend to produce the strongest continuation moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the flagpole base price, flagpole top price, flag upper channel, flag lower channel, and the projected target price if the flag is broken.
- **patternSummaries**: Describe the pattern status (flagpole formed / flag forming / breakout confirmed), the flagpole gain percentage and duration, the flag retracement depth relative to the flagpole, the flag slope direction, and the flag duration.
- **Volume context**: State whether volume confirms the pattern — high volume on flagpole, declining volume during the flag, and volume surge on breakout. Quantify the volume decline during the flag relative to the flagpole.
- **Completion status**: Clearly indicate whether the flag is still forming or confirmed by a close above the upper channel with volume.
- **Target projection**: Calculate and state the measured move target using the flagpole length projected from the breakout point.
