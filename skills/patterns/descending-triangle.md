---
name: 하락삼각형
description: 수평 지지선과 하락하는 저항 추세선이 수렴하는 패턴 — 측정상 방향 중립에 가깝고(상방 53%) 지지선 종가 이탈 시에만 약세 확정
type: pattern
category: neutral
pattern: descending_triangle
indicators: []
confidence_weight: 0.55
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "지지선"
gating:
  tier: gated
  signal_kind: event
  triggers: [descending_triangle]
token_cost: 646
digest_hash: "6a73d4ba"
---

## Detection Criteria

- A horizontal support line must be present, with at least 2 touches at approximately the same price level (within 1%).
- A descending resistance trendline must be present, connecting at least 2 progressively lower highs.
- Price must be converging within the triangle — the range between the falling resistance and the horizontal support narrows over time.
- The pattern requires a minimum of 15 bars for structural validity.
- The horizontal support must be clearly flat (slope < 1%), distinguishing this from a symmetrical triangle.
- The descending trendline must show a clear downward slope with each successive high being meaningfully lower than the previous one.
- The pattern is confirmed when price closes below the horizontal support with increased volume.

## Confidence Weight Rationale

confidence_weight: 0.55 — Bulkowski (thepatternsite.com/dt.html, bull market): despite the textbook bearish label, breakouts are upward 53% of the time — the pattern is close to direction-neutral. Break-even failure rate 22% (up) / 23% (down); 64% / 50% meet the price target; performance rank 33 of 39 (up) / 15 of 36 (down). Bulkowski also notes its performance has dropped almost in half since the 1990s. Weight: 21–30% failure → 0.6, −0.05 because neither breakout direction reaches 55%. Treat it as bearish only after a close below the horizontal support; until then both directions are live.

Factors that increase confidence:
- 3+ touches on the horizontal support
- 3+ touches on the descending resistance line
- Volume declining as the triangle narrows
- Breakdown occurring in the first 2/3 of the triangle
- Prior downtrend present before the pattern formed

Factors that decrease confidence:
- Fewer than 2 touches on either line
- Breakdown near or past the apex of the triangle
- No prior trend (pattern forming in a range-bound market)
- Volume remaining high during the pattern without breakdown
- Descending trendline with only marginal lower highs

## Key Signals

- **Volume contraction during formation**: Volume should progressively decline as the triangle narrows. This compression precedes the decisive breakdown move.
- **Support breakdown with volume surge**: A close below the horizontal support accompanied by significantly increased volume confirms the bearish breakdown.
- **Falling highs acceleration**: If the descending resistance trendline shows accelerating lower highs (the rate of decline steepens), selling pressure is intensifying.
- **Breakdown timing**: Breakdowns that occur between the 50% and 75% point of the triangle are statistically the most reliable.
- **Retest of support as resistance**: After the breakdown, a rally back to the former support level that fails to reclaim it confirms the bearish pattern.

## False Positive Conditions

- **Upward breakout (bull trap risk)**: Upward breakouts are not a rare exception — Bulkowski (dt.html) measures 53% upward. A close above the descending trendline is a legitimate bullish resolution, not merely a failed bearish pattern. However, beware of false breakouts — check volume confirmation.
- **Apex breakdown**: Breakdowns occurring very close to or past the apex point have significantly reduced reliability and measured move potential.
- **No volume confirmation**: A breakdown below support without a volume surge may be a false breakdown. Price may quickly reverse back inside the triangle.
- **Strong support context**: If the horizontal support coincides with a major historical support level and is being tested for the first time, the likelihood of a bounce increases.
- **Premature breakdown**: An intraday wick below support without a closing break is not confirmation.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the horizontal support level; `extremeLevel` = the descending resistance trendline's value at the pattern's start (its widest point); `direction` = 'down'; `invalidationLevel` = the descending resistance trendline's current (last-bar) value — the most recent lower high. When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The most recent lower high on the descending trendline or the trendline itself serves as the invalidation level. A close above this negates the bearish pattern.
- **Breakout scenario**: If price closes above the descending trendline instead, treat the pattern as having failed/reversed to bullish (a bear trap) — this alternate scenario is not in `## Chart Pattern Candidates (computed)`, so do not compute a target for it yourself; describe the reversal qualitatively.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the horizontal support level, the current descending trendline value, and the projected apex price.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / support broken / trendline broken upward), the number of touches on support and resistance, the breakdown position relative to the apex (early, mid, late), and the prior trend direction.
- **Volume context**: State whether volume is contracting as expected during formation and whether a volume surge accompanied any breakdown or breakout.
- **Completion status**: Clearly indicate whether the triangle is still forming or confirmed by a decisive close below the horizontal support.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Descending Triangle (near direction-neutral; bearish only after a close below support)

Geometry:
- Horizontal support line: ≥2 touches at ~same price (within 1%); slope must be < 1% (else symmetrical triangle).
- Descending resistance trendline: ≥2 progressively lower highs, clear downward slope.
- Price converges (range narrows) toward apex. Minimum 15 bars.

Confirmation: close BELOW horizontal support with increased volume. Intraday wick below support without a close = not confirmed. Volume should decline as triangle narrows.

Confidence (weight 0.55) — Bulkowski dt.html: breaks UP 53% of the time; failure 22% up / 23% down; 50% of down breakouts meet target; performance almost halved since the 1990s.
- Increase: 3+ touches on support, 3+ on resistance, declining volume, breakdown in first 2/3 (50%–75% point most reliable), prior downtrend.
- Decrease: <2 touches either line, breakdown near/past apex, no prior trend, volume high without breakdown, only marginal lower highs.

False positives / invalidation:
- Upward break (53%) is a normal bullish resolution, not a rare failure — check volume (bull trap risk).
- Apex/near-apex breakdown = reduced reliability & target.
- Breakdown without volume surge may be false.
- Support at major historical level tested first time → higher bounce odds.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the horizontal support level, extremeLevel: the descending resistance trendline's value at the pattern's start (its widest point), direction: 'down', invalidationLevel: the descending resistance trendline's current (last-bar) value — the most recent lower high }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: horizontal support, current descending trendline value, projected apex price.
- patternSummaries: status (forming / approaching apex / support broken / trendline broken upward), touch counts on support & resistance, breakdown position vs apex (early/mid/late), prior trend direction.
- Volume context: contraction during formation; volume surge on breakdown/breakout.
- Completion status: forming vs confirmed (decisive close below support).
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
