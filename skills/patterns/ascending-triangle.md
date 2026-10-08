---
name: 상승삼각형
description: 수평 저항선과 상승하는 지지 추세선이 수렴하는 강세 연속 패턴
type: pattern
category: continuation_bullish
pattern: ascending_triangle
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "저항선"
gating:
  tier: gated
  signal_kind: event
  triggers: [ascending_triangle]
token_cost: 902
digest_hash: "0b501590"
---

## Detection Criteria

- A horizontal resistance line must be present, with at least 2 touches at approximately the same price level (within 1%).
- An ascending support trendline must be present, connecting at least 2 progressively higher lows.
- Price must be converging within the triangle — the range between the resistance and the rising support narrows over time.
- The pattern requires a minimum of 15 bars for structural validity.
- The horizontal resistance must be clearly flat (slope < 1%), distinguishing this from a symmetrical triangle.
- The ascending trendline must show a clear upward slope with each successive low being meaningfully higher than the previous one.
- The pattern is confirmed when price closes above the horizontal resistance with increased volume.
- Engine rule: boundary lines through confirmed swing pivots — the best window of the last 8 down to 5 pivots (the one whose pivots touch their lines most often), grown back to at most 16 pivots while it stays the same pattern and keeps every touch — each line containing every bar of the pattern within 0.25 ATR (a pivot within 0.35 ATR of a line touches it), never a regression fit, and the two lines must interleave (each keeps at least 2 touches from the other line's first touch on). The upper line is flat (moves no more than min(0.75 ATR, 1% of price) over the span) and the lower line rises at least 1.5 ATR (a move in between is not drawn), each with at least 2 touches, and the end width is at most 0.7× the start width. Direction is fixed: up. Minimum 15 bars, and a height (width at the first touch) of at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars). The chart draws each line solid from its first to its last confirmed touch and continues it dashed to the bar where the printed value is read (the last bar for the breakout-side line). Status `failed breakout`: after the breakout line's last touch a close went beyond it by more than 0.25 ATR and the last close is back inside — the pattern stays listed and drawn (its structure is intact) but price already broke the line once and came back, so report the breakout as failed and unconfirmed, not as a plain untested `forming` and not as a confirmed break (`broken` means the last close is outside).

## Confidence Weight Rationale

confidence_weight: 0.7 — Bulkowski (thepatternsite.com/at.html, bull market): breakout upward 63% of the time; break-even failure rate 17% for upward / 38% for downward breakouts; 70% / 44% meet the price target; performance rank 16 of 39 (up) / 30 of 36 (down). Weight follows the upward (primary-direction) failure rate: 11–20% → 0.7. The horizontal resistance provides a clear, objective breakout level, and repeated higher lows pressing against a flat resistance reflect persistent buying pressure — but over a third of these triangles still break down, so treat the bias as a lean, not a certainty.

Factors that increase confidence:
- 3+ touches on the horizontal resistance
- 3+ touches on the ascending support line
- Volume declining as the triangle narrows
- Breakout occurring in the first 2/3 of the triangle (before the apex)
- Prior uptrend present before the pattern formed

Factors that decrease confidence:
- Fewer than 2 touches on either line
- Breakout near or past the apex of the triangle
- No prior trend (pattern forming in a range-bound market)
- Volume increasing during the pattern without breakout
- Ascending trendline with only marginal higher lows

## Key Signals

- **Volume contraction during formation**: Volume should progressively decline as the triangle narrows. This compression indicates equilibrium between buyers and sellers before a decisive move.
- **Resistance breakout with volume surge**: A close above the horizontal resistance accompanied by significantly increased volume (50%+ above average) confirms the bullish breakout.
- **Rising lows acceleration**: If the ascending support trendline shows accelerating higher lows (the rate of increase steepens), buying pressure is intensifying.
- **Breakout timing**: Breakouts that occur between the 50% and 75% point of the triangle (measured from start to projected apex) are statistically the most reliable.
- **Retest of resistance as support**: After the breakout, a pullback to the former resistance level that holds as support confirms the pattern.

## False Positive Conditions

- **Breakdown instead of breakout**: Over a third of ascending triangles break downward (Bulkowski at.html: upward only 63%), and those downward breakouts perform poorly (failure 38%). If price closes below the ascending trendline, the bullish thesis is invalidated.
- **Apex breakout**: Breakouts occurring very close to or past the apex point have significantly reduced reliability and measured move potential.
- **No volume confirmation**: A breakout above resistance without a volume surge may be a false breakout. Price may quickly reverse back inside the triangle.
- **Flat market context**: If there is no prior trend and the ascending triangle forms in a choppy market, the directional bias is weakened.
- **Premature breakout**: An intraday wick above resistance without a closing break is not confirmation.
- **Resistance slope too steep**: If the "resistance" line has a slope > 1%, the pattern may be a rising channel rather than an ascending triangle.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the flat resistance trendline's value at the last bar; `extremeLevel` = the breakout level minus the triangle height (the width between the two trendlines at the first touch — their widest point); `direction` = 'up'; `invalidationLevel` = the last confirmed touch of the ascending support line — the most recent higher low, a fixed swing-low price (not the trendline's current value). Copy these values from `## Chart Pattern Candidates (computed)` only when this pattern instance is listed there (set its Candidate id as candidateId); when it is not listed, you may still name and describe the pattern, but `geometry` is null and candidateId is empty — only listed patterns carry levels and targets. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The most recent confirmed higher low (the last touch of the ascending trendline) serves as the invalidation level — a fixed price. A close below this negates the bullish pattern.
- **Breakdown scenario**: If price closes below the ascending trendline instead, treat the pattern as having failed/reversed to bearish — this alternate scenario is not in `## Chart Pattern Candidates (computed)`, so do not compute a target for it yourself; describe the reversal qualitatively.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the horizontal resistance level, the current ascending trendline value, and the projected apex price.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / resistance broken / trendline broken), the number of touches on resistance and support, the breakout position relative to the apex (early, mid, late), and the prior trend direction.
- **Volume context**: State whether volume is contracting as expected during formation and whether a volume surge accompanied any breakout or breakdown.
- **Completion status**: Clearly indicate whether the triangle is still forming or confirmed by a decisive close above the horizontal resistance.
- **geometry**: For a listed pattern instance (with a Candidate id), fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. For an unlisted pattern, `geometry` is null and candidateId is empty. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Ascending Triangle (bullish continuation)

