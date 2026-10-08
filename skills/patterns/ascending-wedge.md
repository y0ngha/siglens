---
name: 상승쐐기
description: 고점과 저점이 모두 상승하지만 폭이 좁아지는 형태로 하락 반전 신호
type: pattern
category: continuation_bearish
pattern: ascending_wedge
indicators: []
confidence_weight: 0.5
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
token_cost: 850
digest_hash: "2d52411b"
---

## Detection Criteria

- Both highs and lows must be rising, forming a series of higher highs and higher lows.
- The upper trendline (connecting highs) and lower trendline (connecting lows) must converge, meaning the range between highs and lows narrows over time.
- A minimum of 3 touches on each trendline (3 highs and 3 lows) is required for structural validity.
- The lower trendline must have a steeper slope than the upper trendline for the convergence to be valid.
- The convergence ratio (narrowing of the range from start to end) should be at least 30% for the pattern to be meaningful.
- The pattern requires a minimum of 15 bars for structural validity.
- A break below the lower trendline confirms the bearish reversal signal.
- Engine rule: boundary lines through confirmed swing pivots — the best window of the last 8 down to 5 pivots (the one whose pivots touch their lines most often), grown back to at most 16 pivots while it stays the same pattern and keeps every touch — each line containing every bar of the pattern within 0.25 ATR (a pivot within 0.35 ATR of a line touches it), never a regression fit, and the two lines must interleave (each keeps at least 2 touches from the other line's first touch on). Both lines rise at least 1.5 ATR over the span with at least 3 touches per side, and the end width is at most 0.7× the start width. A converging pair with fewer than 3 touches per side, a width ratio between 0.7 and 0.85, or a line moving less than 1.5 ATR is not drawn; a near-parallel pair (0.85–1.15×) is a channel instead. Direction is fixed: down. Minimum 15 bars, and a height (width at the first touch) of at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars). The chart draws each line solid from its first to its last confirmed touch and continues it dashed to the bar where the printed value is read (the last bar for the breakout-side line). Status `failed breakout`: after the breakout line's last touch a close went beyond it by more than 0.25 ATR and the last close is back inside — the pattern stays listed and drawn (its structure is intact) but price already broke the line once and came back, so report the breakout as failed and unconfirmed, not as a plain untested `forming` and not as a confirmed break (`broken` means the last close is outside).

## Confidence Weight Rationale

confidence_weight: 0.5 — Bulkowski (thepatternsite.com/risewedge.html, bull market): breakouts are downward 60% of the time, but downward breakouts are among the worst performers — break-even failure rate 51%, only 32% meet the price target, performance rank 36 (last) of 36. Weight follows the downward (primary-direction) failure rate: > 30% → 0.5. The converging trendlines can also be subjective in their placement, introducing detection variability.

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

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the lower (support) trendline's value at the last bar; `extremeLevel` = the breakout level plus the wedge height (the width between the trendlines at the first touch — their widest point); `direction` = 'down'; `invalidationLevel` = the last confirmed touch of the upper trendline — the most recent swing high, a fixed price (not the line's current value). Copy these values from `## Chart Pattern Candidates (computed)` only when this pattern instance is listed there (set its Candidate id as candidateId); when it is not listed, you may still name and describe the pattern, but `geometry` is null and candidateId is empty — only listed patterns carry levels and targets. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stop-loss reference level**: The last confirmed swing high on the upper trendline serves as the invalidation level — a fixed price. A close above this level negates the bearish pattern.
- **Breakout timing**: Breaks that occur in the first half to two-thirds of the wedge (before reaching the apex) tend to produce stronger moves.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Include the current upper and lower trendline values, and the projected apex price and bar.
- **patternSummaries**: Describe the pattern status (forming / approaching apex / lower trendline broken), the convergence rate, number of trendline touches, and position within the wedge (early, mid, late).
- **Volume context**: State whether volume is declining as expected within the wedge and whether a volume surge accompanied any trendline break.
- **Completion status**: Clearly indicate whether the wedge is still forming or confirmed by a close below the lower trendline.
- **geometry**: For a listed pattern instance (with a Candidate id), fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. For an unlisted pattern, `geometry` is null and candidateId is empty. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
### Ascending Wedge (bearish reversal)

Geometry:
- Both highs and lows rising (higher highs + higher lows).
- Upper trendline (highs) and lower trendline (lows) converge (range narrows). Lower trendline must be STEEPER than upper for valid convergence.
- ≥3 touches on each trendline (3 highs, 3 lows). Convergence ratio ≥30% (narrowing from start to end). Minimum 15 bars.
- Confirmed by break BELOW lower trendline.
- Engine: lines through confirmed pivots (window 8→5 pivots, grown back to ≤16 while all touches kept), bars contained within 0.25 ATR, touch = within 0.35 ATR, lines interleave (≥2 touches each from the other's first touch); both lines rising ≥1.5 ATR, ≥3 touches per side, end width ≤0.7× start (0.7–0.85 or <3 touches = not drawn; 0.85–1.15× = channel); direction fixed down; ≥15 bars; height ≥2.5 ATR and the price-share minimum. Lines drawn solid first→last touch, dashed to the bar the printed value is read. Status `failed breakout` = a close beyond the breakout line by >0.25 ATR after its last touch, last close back inside: structure intact but the break failed — not plain `forming`, not a confirmed break (`broken` = last close outside).

Confidence (weight 0.5) — Bulkowski risewedge.html: breaks down 60%, but down-breakout failure 51%, 32% meet target, rank 36/36 (last).
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
`geometry` = { breakoutLevel: the lower (support) trendline at the last bar, extremeLevel: breakout plus the wedge height (width at the first touch, the widest point), direction: 'down', invalidationLevel: the last confirmed touch of the upper trendline — the most recent swing high, a fixed price }. Copy from `## Chart Pattern Candidates (computed)` only when this instance is listed there (with its Candidate id); when not listed, the pattern may be described but `geometry` is null and candidateId empty. Never compute a measured target, conservative target, or R:R yourself — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

Output:
- keyPrices: current upper & lower trendline values, projected apex price & bar.
- patternSummaries: status (forming / approaching apex / lower trendline broken), convergence rate, touch counts, position (early/mid/late).
- Volume context: declining within wedge; surge on break.
- Completion status: forming vs confirmed (close below lower trendline).
- geometry: `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the definition above — never a computed target or R:R; only for a listed instance, else `geometry` null and candidateId empty.
- Include analytical-reference (not trading-recommendation) framing.
<!-- PROMPT_DIGEST:END -->
