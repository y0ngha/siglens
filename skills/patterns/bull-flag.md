---
name: 상승깃발
description: 급격한 상승 후 하향 평행 채널에서 조정을 거치는 강세 연속 패턴
type: pattern
category: continuation_bullish
pattern: bull_flag
indicators: []
confidence_weight: 0.5
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "깃발 상단"
gating:
  tier: gated
  signal_kind: event
  triggers: [bull_flag]
token_cost: 736
digest_hash: "dbb18cf3"
---

## Detection Criteria

- A strong, steep upward move (the flagpole) must precede the pattern. The flagpole should show above-average volume and a clear directional move.
- The flag is a downward or horizontal parallel channel that forms after the flagpole. The upper and lower boundaries of the channel should be roughly parallel.
- The flag should be relatively short in duration compared to the flagpole — typically 1-4 weeks (5-20 daily bars). The flag should retrace no more than 50% of the flagpole.
- Volume should noticeably decline during the flag formation, indicating consolidation rather than distribution.
- The flag should slope downward against the prior uptrend, or move sideways. An upward-sloping flag is less reliable.
- The pattern is confirmed when price closes above the upper boundary of the flag channel with increased volume.
- Engine rule: the pole is two consecutive confirmed swing pivots (base → top) at least 3 ATR apart within 20 bars; the flag is the 5–20 bars after the pole top, pulling back no more than 50% of the pole, and is drawn as a channel through its own swing highs and lows (at least 2 touches per side, each side with touches the other lacks). The channel's end width must be 0.7–1.15× its start and neither edge may rise with the pole by more than min(0.75 ATR, 1% of price) — otherwise it is not a flag (a converging channel is a pennant).

## Confidence Weight Rationale

confidence_weight: 0.5 — Bulkowski (thepatternsite.com/flags.html, bull market; flags are measured over the short-term price swing, so they are not ranked): break-even failure rate 44% for upward / 45% for downward breakouts; 46% meet the price target; average rise 9%; breakout upward 60% of the time (all flags pooled). Weight: failure > 30% → 0.5. The structure — a sharp advance followed by an orderly, low-volume pullback — is clear and objective to detect, but the measured edge after the breakout is small.

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

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the upper flag channel line's value at the last bar; `extremeLevel` = the breakout level minus the flagpole height (pole base to pole top — so it is the pole's start price only when the flag line sits at the pole top); `direction` = 'up'; `invalidationLevel` = the flag's lowest low since the pole top (a fixed price). When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The flag's lowest low since the pole top serves as the invalidation level.
- **Speed of completion**: Bull Flags that resolve quickly (within 1-2 weeks) tend to produce the strongest continuation moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the flagpole base price, flagpole top price, flag upper channel, and flag lower channel.
- **patternSummaries**: Describe the pattern status (flagpole formed / flag forming / breakout confirmed), the flagpole gain percentage and duration, the flag retracement depth relative to the flagpole, the flag slope direction, and the flag duration.
- **Volume context**: State whether volume confirms the pattern — high volume on flagpole, declining volume during the flag, and volume surge on breakout. Quantify the volume decline during the flag relative to the flagpole.
- **Completion status**: Clearly indicate whether the flag is still forming or confirmed by a close above the upper channel with volume.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Bull Flag (bullish continuation)

Geometry:
- Flagpole: strong steep near-vertical UP move first, with above-average volume. Weak/gradual advance = invalid.
- Flag: downward or horizontal parallel channel after flagpole; boundaries roughly parallel. Should slope DOWN against uptrend (or sideways); upward-sloping flag less reliable.
- Duration: short vs flagpole — typically 1–4 weeks (5–20 daily bars). Retrace ≤50% of flagpole.
- Volume declines noticeably during flag.
- Confirmed: close ABOVE upper flag channel with increased volume.
- Engine: the pole is two consecutive confirmed swing pivots (base → top) at least 3 ATR apart within 20 bars; flag = 5–20 bars after the pole top, pullback ≤50% of the pole, channel through the flag's swing highs/lows (≥2 touches per side), end width 0.7–1.15× start, neither edge rising with the pole by more than min(0.75 ATR, 1% price).

Confidence (weight 0.5) — Bulkowski flags.html: failure 44% (up breakouts), 46% meet target, avg rise 9%; not ranked (short swing).
- Increase: flagpole gain ≥10% with above-avg volume, flag retrace < 38.2%, volume drops 50%+ vs flagpole, flag duration 1–2 weeks, breakout volume returns to flagpole levels.
- Decrease: shallow/slow flagpole, retrace > 50%, volume high in flag (distribution), duration > 4 weeks, channel too wide / loses parallel structure.

Signals: shallow retrace ideal 25–38.2%; breakout volume should return to flagpole levels.

False positives / invalidation:
- Retrace > 50% = momentum broken, reclassify as potential reversal.
- Duration > 4 weeks = transitioning (rectangle/descending channel).
- High volume in flag = distribution.
- Ascending flag (rising-wedge-like) = less reliable.
- No clear flagpole = just a downward channel.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the upper flag channel line at the last bar, extremeLevel: breakout minus the flagpole height (pole base to pole top), direction: 'up', invalidationLevel: the flag's lowest low since the pole top }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: flagpole base, flagpole top, flag upper channel, flag lower channel.
- patternSummaries: status (flagpole formed / flag forming / breakout confirmed), flagpole gain % & duration, flag retrace depth vs flagpole, flag slope direction, flag duration.
- Volume context: high on flagpole, declining in flag (quantify decline vs flagpole), surge on breakout.
- Completion status: forming vs confirmed (close above upper channel with volume).
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
