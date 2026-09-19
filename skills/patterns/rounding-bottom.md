---
name: 원형바닥
description: 점진적으로 U자 형태를 그리며 바닥을 형성하는 장기 강세 반전 패턴
type: pattern
category: reversal_bullish
pattern: rounding_bottom
indicators: []
confidence_weight: 0.78
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "림 저항선"
gating:
  tier: gated
  signal_kind: event
  triggers: [rounding_bottom]
token_cost: 754
digest_hash: "bc7a0065"
---

## Detection Criteria

- Price must form a gradual, rounded U-shape over an extended period — not a V-shaped bottom or a flat base.
- The pattern consists of three phases: gradual decline (left side), stabilization (bottom), and gradual rise (right side). The transition between phases should be smooth, not abrupt.
- The left rim and right rim should be at approximately similar price levels (within 5%). The right rim reaching the left rim level completes the visual "saucer" shape.
- Volume should follow a U-shaped pattern as well: declining during the left side, reaching a minimum at the bottom, and gradually increasing during the right side.
- The pattern typically forms over several months to years on daily charts. On weekly charts, the formation period is shorter but still measured in months.
- The pattern requires a minimum of 30 bars for structural validity, but reliable formations typically span 50+ bars.
- The pattern is confirmed when price closes above the left rim (neckline/resistance level) with increased volume.

## Confidence Weight Rationale

confidence_weight: 0.78 — Rounding Bottom (Saucer) is rated by Bulkowski as a "very reliable" reversal pattern, with documented success rates in the 75–82% range when confirmed by a rim breakout. Its gradual formation reflects a slow but steady shift from distribution to accumulation — a hallmark of smart-money positioning during periods when the broader market or sector is out of favor. The extended formation period introduces timing challenges (pattern may take months to complete, early identification can be premature), which is why the weight sits at 0.78 rather than higher despite the strong empirical track record.

Factors that increase confidence:
- Formation period > 3 months (60+ daily bars)
- Volume follows a clear U-shape matching the price pattern
- Smooth, gradual curves without sharp moves
- Breakout above the rim with significant volume increase
- Prior downtrend of at least 20% before the pattern began

Factors that decrease confidence:
- V-shaped bottom rather than gradual U-shape
- No volume U-shape (flat or erratic volume)
- Sharp moves within the pattern (disrupting the rounded shape)
- Right rim significantly below the left rim (> 5% lower)
- Pattern forming in an already sideways market (no prior downtrend)

## Key Signals

- **Volume U-shape**: This is the most important confirmation signal. Volume should mirror the price pattern — declining as the left side forms, reaching its lowest point at the bottom, and gradually increasing as the right side develops. This volume pattern reflects the shift from distribution to accumulation.
- **Gradual slope transition**: The rate of decline should gradually slow, reach zero at the bottom, and then gradually accelerate upward. Abrupt transitions suggest different pattern dynamics.
- **Rim breakout with volume surge**: A close above the left rim price level accompanied by a notable volume increase confirms the pattern. The rim serves as the resistance/neckline level.
- **Time symmetry**: The left and right sides of the saucer should be roughly equal in duration. Asymmetry is acceptable but significant lopsidedness reduces pattern reliability.
- **Sector or market rotation**: Rounding Bottoms often coincide with sector rotation — smart money gradually accumulating during a period when the broader market or sector is out of favor.

## False Positive Conditions

