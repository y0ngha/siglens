---
name: 대칭삼각형
description: 하락하는 저항선과 상승하는 지지선이 수렴하는 중립 연속 패턴
type: pattern
category: neutral
pattern: symmetrical_triangle
indicators: []
confidence_weight: 0.5
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
token_cost: 854
digest_hash: "3cc870ac"
---

## Detection Criteria

- A descending resistance trendline must be present, connecting at least 2 progressively lower highs.
- An ascending support trendline must be present, connecting at least 2 progressively higher lows.
- The two trendlines must converge — lower highs and higher lows compress the price range toward an apex.
- The pattern requires a minimum of 15 bars for structural validity.
- Both trendlines must have meaningful slopes — if either is nearly horizontal (slope < 1%), the pattern is an ascending or descending triangle instead.
- A prior trend must exist before the pattern forms, as symmetrical triangles are continuation patterns.
- The pattern is confirmed when price decisively closes outside either trendline.
- Engine rule: boundary lines through confirmed swing pivots (each ≥2 touches, containing every bar of the pattern within 0.25 ATR); the upper line must fall and the lower line rise by at least 1.5 ATR each over the span, and the end width must be at most 0.7× the start width. A line moving no more than min(0.75 ATR, 1% of price) is flat (an ascending/descending triangle instead); a move in between is not drawn. Minimum 15 bars.

## Confidence Weight Rationale

confidence_weight: 0.5 — Bulkowski (thepatternsite.com/st.html, bull market): breakouts are upward 60% of the time; break-even failure rate 25% (up) / 37% (down); 58% / 36% meet the price target; performance rank 36 of 39 (up) / 34 of 36 (down) — "performance is awful." Weight: median of the up/down failure rates (31%) → > 30% → 0.5. The pattern provides no reliable directional edge on its own; its value comes primarily from the volatility compression signal; the breakout side is set only by a close outside a trendline.

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
- **No prior trend**: Without a preceding trend the pattern is mere range compression. Check for a clear prior move of at least 10% before the pattern began. Even then the triangle does not pick a side — Bulkowski (st.html) measures breakouts up 60% / down 40%.
- **Low-volume breakout**: A breakout without volume confirmation is unreliable. Price often reverses back into the triangle, creating a false breakout trap.
- **Whipsaw in narrow range**: As the triangle narrows, small moves can breach a trendline intraday without confirming a true breakout. Wait for a closing break.
- **Confusion with wedge**: If one trendline has a significantly steeper slope than the other, the pattern may be a wedge (ascending or descending) rather than a symmetrical triangle. Both trendlines should converge at roughly equal rates.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `direction` = the prior-trend direction ('up' after a rise of at least 2 ATR in the close over the 20 bars before the pattern start, 'down' after a fall) — a symmetrical triangle is a continuation pattern, and the computed geometry assumes it. `breakoutLevel` = the trendline on that side at the last bar (the upper trendline for 'up', the lower for 'down'); `extremeLevel` = the breakout level minus (up) or plus (down) the triangle height (the width between the trendlines at the first touch — their widest point); `invalidationLevel` = the last confirmed touch of the opposite trendline (a fixed pivot price, not the line's current value). If the candidate is printed as 'Direction: undetermined (no prior trend)', it lists both boundaries and the height only — set `geometry` to null and state no target. When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The opposite trendline's last confirmed touch (a fixed pivot price, not the line's current value) serves as the invalidation level. For an upward breakout, the ascending support trendline is the stop reference. For a downward breakdown, the descending resistance trendline is the stop reference.
- **Direction uncertainty**: When the breakout direction is uncertain, the triangle itself signals an impending volatility expansion — prepare for both scenarios.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the current upper trendline value, current lower trendline value, and the projected apex price.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / broken upward / broken downward), the convergence rate, number of trendline touches on each side, position within the triangle (early, mid, late), and the prior trend direction (context only — do not forecast the breakout side from it; Bulkowski's measured split is up 60% / down 40%).
- **Volume context**: State whether volume is declining as expected during formation and whether a volume surge confirmed the breakout. Note the volume level relative to the recent average.
- **Completion status**: Clearly indicate whether the triangle is still forming (direction unresolved — measured split up 60% / down 40%) or confirmed by a close outside a trendline.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
대칭삼각형 (Symmetrical Triangle) — neutral continuation, confidence_weight 0.5. Bulkowski st.html: breaks up 60%; failure 25% up / 37% down; rank 36/39 — weak on its own.

### Detection
- Descending resistance trendline connecting ≥2 progressively lower highs.
- Ascending support trendline connecting ≥2 progressively higher lows.
- Two trendlines converge toward an apex (range compresses).
- Minimum 15 bars for validity.
- Both trendlines need meaningful slopes — if either nearly horizontal (slope <1%) it is an ascending/descending triangle instead.
- Prior trend must exist (continuation pattern).
- Confirmed when price decisively CLOSES outside either trendline.
- Engine: upper line falling and lower line rising, each ≥1.5 ATR over the span (flat = ≤min(0.75 ATR, 1% price) → other triangle; in between = not drawn), ≥2 touches each, end width ≤0.7× start.

### Grading
- Increase: strong prior trend; 3+ touches per trendline; clear volume decline as triangle narrows; breakout in first 2/3 (to projected apex); breakout aligns with prior trend.
- Decrease: no clear prior trend (range-bound); <2 touches per trendline; breakout near/past apex; breakout opposes prior trend; high volume maintained without resolution.
- Optimal breakout zone = 50%–75% of triangle (start→projected apex); too early premature, too late insufficient move.
- Volume contraction as it narrows is the primary tell that a decisive breakout nears.

### False positives
- Apex breakout (at/past apex): minimal measured move, high failure — pattern expires near apex.
- No prior trend → mere range compression; require prior move ≥10% before pattern. Even then the split is only up 60% / down 40%.
- Low-volume breakout → often reverses (false-breakout trap).
- Narrow-range whipsaw: intraday breach without close → wait for closing break.
- One trendline much steeper than the other → wedge, not symmetrical triangle (should converge at ~equal rates).

### Geometry (do not calculate targets)
`geometry` = { direction: the prior-trend direction (≥2 ATR close change over the 20 bars before the pattern), breakoutLevel: the trendline on that side at the last bar (upper for up, lower for down), extremeLevel: breakout ∓ the triangle height (width at the first touch), invalidationLevel: the last confirmed touch of the opposite trendline }. If the candidate says 'Direction: undetermined (no prior trend)', set geometry to null (no target). Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: current upper trendline, current lower trendline, projected apex.
- patternSummaries: status (forming / approaching apex / broken up / broken down); convergence rate; touches per side; position in triangle (early/mid/late); prior trend direction (context only, not a breakout forecast).
- Volume context: declining during formation? surge confirmed breakout? volume vs recent average.
- Completion status: forming (direction unresolved; up 60% / down 40%) vs confirmed by close outside a trendline.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- trend: neutral until breakout; set by realized breakout direction.
<!-- PROMPT_DIGEST:END -->
