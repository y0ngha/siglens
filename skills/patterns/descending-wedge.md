---
name: 하락쐐기
description: 고점과 저점이 모두 하락하지만 폭이 좁아지는 형태로 상승 반전 신호
type: pattern
category: continuation_bullish
pattern: descending_wedge
indicators: []
confidence_weight: 0.6
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "추세선"
gating:
  tier: gated
  signal_kind: event
  triggers: [descending_wedge]
token_cost: 646
digest_hash: "1617733b"
---

## Detection Criteria

- Both highs and lows must be falling, forming a series of lower highs and lower lows.
- The upper trendline (connecting highs) and lower trendline (connecting lows) must converge, meaning the range between highs and lows narrows over time.
- A minimum of 3 touches on each trendline (3 highs and 3 lows) is required for structural validity.
- The upper trendline must have a steeper slope than the lower trendline for the convergence to be valid.
- The convergence ratio (narrowing of the range from start to end) should be at least 30% for the pattern to be meaningful.
- The pattern requires a minimum of 15 bars for structural validity.
- A break above the upper trendline confirms the bullish reversal signal.
- Engine rule: boundary lines through confirmed swing pivots (at least 3 touches per side, containing every bar of the pattern within 0.25 ATR); both lines falling by at least 1.5 ATR over the span and the end width is at most 0.7× the start width. A pair with a width ratio between 0.7 and 0.85, or with a line moving less than 1.5 ATR, is not drawn; a near-parallel pair (0.85–1.15×) is a channel instead. Minimum 15 bars.

## Confidence Weight Rationale

confidence_weight: 0.6 — Bulkowski (thepatternsite.com/fallwedge.html, bull market): breakouts are upward 68% of the time; break-even failure rate 26% (up) / 29% (down); 62% of upward breakouts meet the price target; performance rank 31 of 39 (up) — "a poor performer as far as bullish chart patterns go." Weight follows the upward (primary-direction) failure rate: 21–30% → 0.6. Trendline placement can be subjective, introducing detection variability.

Factors that increase confidence:
- Clear convergence with at least 4 touches per trendline
- Volume decline during pattern formation followed by surge on breakout
- Decisive break above upper trendline with volume surge
- Pattern duration > 25 bars

Factors that decrease confidence:
- Fewer than 3 touches per trendline
- No volume pattern during formation
- Break occurs near the apex (less room for measured move)
- Ambiguous convergence (trendlines nearly parallel)

## Key Signals

- **Decreasing volume during formation**: Volume should progressively decline as the wedge narrows. This indicates selling pressure is exhausting despite falling prices.
- **Break above upper trendline**: A decisive close above the upper trendline confirms the bullish reversal. The break should occur in the first two-thirds of the wedge (measured from start to projected apex) for maximum reliability.
- **Volume surge on breakout**: A significant increase in volume accompanying the trendline break confirms buying pressure and validates the reversal signal.
- **Momentum divergence**: RSI or MACD showing bullish divergence (rising indicator values while prices continue to fall within the wedge) strengthens the reversal signal.

## False Positive Conditions

- **Parallel channel confusion**: If the upper and lower trendlines have nearly equal slopes (convergence < 15%), the pattern is a descending channel, not a wedge. Channels have different continuation/reversal implications.
- **Insufficient convergence**: If the range narrows by less than 30% from the pattern start to the current position, the wedge structure is not well-defined.
- **Fewer than 3 trendline touches**: Without sufficient touches, the trendlines are statistically unreliable and the pattern identification is premature.
- **Strong bearish catalyst**: A descending wedge forming during a period of deteriorating fundamentals or sector weakness may break downward instead of the typical upward resolution.
- **Break near the apex**: If the break occurs very close to the apex (last 10% of the wedge), the measured move potential is minimal and the signal is less actionable.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the upper (resistance) trendline's value at the last bar; `extremeLevel` = the breakout level minus the wedge height (the width between the trendlines at the first touch — their widest point); `direction` = 'up'; `invalidationLevel` = the last confirmed touch of the lower trendline — the most recent swing low, a fixed price (not the line's current value). When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The last confirmed swing low on the lower trendline serves as the invalidation level — a fixed price. A close below this level negates the bullish pattern.
- **Breakout timing**: Breaks that occur in the first half to two-thirds of the wedge (before reaching the apex) tend to produce stronger moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the current upper and lower trendline values, and the projected apex price and bar.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / upper trendline broken), the convergence rate, number of trendline touches, and position within the wedge (early, mid, late).
- **Volume context**: State whether volume is declining as expected within the wedge and whether a volume surge accompanied any trendline break.
- **Completion status**: Clearly indicate whether the wedge is still forming or confirmed by a close above the upper trendline.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Descending Wedge (bullish reversal)

Geometry:
- Both highs and lows falling (lower highs + lower lows).
- Upper trendline (highs) and lower trendline (lows) converge (range narrows). Upper trendline must be STEEPER than lower for valid convergence.
- ≥3 touches on each trendline (3 highs, 3 lows). Convergence ratio ≥30%. Minimum 15 bars.
- Confirmed by break ABOVE upper trendline.
- Engine: both lines falling ≥1.5 ATR over the span, ≥3 touches per side, end width ≤0.7× start (near-parallel = channel; in between = not drawn).

Confidence (weight 0.6) — Bulkowski fallwedge.html: breaks up 68%; up-breakout failure 26%, 62% meet target; rank 31/39.
- Increase: clear convergence with 4+ touches per line, volume decline in formation followed by surge on breakout, decisive break above upper trendline with volume surge, duration > 25 bars.
- Decrease: <3 touches per line, no volume pattern, break near apex, ambiguous convergence (near parallel).

Signals: declining volume during formation (bullish divergence RSI/MACD strengthens); break should occur in first 2/3 of wedge for max reliability; volume surge on breakout confirms.

False positives / invalidation:
- Convergence < 15% (near-equal slopes) = descending channel, not wedge.
- Narrowing < 30% = wedge not well-defined.
- <3 touches = premature.
- Strong bearish catalyst may break downward.
- Break in last 10% (near apex) = minimal target.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the upper (resistance) trendline at the last bar, extremeLevel: breakout minus the wedge height (width at the first touch, the widest point), direction: 'up', invalidationLevel: the last confirmed touch of the lower trendline — the most recent swing low, a fixed price }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: current upper & lower trendline values, projected apex price & bar.
- patternSummaries: status (forming / approaching apex / upper trendline broken), convergence rate, touch counts, position (early/mid/late).
- Volume context: declining within wedge; surge on break.
- Completion status: forming vs confirmed (close above upper trendline).
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
