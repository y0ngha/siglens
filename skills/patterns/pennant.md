---
name: 페넌트
description: 급격한 움직임 후 수렴하는 삼각형 형태의 조정을 거치는 연속 패턴
type: pattern
category: neutral
pattern: pennant
indicators: []
confidence_weight: 0.72
display:
  chart:
    show: true
    type: line
    color: "#78909c"
    label: "페넌트"
gating:
  tier: gated
  signal_kind: event
  triggers: [pennant]
token_cost: 842
digest_hash: "6905e8e4"
---

## Detection Criteria

- A strong, decisive move (the flagpole) must precede the pattern. The flagpole can be either bullish (Bull Pennant) or bearish (Bear Pennant) and must show above-average volume.
- After the flagpole, price consolidates in a converging symmetrical triangle shape (the pennant) — lower highs and higher lows compress the range.
- The pennant must be short in duration relative to the flagpole — typically 1-3 weeks (5-15 daily bars). Pennants that last longer than 3 weeks begin to lose their continuation bias.
- Volume must decline significantly during the pennant formation, indicating a brief pause rather than a directional shift.
- Both the upper (descending) and lower (ascending) trendlines of the pennant must have at least 2 touch points each.
- The pennant should retrace no more than roughly 38.2% of the flagpole at its widest point. This is a guideline, not a hard limit — some reliable pennants retrace up to 50%, but retracements beyond 50% materially weaken the continuation bias.
- The pattern is confirmed when price closes outside the pennant in the direction of the flagpole, with volume returning to above-average levels.

## Distinguishing Pennant from Symmetrical Triangle

The key difference between a Pennant and a Symmetrical Triangle is the presence of a preceding flagpole:
- **Pennant**: Always preceded by a strong, sharp move (flagpole). Short duration (1-3 weeks). Continuation probability is higher due to the momentum context.
- **Symmetrical Triangle**: Forms independently without a flagpole. Longer duration (weeks to months). Direction bias comes from the prior trend, but with less momentum context.

If no clear flagpole precedes the converging trendlines, classify the pattern as a Symmetrical Triangle instead.

## Confidence Weight Rationale

confidence_weight: 0.72 — Pennant has a similar reliability profile to the Flag pattern, as both are short-term continuation patterns following a strong impulse move. Bulkowski reports continuation-direction breakouts for pennants in roughly the 65–75% range. The pennant's converging (triangular) structure is slightly less defined than the flag's parallel channel, introducing marginally more ambiguity in the breakout direction, but the mandatory flagpole provides strong momentum context that supports the continuation bias. The 0.72 weight sits just below Bull/Bear Flag (0.75) to reflect the slightly wider directional variance.

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

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the pennant trendline value at the breakout/breakdown point (the upper trendline for a bull pennant, the lower for a bear pennant); `extremeLevel` = the flagpole's start price; `direction` = 'up' for a bull pennant, 'down' for a bear pennant; `invalidationLevel` = the opposite pennant trendline, or the most recent swing high/low within the pennant. When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The opposite trendline of the pennant from the breakout direction, or the most recent swing high/low within the pennant, serves as the invalidation level.
- **Speed**: Pennants that resolve quickly (within 1-2 weeks) with strong volume tend to produce the best continuation moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the flagpole base price, flagpole end price, pennant upper trendline, and pennant lower trendline.
- **patternSummaries**: Describe the pennant type (Bull or Bear), the pattern status (flagpole formed / pennant forming / breakout confirmed), the flagpole move percentage, the pennant retracement depth relative to the flagpole, the convergence tightness, and the pennant duration. Note how the pattern is distinguished from a Symmetrical Triangle.
- **Volume context**: State whether volume confirms the pattern — high volume on flagpole, dramatic volume decline during the pennant, and volume surge on breakout. Quantify the volume decline percentage.
- **Completion status**: Clearly indicate whether the pennant is still forming or confirmed by a close outside the trendline in the flagpole direction.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
페넌트 (Pennant) — continuation, confidence_weight 0.72. Flagpole + converging symmetrical-triangle consolidation. Bull (up flagpole) or Bear (down flagpole).

### Detection
- Strong decisive flagpole must PRECEDE pattern, on above-average volume. Bull = up move, Bear = down move.
- Pennant = converging symmetrical triangle (lower highs + higher lows compress range).
- Duration short vs flagpole: typically 1–3 weeks (5–15 daily bars). >3 weeks loses continuation bias.
- Volume must decline significantly during pennant (pause, not directional shift).
- Both upper (descending) and lower (ascending) trendlines need ≥2 touches each.
- Retracement ≤~38.2% of flagpole at widest point (guideline; up to 50% can still be reliable; >50% materially weakens bias).
- Confirmed when price CLOSES outside pennant in flagpole direction with volume returning above-average.

### Pennant vs Symmetrical Triangle
- Pennant: always preceded by sharp flagpole; short (1–3 wk); higher continuation probability from momentum.
- Symmetrical Triangle: no flagpole; longer (weeks–months); bias from prior trend only.
- If NO clear flagpole precedes converging trendlines → classify as Symmetrical Triangle instead.

### Grading
- Increase: flagpole ≥10% move on high volume; retrace <25% of flagpole; volume drops 60%+ vs flagpole; duration 1–2 wk; breakout matches flagpole direction with volume surge.
- Decrease: weak/gradual flagpole; retrace >38.2%; volume stays elevated; lasts >3 weeks; breakout opposes flagpole.
- Tight/rapid convergence → more imminent, forceful breakout.

### False positives
- No flagpole → it is a symmetrical triangle, not a pennant.
- Duration >3–4 weeks (loses "brief pause" character).
- Retrace >50% of flagpole (momentum absorbed).
- Elevated volume during formation (active trading, may reverse).
- Counter-flagpole breakout → treat skeptically, needs very strong volume.
- Clearly asymmetric trendlines (one much steeper) → may be flag or wedge.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the pennant trendline value at the breakout/breakdown point (the upper trendline for a bull pennant, the lower for a bear pennant), extremeLevel: the flagpole's start price, direction: 'up' for a bull pennant, 'down' for a bear pennant, invalidationLevel: the opposite pennant trendline, or the most recent swing high/low within the pennant }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: flagpole base, flagpole end, pennant upper trendline, pennant lower trendline.
- patternSummaries: type (Bull/Bear); status (flagpole formed / pennant forming / breakout confirmed); flagpole move %; retracement depth vs flagpole; convergence tightness; duration; note distinction from Symmetrical Triangle.
- Volume context: high on flagpole, dramatic decline during pennant (quantify % drop), surge on breakout.
- Completion status: forming vs confirmed by close outside trendline in flagpole direction.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- trend: bullish (Bull) / bearish (Bear) when confirmed.
<!-- PROMPT_DIGEST:END -->