- **V-shaped recovery**: A sharp, rapid bounce from the low is not a Rounding Bottom. The gradual, rounded shape is essential — it reflects patient accumulation, not panic buying or short covering.
- **Incomplete right side**: If the right side of the saucer has not risen to at least the midpoint of the left side's decline, the pattern is still in early formation and should not be treated as confirmed.
- **No volume confirmation**: If volume does not follow the U-shape — particularly if volume does not increase during the right side — the accumulation thesis is weakened.
- **Sharp disruptions**: If the rounded shape is interrupted by sharp moves (gaps, spikes, or sharp selloffs), the pattern's gradual sentiment shift thesis is compromised.
- **Right rim too low**: If the right rim is significantly (> 5%) below the left rim, the pattern may be forming a lower high rather than completing the saucer, suggesting continued weakness.
- **Premature identification**: Given the long formation period, identifying the pattern too early (before the right side develops meaningfully) leads to frequent false signals.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the rim price (the breakout level); `extremeLevel` = the saucer bottom price; `direction` = 'up'; `invalidationLevel` = the most recent right-side trough (the saucer bottom itself is a wider alternative stop). When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The most recent trough within the right side of the saucer, or the bottom of the saucer for a wider stop, serves as the invalidation level.
- **Extended targets**: Rounding Bottoms confirmed at higher timeframes (weekly/monthly) often produce moves that significantly exceed the measured target, as they represent major trend reversals.
- **Patience**: The pattern's long formation period means confirmation can take months. Early positioning before rim breakout carries higher risk.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the left rim price, right rim price (current or projected), and the bottom price.
- **patternSummaries**: Describe the pattern status (left side forming / bottom stabilizing / right side developing / rim reached / breakout confirmed), the saucer depth as a percentage of the rim price, the formation duration, the symmetry between left and right sides, and the shape assessment (smooth U vs irregular).
- **Volume context**: State whether volume follows the expected U-shape — declining on the left side, minimum at the bottom, and increasing on the right side. Note the volume level at the breakout relative to the average.
- **Completion status**: Clearly indicate which phase the pattern is in and how far along the right side has developed. Note whether the right rim has reached the left rim level.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
원형바닥 (Rounding Bottom / Saucer) — long-term bullish reversal, confidence_weight 0.78, documented success rate 75–82%. Often coincides with sector/market rotation into the stock.

### Detection
- Gradual rounded U-shape over extended period — NOT V-shaped bottom nor flat base.
- Three phases: gradual decline (left), stabilization (bottom), gradual rise (right); smooth transitions, not abrupt.
- Left rim & right rim at ~similar price levels (within 5%). Right rim reaching left-rim level completes the saucer.
- Volume follows U-shape: declining left, minimum at bottom, gradually increasing right.
- Typically months–years on daily; minimum 30 bars for validity, reliable formations 50+ bars.
- Confirmed when price CLOSES above left rim (neckline/resistance) with increased volume.

### Grading
- Increase: formation >3 months (60+ daily bars); clear volume U-shape; smooth curves without sharp moves; rim breakout with significant volume; prior downtrend ≥20% before pattern.
- Decrease: V-shape not U; flat/erratic volume; sharp moves within pattern; right rim >5% below left rim; forming in already-sideways market (no prior downtrend).
- Volume U-shape is the MOST important confirmation (distribution→accumulation).
- Left & right sides roughly equal duration (time symmetry); large lopsidedness reduces reliability.

### False positives
- V-shaped rapid bounce (not patient accumulation).
- Right side hasn't risen to at least the MIDPOINT of the left side's decline → still early, not confirmed.
- No volume increase on right side → accumulation thesis weak.
- Sharp disruptions (gaps/spikes/selloffs) break the gradual thesis.
- Right rim >5% below left rim → lower high, continued weakness.
- Premature identification before right side develops → frequent false signals.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the rim price (the breakout level), extremeLevel: the saucer bottom price, direction: 'up', invalidationLevel: the most recent right-side trough (the saucer bottom itself is a wider alternative stop) }. Copy from `## Chart Pattern Candidates (computed)` when this instance is listed there; else identify from the bars. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: left rim, right rim (current/projected), bottom.
- patternSummaries: status (left side forming / bottom stabilizing / right side developing / rim reached / breakout confirmed); saucer depth as % of rim; formation duration; left/right symmetry; shape (smooth U vs irregular).
- Volume context: whether volume follows U-shape (decline left, min bottom, increase right); breakout volume vs average.
- Completion status: which phase; how far right side developed; whether right rim reached left-rim level.
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R.
- trend: bullish when confirmed.
<!-- PROMPT_DIGEST:END -->
