---
name: 상승쐐기
description: 고점과 저점이 모두 상승하지만 폭이 좁아지는 형태로 하락 반전 신호
type: pattern
category: continuation_bearish
pattern: ascending_wedge
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "추세선"
gating:
  tier: gated
  signal_kind: event
  triggers: [ascending_wedge]
token_cost: 620
digest_hash: "e706e682"
---

## Detection Criteria

- Both highs and lows must be rising, forming a series of higher highs and higher lows.
- The upper trendline (connecting highs) and lower trendline (connecting lows) must converge, meaning the range between highs and lows narrows over time.
- A minimum of 3 touches on each trendline (3 highs and 3 lows) is required for structural validity.
- The lower trendline must have a steeper slope than the upper trendline for the convergence to be valid.
- The convergence ratio (narrowing of the range from start to end) should be at least 30% for the pattern to be meaningful.
- The pattern requires a minimum of 15 bars for structural validity.
- A break below the lower trendline confirms the bearish reversal signal.

## Confidence Weight Rationale

confidence_weight: 0.7 — Ascending Wedge has a lower confidence weight than Head and Shoulders (0.8) or Double Top (0.75) because the breakout direction is statistically less predictable. While ascending wedges predominantly break downward, the absence of a clear neckline or defined reversal point makes timing and confirmation more ambiguous. The converging trendlines can also be subjective in their placement, introducing detection variability.

Factors that increase confidence:
- Clear convergence with at least 4 touches per trendline
- Consistent volume decline as the wedge narrows
- Decisive break below lower trendline with volume surge
- Pattern duration > 25 bars

Factors that decrease confidence:
- Fewer than 3 touches per trendline
- No volume decline during pattern formation
- Break occurs near the apex (less room for measured move)
- Ambiguous convergence (trendlines nearly parallel)

## Key Signals

- **Decreasing volume**: Volume should progressively decline as the wedge narrows. This indicates diminishing momentum despite rising prices, a hallmark of an unsustainable advance.
- **Break below lower trendline**: A decisive close below the lower trendline confirms the bearish reversal. The break should occur in the first two-thirds of the wedge (measured from start to projected apex) for maximum reliability.
- **Volume surge on breakdown**: A significant increase in volume accompanying the trendline break confirms selling pressure and validates the reversal signal.
- **Momentum divergence**: RSI or MACD showing bearish divergence (declining indicator values while prices continue to rise within the wedge) strengthens the reversal signal.

## False Positive Conditions

- **Parallel channel confusion**: If the upper and lower trendlines have nearly equal slopes (convergence < 15%), the pattern is a rising channel, not a wedge. Channels have different continuation/reversal implications.
- **Insufficient convergence**: If the range narrows by less than 30% from the pattern start to the current position, the wedge structure is not well-defined.
- **Fewer than 3 trendline touches**: Without sufficient touches, the trendlines are statistically unreliable and the pattern identification is premature.
- **Strong fundamental catalyst**: An ascending wedge forming during a period of strong earnings or sector rotation may break upward instead of the typical downward resolution.
- **Break near the apex**: If the break occurs very close to the apex (last 10% of the wedge), the measured move potential is minimal and the signal is less actionable.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the lower (support) trendline's value at the breakdown bar; `extremeLevel` = the upper (resistance) trendline's value at the pattern's start (its widest point); `direction` = 'down'; `invalidationLevel` = the upper trendline's current (last-bar) value — the most recent swing high within the wedge. When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The most recent swing high within the wedge or the upper trendline serves as the invalidation level. A close above this level negates the bearish pattern.
- **Breakout timing**: Breaks that occur in the first half to two-thirds of the wedge (before reaching the apex) tend to produce stronger moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the current upper and lower trendline values, and the projected apex price and bar.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / lower trendline broken), the convergence rate, number of trendline touches, and position within the wedge (early, mid, late).
- **Volume context**: State whether volume is declining as expected within the wedge and whether a volume surge accompanied any trendline break.
- **Completion status**: Clearly indicate whether the wedge is still forming or confirmed by a close below the lower trendline.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Ascending Wedge (bearish reversal)

Geometry:
- Both highs and lows rising (higher highs + higher lows).
- Upper trendline (highs) and lower trendline (lows) converge (range narrows). Lower trendline must be STEEPER than upper for valid convergence.
- ≥3 touches on each trendline (3 highs, 3 lows). Convergence ratio ≥30% (narrowing from start to end). Minimum 15 bars.
- Confirmed by break BELOW lower trendline.

Confidence (weight 0.7): predominantly breaks downward but direction less predictable (no clear neckline).
- Increase: clear convergence with 4+ touches per line, consistent volume decline as wedge narrows, decisive break below lower trendline with volume surge, duration > 25 bars.
- Decrease: <3 touches per line, no volume decline, break near apex, ambiguous convergence (trendlines near parallel).

Signals: declining volume during formation (bearish divergence RSI/MACD strengthens); break should occur in first 2/3 of wedge for max reliability; volume surge on breakdown confirms.

False positives / invalidation:
- Convergence < 15% (near-equal slopes) = rising channel, not wedge.
- Narrowing < 30% = wedge not well-defined.
- <3 touches = premature.
- Strong fundamental catalyst may break upward.
- Break in last 10% of wedge (near apex) = minimal target.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the lower (support) trendline's value at the breakdown bar, extremeLevel: the upper (resistance) trendline's value at the pattern's start (its widest point), direction: 'down', invalidationLevel: the upper trendline's current (last-bar) value — the most recent swing high within the wedge }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: current upper & lower trendline values, projected apex price & bar.
- patternSummaries: status (forming / approaching apex / lower trendline broken), convergence rate, touch counts, position (early/mid/late).
- Volume context: declining within wedge; surge on break.
- Completion status: forming vs confirmed (close below lower trendline).
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
