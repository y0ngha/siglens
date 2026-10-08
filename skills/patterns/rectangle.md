---
name: 직사각형
description: 수평 지지선과 저항선 사이에서 횡보하는 연속 또는 반전 패턴
type: pattern
category: neutral
pattern: rectangle
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#78909c"
    label: "지지/저항선"
gating:
  tier: gated
  signal_kind: event
  triggers: [rectangle]
token_cost: 922
digest_hash: "9a1788f5"
---

## Detection Criteria

- A horizontal resistance line must be present, with at least 2 touches at approximately the same price level (within 2%).
- A horizontal support line must be present, with at least 2 touches at approximately the same price level (within 2%).
- Both lines must be clearly horizontal (slope < 1.5%), distinguishing this from a channel or wedge.
- The vertical distance between support and resistance must be at least 3% of the support price to constitute a meaningful range.
- Price must oscillate between support and resistance with clear bounces — not a gradual drift.
- The pattern requires a minimum of 15 bars for structural validity.
- A prior trend must exist before the rectangle forms, establishing it as either a continuation (Rectangle Top in uptrend, Rectangle Bottom in downtrend) or potential reversal.
- The pattern is confirmed when price decisively closes outside either boundary with increased volume.
- Engine rule: boundary lines through at least 3 confirmed-pivot touches per side (two per side would also fit a triple top/bottom), each containing every bar of the pattern within 0.25 ATR; a line is flat when it moves no more than min(0.75 ATR, 1.5% of price) over the span. Minimum 15 bars, and a height of at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars).

## Rectangle Top vs Rectangle Bottom

- **Rectangle Top**: Forms after an uptrend. The horizontal resistance represents a ceiling where the prior advance stalls. If price breaks upward through resistance, the uptrend continues. If it breaks downward through support, the trend reverses.
- **Rectangle Bottom**: Forms after a downtrend. The horizontal support represents a floor where the prior decline stalls. If price breaks downward through support, the downtrend continues. If it breaks upward through resistance, the trend reverses.

## Confidence Weight Rationale

confidence_weight: 0.7 — Bulkowski (thepatternsite.com/recttops.html and rectbots.html, bull market): breakouts are upward 63% of the time for Rectangle Tops and 59% for Rectangle Bottoms — not a coin flip. Break-even failure rates: Tops 15% (up) / 34% (down), Bottoms 15% (up) / 24% (down); 78% / 79% of upward breakouts meet the price target; performance rank 4 of 39 (Tops, up) and 8 of 39 (Bottoms, up). Weight: median of the four variant failure rates (19.5%) → 11–20% → 0.7. Downward breakouts are clearly weaker (Tops rank 32 of 36 down), so weight a downside break less. The pattern's value lies in its clear, objective boundaries and well-defined risk parameters.

Factors that increase confidence:
- 3+ touches on both support and resistance
- Volume declining during the pattern with a surge on breakout
- Breakout direction aligns with the prior trend
- Pattern duration > 20 bars (more established boundaries)
- Previous trend was strong and well-defined

Factors that decrease confidence:
- Fewer than 2 touches on either boundary
- High, erratic volume during the pattern
- No clear prior trend
- Boundaries are not horizontal (sloping channel instead)
- Multiple false breakouts have already occurred

## Key Signals

- **Volume contraction during formation**: Volume should gradually decline as the rectangle develops. This compression precedes a decisive breakout. Sustained high volume within the range suggests ongoing distribution or accumulation.
- **Breakout with volume surge**: A close outside the rectangle boundary accompanied by significantly increased volume confirms the directional move. This is the most critical signal — low-volume breakouts often fail.
- **Touch count reliability**: More touches on support and resistance increase the significance of a breakout. However, too many touches (> 6-7) without resolution may indicate the pattern is "stale" and losing energy.
- **Prior trend context**: Upward breakouts dominate regardless of the prior trend (Bulkowski: Tops 63%, Bottoms 59% upward) — a Rectangle Top usually continues up, while a Rectangle Bottom more often reverses up than continues down. Upward breakouts also perform far better than downward ones.
- **Accumulation/Distribution signals**: In Rectangle Tops, check for accumulation signs (higher volume on bounces from support). In Rectangle Bottoms, check for distribution signs (higher volume on rejections from resistance).

## False Positive Conditions

