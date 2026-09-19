---
name: 대칭삼각형
description: 하락하는 저항선과 상승하는 지지선이 수렴하는 중립 연속 패턴
type: pattern
category: neutral
pattern: symmetrical_triangle
indicators: []
confidence_weight: 0.65
display:
  chart:
    show: true
    type: line
    color: "#78909c"
    label: "추세선"
gating:
  tier: gated
  signal_kind: event
  triggers: [symmetrical_triangle]
token_cost: 758
digest_hash: "33b3f763"
---

## Detection Criteria

- A descending resistance trendline must be present, connecting at least 2 progressively lower highs.
- An ascending support trendline must be present, connecting at least 2 progressively higher lows.
- The two trendlines must converge — lower highs and higher lows compress the price range toward an apex.
- The pattern requires a minimum of 15 bars for structural validity.
- Both trendlines must have meaningful slopes — if either is nearly horizontal (slope < 1%), the pattern is an ascending or descending triangle instead.
- A prior trend must exist before the pattern forms, as symmetrical triangles are continuation patterns.
- The pattern is confirmed when price decisively closes outside either trendline.

## Confidence Weight Rationale

confidence_weight: 0.65 — Symmetrical Triangle is a neutral pattern that breaks in the direction of the prior trend approximately 65-70% of the time. The lower confidence weight reflects this inherent directional ambiguity — unlike ascending or descending triangles with their built-in bias, the symmetrical triangle provides no directional edge on its own. Its value comes primarily from the volatility compression signal and must be combined with trend context for directional assessment.

Factors that increase confidence:
- Strong prior trend present before the triangle
- 3+ touches on each trendline
- Clear volume decline as the triangle narrows
- Breakout in the first 2/3 of the triangle (measured to projected apex)
- Breakout direction aligns with the prior trend

Factors that decrease confidence:
- No clear prior trend (range-bound market)
- Fewer than 2 touches per trendline
- Breakout near or past the apex
- Breakout direction opposes the prior trend
- High volume maintained during the pattern without resolution

## Key Signals

- **Volume contraction**: Volume should decline progressively as the triangle narrows. This is the primary indicator that a decisive breakout is approaching — the compression of both price and volume precedes expansion.
- **Breakout with volume surge**: A close outside either trendline accompanied by a significant volume increase confirms the directional move. Low-volume breakouts are prone to reversal.
- **Prior trend alignment**: The breakout is most reliable when it occurs in the direction of the trend that preceded the triangle formation. A breakout against the prior trend requires stronger volume confirmation.
- **Optimal breakout zone**: Breakouts occurring between the 50% and 75% mark of the triangle (measured from start to projected apex) are statistically the most reliable. Breakouts too early may be premature; too late offers insufficient measured move potential.
- **Momentum buildup**: RSI or MACD showing a trend within the triangle (even while price consolidates) can foreshadow the breakout direction.

## False Positive Conditions

- **Apex breakout**: Breakouts occurring at or past the apex have minimal measured move potential and high failure rates. The pattern essentially expires near its apex.
- **No prior trend**: Without a preceding trend, the symmetrical triangle loses its continuation bias and becomes a coin-flip pattern. Check for a clear prior move of at least 10% before the pattern began.
- **Low-volume breakout**: A breakout without volume confirmation is unreliable. Price often reverses back into the triangle, creating a false breakout trap.
- **Whipsaw in narrow range**: As the triangle narrows, small moves can breach a trendline intraday without confirming a true breakout. Wait for a closing break.
- **Confusion with wedge**: If one trendline has a significantly steeper slope than the other, the pattern may be a wedge (ascending or descending) rather than a symmetrical triangle. Both trendlines should converge at roughly equal rates.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the broken trendline's value at the breakout bar (the upper trendline for an upside break, the lower for a downside break); `extremeLevel` = the opposite trendline's value at the pattern's start (its widest point); `direction` = 'up' or 'down', matching the breakout side; `invalidationLevel` = the opposite trendline's current (last-bar) value. When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The opposite trendline from the breakout direction serves as the invalidation level. For an upward breakout, the ascending support trendline is the stop reference. For a downward breakdown, the descending resistance trendline is the stop reference.
- **Direction uncertainty**: When the breakout direction is uncertain, the triangle itself signals an impending volatility expansion — prepare for both scenarios.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the current upper trendline value, current lower trendline value, and the projected apex price.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / broken upward / broken downward), the convergence rate, number of trendline touches on each side, position within the triangle (early, mid, late), and the prior trend direction that informs the likely breakout direction.
- **Volume context**: State whether volume is declining as expected during formation and whether a volume surge confirmed the breakout. Note the volume level relative to the recent average.
- **Completion status**: Clearly indicate whether the triangle is still forming, which breakout direction is more likely based on the prior trend, or confirmed by a close outside a trendline.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
대칭삼각형 (Symmetrical Triangle) — neutral continuation, confidence_weight 0.65. Breaks in prior-trend direction ~65–70% of the time.

### Detection
- Descending resistance trendline connecting ≥2 progressively lower highs.
- Ascending support trendline connecting ≥2 progressively higher lows.
- Two trendlines converge toward an apex (range compresses).
- Minimum 15 bars for validity.
- Both trendlines need meaningful slopes — if either nearly horizontal (slope <1%) it is an ascending/descending triangle instead.
- Prior trend must exist (continuation pattern).
- Confirmed when price decisively CLOSES outside either trendline.

### Grading
- Increase: strong prior trend; 3+ touches per trendline; clear volume decline as triangle narrows; breakout in first 2/3 (to projected apex); breakout aligns with prior trend.
- Decrease: no clear prior trend (range-bound); <2 touches per trendline; breakout near/past apex; breakout opposes prior trend; high volume maintained without resolution.
- Optimal breakout zone = 50%–75% of triangle (start→projected apex); too early premature, too late insufficient move.
- Volume contraction as it narrows is the primary tell that a decisive breakout nears.

### False positives
- Apex breakout (at/past apex): minimal measured move, high failure — pattern expires near apex.
- No prior trend → coin-flip; require prior move ≥10% before pattern.
- Low-volume breakout → often reverses (false-breakout trap).
- Narrow-range whipsaw: intraday breach without close → wait for closing break.
- One trendline much steeper than the other → wedge, not symmetrical triangle (should converge at ~equal rates).

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the broken trendline's value at the breakout bar (the upper trendline for an upside break, the lower for a downside break), extremeLevel: the opposite trendline's value at the pattern's start (its widest point), direction: 'up' or 'down', matching the breakout side, invalidationLevel: the opposite trendline's current (last-bar) value }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: current upper trendline, current lower trendline, projected apex.
- patternSummaries: status (forming / approaching apex / broken up / broken down); convergence rate; touches per side; position in triangle (early/mid/late); prior trend direction (informs likely breakout).
- Volume context: declining during formation? surge confirmed breakout? volume vs recent average.
- Completion status: forming vs which direction more likely (prior trend) vs confirmed by close outside a trendline.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- trend: neutral until breakout; set by realized breakout direction.
<!-- PROMPT_DIGEST:END -->