Geometry:
- Horizontal resistance line: ≥2 touches at ~same price (within 1%); slope must be < 1% (else it's a rising channel/symmetrical triangle).
- Ascending support trendline: ≥2 progressively higher lows, clear upward slope.
- Price converges (range narrows) toward apex. Minimum 15 bars.
- Engine: lines through confirmed pivots (window 8→5 pivots, grown back to ≤16 while all touches kept), bars contained within 0.25 ATR, touch = within 0.35 ATR, lines interleave (≥2 touches each from the other's first touch); flat upper (≤min(0.75 ATR, 1% price) move) + lower rising ≥1.5 ATR (in between = not drawn), ≥2 touches each, end width ≤0.7× start; direction fixed up; ≥15 bars; height ≥2.5 ATR and the price-share minimum. Lines drawn solid first→last touch, dashed to the bar the printed value is read. Status `failed breakout` = a close beyond the breakout line by >0.25 ATR after its last touch, last close back inside: structure intact but the break failed — not plain `forming`, not a confirmed break (`broken` = last close outside).

Confirmation: close ABOVE horizontal resistance with increased volume (surge 50%+ above average). Intraday wick above resistance without a close = not confirmed. Volume should decline as triangle narrows. Post-breakout: a pullback to the former resistance that holds as support confirms the pattern. Accelerating higher lows on the ascending support trendline = intensifying buying pressure.

Confidence (weight 0.7) — Bulkowski at.html: breaks up 63%; up-breakout failure 17% (down 38%); 70% of up breakouts meet target; rank 16/39.
- Increase: 3+ touches on resistance, 3+ on support, declining volume, breakout in first 2/3 of triangle (between 50%–75% point most reliable), prior uptrend.
- Decrease: <2 touches either line, breakout near/past apex, no prior trend, volume rising without breakout, only marginal higher lows.

False positives / invalidation:
- Over a third break downward (up only 63%); close below ascending trendline invalidates bullish thesis.
- Apex/near-apex breakout = reduced reliability & target.
- Breakout without volume surge may be false.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the flat resistance trendline at the last bar, extremeLevel: breakout minus the triangle height (width at the first touch, the widest point), direction: 'up', invalidationLevel: the last confirmed touch of the ascending support line — the most recent higher low, a fixed price }. Copy from `## Chart Pattern Candidates (computed)` only when this instance is listed there (with its Candidate id); when not listed, the pattern may be described but `geometry` is null and candidateId empty. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: horizontal resistance, current ascending trendline value, projected apex price.
- patternSummaries: status (forming / approaching apex / resistance broken / trendline broken), touch counts on resistance & support, breakout position vs apex (early/mid/late), prior trend direction.
- Volume context: contraction during formation; volume surge on breakout/breakdown.
- Completion status: forming vs confirmed (decisive close above resistance).
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R; only for a listed instance, else `geometry` null and candidateId empty.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
