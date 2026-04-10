---
name: 하락깃발
description: 급격한 하락 후 상향 평행 채널에서 조정을 거치는 약세 연속 패턴
type: pattern
category: continuation_bearish
pattern: bear_flag
indicators: []
confidence_weight: 0.75
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "깃발 하단"
---

## Detection Criteria

- A strong, steep downward move (the flagpole) must precede the pattern. The flagpole should show above-average volume and a clear directional decline.
- The flag is an upward or horizontal parallel channel that forms after the flagpole. The upper and lower boundaries of the channel should be roughly parallel.
- The flag should be relatively short in duration compared to the flagpole — typically 1-4 weeks (5-20 daily bars). The flag should retrace no more than 50% of the flagpole.
- Volume should noticeably decline during the flag formation, indicating temporary relief rather than accumulation.
- The flag should slope upward against the prior downtrend, or move sideways. A downward-sloping flag is less reliable as a Bear Flag.
- The pattern is confirmed when price closes below the lower boundary of the flag channel with increased volume.

## Confidence Weight Rationale

confidence_weight: 0.75 — Bear Flag mirrors the Bull Flag's reliability as a short-term continuation pattern. The sharp decline followed by an orderly, low-volume bounce reflects the pause-and-continue nature of downtrending markets. Bear Flags are particularly effective in panic-driven markets where relief rallies are quickly overwhelmed by renewed selling pressure.

Factors that increase confidence:
- Flagpole shows a decline of at least 10% with above-average volume
- Flag retraces less than 38.2% of the flagpole
- Volume declines by 50%+ during the flag relative to the flagpole
- Flag duration is short (1-2 weeks)
- Breakdown occurs with volume returning to flagpole levels

Factors that decrease confidence:
- Flagpole is shallow or slow (less like a panic move)
- Flag retraces more than 50% of the flagpole
- Volume increases during the flag (potential accumulation)
- Flag duration exceeds 4 weeks
- Flag channel is too wide or loses parallel structure

## Key Signals

- **Flagpole strength**: The flagpole must be a strong, near-vertical decline with high volume. This establishes the bearish momentum context. A gradual decline does not create a valid flagpole.
- **Volume decline in flag**: Volume should drop significantly during the upward flag formation. This shows that the bounce is a technical relief rally, not genuine accumulation.
- **Shallow retracement**: The flag should retrace a relatively small portion of the flagpole (ideally 25-38.2%). Deep retracements weaken the bearish continuation signal.
- **Breakdown with volume return**: When price breaks below the flag's lower channel line, volume should return to levels comparable to the flagpole. This confirms renewed selling pressure.
- **Tight channel structure**: The flag's parallel channel should be well-defined and relatively narrow. A widening channel reduces reliability.

## False Positive Conditions

- **Deep retracement (> 50%)**: If the flag retraces more than half the flagpole, bearish momentum has likely been broken and the pattern may be a potential reversal.
- **Extended duration**: A flag lasting more than 4 weeks loses the "relief rally" character and may be transitioning into an accumulation base.
- **High volume in flag**: If volume increases during the upward flag, buyers may be accumulating rather than providing temporary relief, undermining the bearish continuation thesis.
- **Descending flag**: If the flag slopes downward (creating a falling wedge-like structure within a downtrend), it may indicate capitulation rather than consolidation.
- **No clear flagpole**: Without a sharp preceding decline, the "flag" is just an upward channel without the bearish momentum context that makes the pattern valid.
- **Support levels**: If the flagpole ends at a major historical support level, the flag may transition into a reversal base rather than continuing lower.

## Entry/Exit Considerations

- **Target price calculation**: Measure the length of the flagpole (from the top to the bottom of the flagpole). Project this distance downward from the breakdown point (where price exits the lower flag channel). Example: if the flagpole runs from $100 to $80 ($20) and the breakdown occurs at $84, the target is $64 ($84 - $20).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the upper flag channel defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The upper boundary of the flag channel or the most recent swing high within the flag serves as the invalidation level.
- **Partial target**: 50% of the flagpole length serves as a conservative initial target.
- **Speed of completion**: Bear Flags that resolve quickly (within 1-2 weeks) tend to produce the strongest continuation moves, especially in fear-driven markets.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the flagpole top price, flagpole bottom price, flag upper channel, flag lower channel, and the projected target price if the flag is broken downward.
- **patternSummaries**: Describe the pattern status (flagpole formed / flag forming / breakdown confirmed), the flagpole decline percentage and duration, the flag retracement depth relative to the flagpole, the flag slope direction, and the flag duration.
- **Volume context**: State whether volume confirms the pattern — high volume on flagpole, declining volume during the flag, and volume surge on breakdown. Quantify the volume decline during the flag relative to the flagpole.
- **Completion status**: Clearly indicate whether the flag is still forming or confirmed by a close below the lower channel with volume.
- **Target projection**: Calculate and state the measured move target using the flagpole length projected from the breakdown point.
