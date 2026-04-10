---
name: 페넌트
description: 급격한 움직임 후 수렴하는 삼각형 형태의 조정을 거치는 연속 패턴
type: pattern
category: continuation
pattern: pennant
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#78909c"
    label: "페넌트"
---

## Detection Criteria

- A strong, decisive move (the flagpole) must precede the pattern. The flagpole can be either bullish (Bull Pennant) or bearish (Bear Pennant) and must show above-average volume.
- After the flagpole, price consolidates in a converging symmetrical triangle shape (the pennant) — lower highs and higher lows compress the range.
- The pennant must be short in duration relative to the flagpole — typically 1-3 weeks (5-15 daily bars). Pennants that last longer than 3 weeks begin to lose their continuation bias.
- Volume must decline significantly during the pennant formation, indicating a brief pause rather than a directional shift.
- Both the upper (descending) and lower (ascending) trendlines of the pennant must have at least 2 touch points each.
- The pennant should retrace no more than 38.2% of the flagpole at its widest point.
- The pattern is confirmed when price closes outside the pennant in the direction of the flagpole, with volume returning to above-average levels.

## Distinguishing Pennant from Symmetrical Triangle

The key difference between a Pennant and a Symmetrical Triangle is the presence of a preceding flagpole:
- **Pennant**: Always preceded by a strong, sharp move (flagpole). Short duration (1-3 weeks). Continuation probability is higher due to the momentum context.
- **Symmetrical Triangle**: Forms independently without a flagpole. Longer duration (weeks to months). Direction bias comes from the prior trend, but with less momentum context.

If no clear flagpole precedes the converging trendlines, classify the pattern as a Symmetrical Triangle instead.

## Confidence Weight Rationale

confidence_weight: 0.7 — Pennant has a similar reliability to the Flag pattern, as both are short-term continuation patterns following a strong impulse move. The pennant's converging (triangular) structure is slightly less defined than the flag's parallel channel, introducing marginally more ambiguity in the breakout direction. However, the mandatory flagpole provides strong momentum context that supports the continuation bias.

Factors that increase confidence:
- Flagpole shows a move of at least 10% with significantly above-average volume
- Pennant retraces less than 25% of the flagpole
- Volume drops by 60%+ during the pennant relative to the flagpole
- Pennant duration is very short (1-2 weeks)
- Breakout direction matches the flagpole direction with volume surge

Factors that decrease confidence:
- Weak flagpole (gradual move rather than sharp impulse)
- Pennant retraces more than 38.2% of the flagpole
- Volume remains elevated during the pennant
- Pennant lasts longer than 3 weeks
- Breakout direction opposes the flagpole direction

## Key Signals

### Bull Pennant
- **Preceding upward flagpole**: A strong upward move with high volume establishes the bullish context.
- **Converging consolidation**: Price forms lower highs and higher lows in a symmetrical triangle shape.
- **Volume dry-up**: Volume declines dramatically during the pennant, showing that sellers are not pressing.
- **Upward breakout**: Price breaks above the pennant's upper trendline with renewed volume, confirming the bullish continuation.

### Bear Pennant
- **Preceding downward flagpole**: A strong downward move with high volume establishes the bearish context.
- **Converging consolidation**: Price forms lower highs and higher lows in a symmetrical triangle shape.
- **Volume dry-up**: Volume declines dramatically during the pennant, showing that buyers are not accumulating.
- **Downward breakdown**: Price breaks below the pennant's lower trendline with renewed volume, confirming the bearish continuation.

### Common Signals
- **Breakout volume surge**: The breakout must be accompanied by a significant return of volume. Low-volume breakouts are unreliable.
- **Tight convergence**: A tightly converging pennant (rapid narrowing) indicates a more imminent and forceful breakout.

## False Positive Conditions

- **No flagpole**: Without a preceding sharp move, the pattern is a symmetrical triangle, not a pennant. The flagpole is the defining feature.
- **Extended duration**: A pennant lasting more than 3-4 weeks loses the "brief pause" character. The longer the consolidation, the weaker the continuation bias becomes.
- **Deep retracement**: If the pennant retraces more than 50% of the flagpole, the momentum has been significantly absorbed and continuation is less likely.
- **High volume during formation**: If volume stays elevated during the pennant, the consolidation includes active buying/selling rather than a pause, which may lead to a reversal instead.
- **Counter-direction breakout**: A breakout against the flagpole direction should be treated with extra skepticism. While possible, it requires very strong volume confirmation to be valid.
- **Asymmetric trendlines**: If the pennant trendlines are clearly asymmetric (one much steeper than the other), the pattern may be a flag or wedge instead.

## Entry/Exit Considerations

- **Target price calculation**: Measure the length of the flagpole. Project this distance from the breakout point in the direction of the breakout. Example (Bull Pennant): if the flagpole runs from $50 to $70 ($20) and the upward breakout occurs at $67, the target is $87 ($67 + $20). Example (Bear Pennant): if the flagpole runs from $100 to $80 ($20) and the downward breakdown occurs at $83, the target is $63 ($83 - $20).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the opposite side of the pennant defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The opposite trendline of the pennant from the breakout direction, or the most recent swing high/low within the pennant, serves as the invalidation level.
- **Partial target**: 50% of the flagpole length serves as a conservative initial target.
- **Speed**: Pennants that resolve quickly (within 1-2 weeks) with strong volume tend to produce the best continuation moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the flagpole base price, flagpole end price, pennant upper trendline, pennant lower trendline, and the projected target price if the pennant is broken.
- **patternSummaries**: Describe the pennant type (Bull or Bear), the pattern status (flagpole formed / pennant forming / breakout confirmed), the flagpole move percentage, the pennant retracement depth relative to the flagpole, the convergence tightness, and the pennant duration. Note how the pattern is distinguished from a Symmetrical Triangle.
- **Volume context**: State whether volume confirms the pattern — high volume on flagpole, dramatic volume decline during the pennant, and volume surge on breakout. Quantify the volume decline percentage.
- **Completion status**: Clearly indicate whether the pennant is still forming or confirmed by a close outside the trendline in the flagpole direction.
- **Target projection**: Calculate and state the measured move target using the flagpole length projected from the breakout point.
