---
name: 확장형 패턴(브로드닝)
description: 고점은 높아지고 저점은 낮아지며 폭이 벌어지는 메가폰 형태 — 방향은 이탈하는 쪽으로 정해지는 변동성 확대 패턴
type: pattern
category: neutral
pattern: broadening_formation
indicators: []
confidence_weight: 0.6
display:
  chart:
    show: true
    type: line
    color: "#78909c"
    label: "확장 추세선"
gating:
  tier: gated
  signal_kind: event
  triggers: [broadening_formation]
token_cost: 444
digest_hash: "9fb325a4"
---

## Detection Criteria

- Higher peaks and lower valleys — a megaphone shape. The top trendline slopes up, the bottom trendline slopes down, so the range widens over time.
- Engine rule: least-squares trendlines through the highs and the lows of the last 8 swing pivots (≥2 highs and ≥2 lows); the high line is rising (more than 0.05 ATR per bar) and the low line is falling (more than 0.05 ATR per bar). The engine does not distinguish a broadening top from a broadening bottom — read the prior trend yourself: up into the pattern = broadening top, down into it = broadening bottom.
- Bulkowski (bt.html, broadb.html): "At least five touches total, three peaks or three valleys should touch the associated trend line with two or more touches of the other trendline." The engine's minimum (2 + 2 pivots) is looser — fewer touches means a weaker candidate.
- Bulkowski: "Price should cross the pattern from side to side, filling the area with price movement."
- Breakout: a close outside either trendline; Bulkowski: it "Can occur in any direction (upward 60%)" — the same 60% for tops and bottoms.

## Confidence Weight Rationale

confidence_weight: 0.6 — Bulkowski, bull market. Broadening tops (thepatternsite.com/bt.html): break-even failure rate up/down 18%/27%, rank 22 of 39 / 28 of 36, target met 66%/42%, breakout upward 60%; Bulkowski: "The broadening top is a poor performer." Broadening bottoms (thepatternsite.com/broadb.html): failure 16%/26%, rank 15 of 39 / 23 of 36, target met 65%/41%, upward 60%. Weight: as a bilateral (neutral) pattern, the median of the four variant failure rates (22%) → 21–30% → 0.6 — the same method used for the rectangle. Upward breakouts are clearly stronger than downward ones; weight a downside break less.

Factors that increase confidence:
- ≥5 touches (3 on one line, 2+ on the other), with the second of three touches actually touching the line
- Price crossing the full width of the megaphone
- Volume trending upward within the pattern (Bulkowski, broadb.html: "Does best when volume trends upward")

Factors that decrease confidence:
- Only the engine minimum of 2 highs + 2 lows
- A single late spike creating the "broadening" — Bulkowski: this is the identification problem where price is really a channel "with an upward spike at pattern's end"
- Throwbacks/pullbacks after the break (Bulkowski: both hurt post-breakout performance)

## Key Signals

- **Partial decline**: price turns up before touching the lower trendline — Bulkowski: works 72% (tops) / 73% (bottoms) of the time, predicting an upward breakout. The most useful signal in this pattern.
- **Partial rise**: price turns down before touching the upper trendline — works only 52% / 53% (Bulkowski); weak.
- **Close outside a trendline**: the breakout. Inside the megaphone, price swings widen — volatility is expanding, not resolving.

## False Positive Conditions

- **Late spike on a channel**: one outlier pivot turning a channel into an apparent megaphone.
- **Too few touches**: fewer than five total is below Bulkowski's identification guideline.
- **No white-space fill**: price not crossing side to side.
- **Unconfirmed break**: an intrabar poke without a close outside.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `direction` = the break side ('up' for a close above the upper trendline, 'down' for a close below the lower one); before any break the engine biases toward the side price currently sits closer to. `breakoutLevel` = that side's trendline value at the last bar; `extremeLevel` = the opposite trendline's value at the last bar (the megaphone is widest at its latest point, so the height is read there); `invalidationLevel` = the opposite trendline's value at the last bar (same as extremeLevel). When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Target reliability**: Bulkowski: full-height targets are met 65–66% of the time on upward breakouts but only 41–42% on downward ones.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Upper and lower trendline values at the last bar.
- **patternSummaries**: Top vs bottom (by prior trend), status (forming / partial decline / partial rise / broken up / broken down), touch count per line, current width as % of price.
- **Volume context**: Whether volume is trending up within the pattern.
- **Completion status**: Neutral until a close outside a trendline.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
확장형 패턴 (Broadening Formation / megaphone) — neutral, confidence_weight 0.6. Bulkowski: tops (bt.html) failure up/down 18%/27%, bottoms (broadb.html) 16%/26%; both break UP 60%; "The broadening top is a poor performer."

### Detection
- Higher peaks + lower valleys: upper trendline rising, lower trendline falling (last 8 swing pivots, each slope >0.05 ATR/bar).
- Prior trend up = broadening top; down = bottom.
- Bulkowski: ≥5 touches (3 on one line, 2+ on the other), price filling the area. Engine minimum 2+2 is looser.
- Breakout = CLOSE outside either line; any direction.

### Grading
- Partial decline (turns up before the lower line) predicts an up-break — works 72–73% (Bulkowski); strongest signal here. Partial rise works only 52–53%.
- Increase: ≥5 touches; upward volume trend inside the pattern.
- Decrease: minimal touches; a single late spike on a real channel; throwback/pullback after the break.
- Up-breaks outperform; weight a downside break less.

### Geometry (do not calculate targets)
`geometry` = { direction: break side (pre-break: side price sits closer to), breakoutLevel: that side's trendline at the last bar, extremeLevel: opposite trendline at the last bar (widest point), invalidationLevel: opposite trendline at the last bar }. Copy from `## Chart Pattern Candidates (computed)` when listed; else identify from the bars. Never compute a measured target, conservative target, or R:R — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: upper & lower trendline at last bar.
- patternSummaries: top/bottom; status (forming / partial decline / partial rise / broken up/down); touches; width %.
- geometry per above — never a computed target or R:R.
- trend: neutral until a close outside a line.
<!-- PROMPT_DIGEST:END -->
