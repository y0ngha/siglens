---
name: 하이 타이트 플래그
description: 두 달 안팎에 90% 이상 급등한 뒤 얕게 쉬어가는 강세 지속 패턴 — 깃대 고점 상향 돌파로 확정
type: pattern
category: continuation_bullish
pattern: high_tight_flag
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "깃대 고점"
gating:
  tier: gated
  signal_kind: event
  triggers: [high_tight_flag]
token_cost: 452
digest_hash: "242fe6a0"
---

## Detection Criteria

- **Pole**: a rise of at least 90% from the pole base (lowest low) to the pole top (highest high) within 40 bars. Bulkowski (htf.html): "Price must rise at least 90% (shoot for a double) in 2 months or less." On daily bars this is the only timeframe where the rule realistically fires; on intraday charts it effectively never does.
- **Pole top**: the highest high among the last 31 bars, not exceeded by any earlier bar in its pole lookback (otherwise it is a lower high inside a longer consolidation).
- **Flag**: at least 3 bars after the pole top, giving back no more than 25% of the pole top. Bulkowski: it "usually doesn't look like a flag or pennant, just a pause in the price rise."
- **Confirmation**: a CLOSE above the highest peak in the pattern — usually the pole top. Bulkowski: "Only buy when price closes above the highest peak in the chart pattern (including the flagpole)" — his newer research found that a flag-trendline break "fail[s] too often."
- When this pattern matches, the engine reports it instead of bull_flag / pennant for the same pause.

## Confidence Weight Rationale

confidence_weight: 0.7 — Bulkowski (thepatternsite.com/htf.html, bull market): break-even failure rate 15%; overall performance rank 30 of 39; *82% meet the price target, where "* Uses a half-height target"; throwback rate 67%. Weight: failure 15% → 11–20% → 0.7. Single-direction pattern (upward confirmation only), so no breakout-direction share applies. The low performance rank (30/39) despite the low failure rate means the post-breakout rise is often modest relative to the pole.

Factors that increase confidence:
- Tight flag — Bulkowski: "Tight flags perform better than loose ones"
- Receding volume in the flag (Bulkowski: "Recedes for best performance")
- Down-sloping top trendline in the flag (Bulkowski: tends to outperform)
- A pole near 45 degrees rather than near-vertical (Bulkowski: better post-breakout rise)

Factors that decrease confidence:
- Loose flag: price meanders, pokes outside the boundary, contains white space, or looks jagged (Bulkowski's definition)
- Pullback approaching the 25% give-back limit
- No close above the pole top yet — price may "drop or move horizontally for months" (Bulkowski)

## Key Signals

- **Close above the pole top**: the only confirmation.
- **Throwbacks are common**: 67% throw back after the breakout (Bulkowski) — a return toward the pole top is normal, not a failure by itself.
- **Pole extension**: a +90% pole means the stock is extended; volatility inside the flag is large in absolute terms.

## False Positive Conditions

- **Pole too small or too slow**: under +90%, or taking longer than ~40 bars — that is a regular bull flag or a trend, not a high tight flag.
- **Deep flag**: more than 25% give-back from the pole top.
- **Unconfirmed**: no close above the highest peak — Bulkowski warns early entries risk the pattern never confirming.
- **Intraday timeframe**: a +90% pole is implausible; treat an intraday hit with suspicion.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `breakoutLevel` = the pole top (a confirmed swing high — the flag's upper edge); `extremeLevel` = the pole base (lowest low within the pole lookback); `direction` = 'up'; `invalidationLevel` = the flag low (the lowest confirmed swing low after the pole top). When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Target reliability**: Bulkowski's 82% figure uses a half-height target, not the full pole height — the conservative (50%) level is the realistic reference.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Pole base, pole top, flag low.
- **patternSummaries**: Pole gain (%) and length (bars), flag depth as % of the pole top, flag length, tight vs loose, status (flag forming / pole top broken — confirmed).
- **Volume context**: Whether volume receded during the flag and expanded on the breakout.
- **Completion status**: Candidate until a close above the pole top.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
하이 타이트 플래그 (High Tight Flag) — bullish continuation, confidence_weight 0.7 (Bulkowski htf.html: failure 15%, rank 30/39, 82% meet a HALF-height target, throwback 67%).

### Detection
- Pole: ≥+90% from pole base (lowest low) to pole top (highest high) within 40 bars (Bulkowski: ≥90% in ≤2 months). Realistic on daily bars only.
- Flag: ≥3 bars after the pole top, give-back ≤25% of the pole top; usually just a pause, not a neat flag.
- Replaces bull_flag / pennant for the same pause.
- Confirmed ONLY by a CLOSE above the highest peak (usually the pole top) — Bulkowski: flag-trendline breaks fail too often.

### Grading
- Increase: tight flag; receding flag volume; down-sloping flag top; pole near 45° rather than vertical.
- Decrease: loose flag (meanders, pokes outside, white space, jagged); give-back near 25%; no close above pole top yet (may drift for months).
- Throwback toward the pole top after breakout is common (67%), not failure by itself.

### Geometry (do not calculate targets)
`geometry` = { breakoutLevel: the pole top (a confirmed swing high), extremeLevel: the pole base, direction: 'up', invalidationLevel: the flag low (the lowest confirmed swing low after the pole top) }. Copy from `## Chart Pattern Candidates (computed)` when listed; else identify from the bars. Never compute a measured target, conservative target, or R:R — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)). Bulkowski's 82% is for a half-height target.

### Output
- keyPrices: pole base, pole top, flag low.
- patternSummaries: pole gain % & bars; flag depth % & bars; tight vs loose; status (forming / confirmed).
- Volume: receding in flag, expanding on breakout.
- geometry per above — never a computed target or R:R.
- trend: bullish; candidate until close above the pole top.
<!-- PROMPT_DIGEST:END -->