- **False breakout**: The most common failure mode. Price briefly closes outside the rectangle then reverses back inside. Wait for a second consecutive close outside the boundary, or require a meaningful extension (1-2% beyond the boundary).
- **Sloped boundaries**: If either the support or resistance line has a slope > 1.5%, the pattern is a channel or wedge, not a rectangle. These have different breakout characteristics.
- **Too narrow range**: If the rectangle height is less than 3% of the support price, the range is too small to produce a meaningful measured move, and breakout noise may dominate.
- **Declining touch quality**: If bounces from support or resistance become weaker over time (smaller bounces, quicker reversals), the boundary may be about to fail.
- **No prior trend**: Without a preceding trend, the rectangle is a range-bound market with no continuation or reversal context, reducing its predictive value.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `direction` = the prior-trend direction ('up' after a rise of at least 2 ATR in the close over the 20 bars before the pattern start, 'down' after a fall) — the computed geometry assumes continuation. `breakoutLevel` = the boundary on that side at the last bar (resistance for 'up', support for 'down'); `extremeLevel` = the breakout level minus (up) or plus (down) the rectangle height — the opposite boundary; `invalidationLevel` = the last confirmed touch of the opposite boundary (a fixed pivot price); a close back across it negates the breakout. If the candidate is printed as 'Direction: undetermined (no prior trend)', it lists both boundaries and the height only — set `geometry` to null and state no target. When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The opposite boundary's last confirmed touch (a fixed pivot price) serves as the invalidation level. For an upward breakout, support is the stop reference. For a downward breakdown, resistance is the stop reference.
- **Target reliability**: Bulkowski (recttops.html): 78% of upward breakouts from Rectangle Tops reach the full measure-rule target, but only 54% of downward breakouts — do not treat the target as a minimum expectation.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the support level and resistance level.
- **patternSummaries**: Describe the rectangle type (Top or Bottom based on prior trend), the pattern status (forming / support broken / resistance broken), the number of touches on each boundary, the rectangle height as a percentage of price, and the pattern duration. Note the prior trend direction and its implication for breakout bias.
- **Volume context**: State whether volume is declining during formation, whether volume favors one direction (accumulation or distribution), and whether a volume surge confirmed the breakout. Note any false breakout attempts.
- **Completion status**: Clearly indicate whether the rectangle is still forming or confirmed by a decisive close outside a boundary with volume confirmation.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
직사각형 (Rectangle) — continuation-or-reversal, confidence_weight 0.7. Horizontal support/resistance range; Bulkowski recttops/rectbots.html: breaks up 59–63%, up-breakout failure 15% (down 24–34%).

### Detection
- Horizontal resistance: ≥2 touches at ~same price (within 2%).
- Horizontal support: ≥2 touches at ~same price (within 2%).
- Both lines clearly horizontal (slope <1.5%) — else channel/wedge, not rectangle.
- Support-to-resistance height ≥3% of support price (else too narrow).
- Price oscillates with clear bounces (not gradual drift). Minimum 15 bars.
- Prior trend must exist → Rectangle Top (uptrend) or Rectangle Bottom (downtrend).
- Confirmed by decisive CLOSE outside either boundary with increased volume.
- Engine: ≥3 confirmed-pivot touches per side, bars contained within 0.25 ATR; flat = moves ≤min(0.75 ATR, 1.5% price) over the span; height ≥2.5 ATR and the price-share minimum.

### Top vs Bottom
- Rectangle Top: after uptrend; break UP through resistance = continuation, break DOWN through support = reversal.
- Rectangle Bottom: after downtrend; break DOWN through support = continuation, break UP through resistance = reversal.

### Grading
- Increase: 3+ touches on both boundaries; volume declining during pattern with break surge; breakout aligns with prior trend; duration >20 bars; strong prior trend.
- Decrease: <2 touches on either boundary; high/erratic volume; no clear prior trend; sloping boundaries; prior false breakouts.
- Up-breaks dominate (Bulkowski: Tops 63%, Bottoms 59%) — Tops usually continue up, Bottoms more often reverse up; down-breaks perform worse.
- Too many touches (>6–7) without resolution → pattern stale, losing energy.
- Accumulation (higher volume on support bounces) in Tops; distribution (higher volume on resistance rejections) in Bottoms.

### False positives
- False breakout (most common): brief close outside then back in. Require a 2nd consecutive close outside OR 1–2% extension beyond boundary.
- Either boundary slope >1.5% → channel/wedge, not rectangle.
- Height <3% of support price (breakout noise dominates).
- Weakening bounces over time → boundary about to fail.
- No prior trend → range-bound, reduced predictive value.

### Geometry (do not calculate targets)
`geometry` = { direction: the prior-trend direction (≥2 ATR close change over the 20 bars before the pattern), breakoutLevel: the boundary on that side at the last bar (resistance for up, support for down), extremeLevel: the opposite boundary (breakout ∓ height), invalidationLevel: the last confirmed touch of the opposite boundary; a close back across it negates the breakout }. If the candidate says 'Direction: undetermined (no prior trend)', set geometry to null (no target). Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: support, resistance.
- patternSummaries: type (Top/Bottom by prior trend); status (forming / support broken / resistance broken); touches per boundary; height as % of price; duration; prior trend + breakout bias.
- Volume context: declining during formation? favors accumulation/distribution? break surge? note false-breakout attempts.
- Completion status: forming vs confirmed by decisive close outside a boundary with volume.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- trend: set by realized breakout direction (bullish up-break, bearish down-break); neutral while forming.
<!-- PROMPT_DIGEST:END -->
