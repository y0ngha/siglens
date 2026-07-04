---
name: 상승삼각형
description: 수평 저항선과 상승하는 지지 추세선이 수렴하는 강세 연속 패턴
type: pattern
category: continuation_bullish
pattern: ascending_triangle
indicators: []
confidence_weight: 0.75
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
token_cost: 601
digest_hash: "1b764299"
---

## Detection Criteria

- A horizontal resistance line must be present, with at least 2 touches at approximately the same price level (within 1%).
- An ascending support trendline must be present, connecting at least 2 progressively higher lows.
- Price must be converging within the triangle — the range between the resistance and the rising support narrows over time.
- The pattern requires a minimum of 15 bars for structural validity.
- The horizontal resistance must be clearly flat (slope < 1%), distinguishing this from a symmetrical triangle.
- The ascending trendline must show a clear upward slope with each successive low being meaningfully higher than the previous one.
- The pattern is confirmed when price closes above the horizontal resistance with increased volume.

## Confidence Weight Rationale

confidence_weight: 0.75 — Ascending Triangle is one of the more reliable bullish continuation patterns. Bulkowski's Encyclopedia of Chart Patterns reports an upside breakout rate near 70% with a success rate (target reached) in the 75–87% range depending on market context. The horizontal resistance provides a clear, objective breakout level, and repeated higher lows pressing against a flat resistance reflect persistent buying pressure. The 0.75 weight places it on par with Descending Triangle's bearish mirror at a slightly more conservative level, acknowledging the subjectivity in drawing the ascending trendline compared to the perfectly horizontal support on its bearish counterpart.

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

- **Breakdown instead of breakout**: Approximately 25% of ascending triangles break downward. If price closes below the ascending trendline, the bullish thesis is invalidated.
- **Apex breakout**: Breakouts occurring very close to or past the apex point have significantly reduced reliability and measured move potential.
- **No volume confirmation**: A breakout above resistance without a volume surge may be a false breakout. Price may quickly reverse back inside the triangle.
- **Flat market context**: If there is no prior trend and the ascending triangle forms in a choppy market, the directional bias is weakened.
- **Premature breakout**: An intraday wick above resistance without a closing break is not confirmation.
- **Resistance slope too steep**: If the "resistance" line has a slope > 1%, the pattern may be a rising channel rather than an ascending triangle.

## Entry/Exit Considerations

- **Target price calculation**: Measure the height of the triangle at its widest point (the vertical distance from the horizontal resistance to the lowest point of the ascending trendline at the pattern start). Project this distance upward from the breakout point. Example: if resistance is at $100 and the triangle starts with a low of $90, the target is $110 ($100 + $10).
- **Risk/reward assessment**: The distance from current price to target versus the distance from current price to the ascending trendline defines the risk/reward ratio. A ratio of at least 2:1 is analytically favorable.
- **Stop-loss reference level**: The most recent higher low on the ascending trendline or the trendline itself serves as the invalidation level. A close below this negates the bullish pattern.
- **Partial target**: 50% of the triangle height serves as a conservative initial target.
- **Breakdown scenario**: If price closes below the ascending trendline, the bearish target is the full triangle height projected downward from the breakdown point.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the horizontal resistance level, the current ascending trendline value, the projected apex price, and the breakout target price if resistance is broken.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / resistance broken / trendline broken), the number of touches on resistance and support, the breakout position relative to the apex (early, mid, late), and the prior trend direction.
- **Volume context**: State whether volume is contracting as expected during formation and whether a volume surge accompanied any breakout or breakdown.
- **Completion status**: Clearly indicate whether the triangle is still forming or confirmed by a decisive close above the horizontal resistance.
- **Target projection**: Calculate and state the measured move target using the triangle height projected from the breakout point.

<!-- PROMPT_DIGEST:START -->
### Ascending Triangle (bullish continuation)

Geometry:
- Horizontal resistance line: ≥2 touches at ~same price (within 1%); slope must be < 1% (else it's a rising channel/symmetrical triangle).
- Ascending support trendline: ≥2 progressively higher lows, clear upward slope.
- Price converges (range narrows) toward apex. Minimum 15 bars.

Confirmation: close ABOVE horizontal resistance with increased volume (surge 50%+ above average). Intraday wick above resistance without a close = not confirmed. Volume should decline as triangle narrows. Post-breakout: a pullback to the former resistance that holds as support confirms the pattern. Accelerating higher lows on the ascending support trendline = intensifying buying pressure.

Confidence (weight 0.75): upside breakout ~70%, target reached 75–87%.
- Increase: 3+ touches on resistance, 3+ on support, declining volume, breakout in first 2/3 of triangle (between 50%–75% point most reliable), prior uptrend.
- Decrease: <2 touches either line, breakout near/past apex, no prior trend, volume rising without breakout, only marginal higher lows.

False positives / invalidation:
- ~25% break downward; close below ascending trendline invalidates bullish thesis.
- Apex/near-apex breakout = reduced reliability & target.
- Breakout without volume surge may be false.

Target: triangle height = vertical distance from horizontal resistance to lowest point of ascending trendline at pattern start; project UP from breakout point (e.g., resistance $100, start low $90 → target $110). Partial target = 50% of height. Breakdown scenario: close below ascending trendline → bearish target = full height projected DOWN from breakdown.
Stop/invalidation: most recent higher low on ascending trendline (or the trendline). R/R ≥ 2:1 favorable.

Output:
- keyPrices: horizontal resistance, current ascending trendline value, projected apex price, breakout target (if broken).
- patternSummaries: status (forming / approaching apex / resistance broken / trendline broken), touch counts on resistance & support, breakout position vs apex (early/mid/late), prior trend direction.
- Volume context: contraction during formation; volume surge on breakout/breakdown.
- Completion status: forming vs confirmed (decisive close above resistance).
- Target projection: measured move from breakout point.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
