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
token_cost: 778
digest_hash: "f6b4723d"
---

## Detection Criteria

- Higher peaks and lower valleys — a megaphone shape. The top trendline slopes up, the bottom trendline slopes down, so the range widens over time.
- Engine rule: boundary lines through confirmed swing pivots — the best window of the last 8 down to 5 pivots (the one whose pivots touch their lines most often), grown back to at most 16 pivots while it stays the same pattern and keeps every touch — each line containing every bar of the pattern within 0.25 ATR (a pivot within 0.35 ATR of a line touches it), never a regression fit, and the two lines must interleave (each keeps at least 2 touches from the other line's first touch on). The high line rises and the low line falls, each at least 1.5 ATR over the span, the end width is at least 1.3× the start width, and there are at least 5 touches in total with at least 3 on one line; the height is the width at the last touch (it widens). The engine does not distinguish a broadening top from a bottom — direction = the prior trend (a ≥2 ATR close change over the 20 bars before the pattern; none → undetermined, no target); read it as up into the pattern = top, down = bottom. Minimum 15 bars, and a height (width at the last touch) of at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars). The chart draws each line solid from its first to its last confirmed touch and continues it dashed to the bar where the printed value is read (the last bar for the breakout-side line). Status `failed breakout`: after the breakout line's last touch a close went beyond it by more than 0.25 ATR and the last close is back inside — the pattern stays listed and drawn (its structure is intact) but price already broke the line once and came back, so report the breakout as failed and unconfirmed, not as a plain untested `forming` and not as a confirmed break (`broken` means the last close is outside).
- Bulkowski (bt.html, broadb.html): "At least five touches total, three peaks or three valleys should touch the associated trend line with two or more touches of the other trendline." The engine enforces this minimum: a candidate needs at least 5 touches in total, at least 3 on one line.
- Bulkowski: "Price should cross the pattern from side to side, filling the area with price movement."
- Breakout: a close outside either trendline; Bulkowski: it "Can occur in any direction (upward 60%)" — the same 60% for tops and bottoms.

## Confidence Weight Rationale

confidence_weight: 0.6 — Bulkowski, bull market. Broadening tops (thepatternsite.com/bt.html): break-even failure rate up/down 18%/27%, rank 22 of 39 / 28 of 36, target met 66%/42%, breakout upward 60%; Bulkowski: "The broadening top is a poor performer." Broadening bottoms (thepatternsite.com/broadb.html): failure 16%/26%, rank 15 of 39 / 23 of 36, target met 65%/41%, upward 60%. Weight: as a bilateral (neutral) pattern, the median of the four variant failure rates (22%) → 21–30% → 0.6 — the same method used for the rectangle. Upward breakouts are clearly stronger than downward ones; weight a downside break less.

Factors that increase confidence:
- ≥5 touches (3 on one line, 2+ on the other), with the second of three touches actually touching the line
- Price crossing the full width of the megaphone
- Volume trending upward within the pattern (Bulkowski, broadb.html: "Does best when volume trends upward")

Factors that decrease confidence:
- Only the engine minimum of 5 touches (3 on one line, 2 on the other)
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

- **Pattern geometry (for the `geometry` field)**: `direction` = the prior-trend direction ('up' after a rise of at least 2 ATR in the close over the 20 bars before the pattern start, 'down' after a fall) — the computed geometry assumes continuation. `breakoutLevel` = that side's trendline value at the last bar (upper line for 'up', lower for 'down'); `extremeLevel` = the breakout level minus (up) or plus (down) the height, which is the width between the lines at the last touch (the megaphone is widest at its latest touch); `invalidationLevel` = the last confirmed touch of the opposite boundary (a fixed pivot price). If the candidate is printed as 'Direction: undetermined (no prior trend)', it lists both boundaries and the height only — set `geometry` to null and state no target. Copy these values from `## Chart Pattern Candidates (computed)` only when this pattern instance is listed there (set its Candidate id as candidateId); when it is not listed, you may still name and describe the pattern, but `geometry` is null and candidateId is empty — only listed patterns carry levels and targets. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Target reliability**: Bulkowski: full-height targets are met 65–66% of the time on upward breakouts but only 41–42% on downward ones.

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Upper and lower trendline values at the last bar.
- **patternSummaries**: Top vs bottom (by prior trend), status (forming / partial decline / partial rise / broken up / broken down), touch count per line, current width as % of price.
- **Volume context**: Whether volume is trending up within the pattern.
- **Completion status**: Neutral until a close outside a trendline.
- **geometry**: For a listed pattern instance (with a Candidate id), fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. For an unlisted pattern, `geometry` is null and candidateId is empty. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
확장형 패턴 (Broadening Formation / megaphone) — neutral, confidence_weight 0.6. Bulkowski: tops (bt.html) failure up/down 18%/27%, bottoms (broadb.html) 16%/26%; both break UP 60%; "The broadening top is a poor performer."

### Detection
- Higher peaks + lower valleys: upper line rising, lower line falling (each ≥1.5 ATR over the span; end width ≥1.3× the start; lines through confirmed swing pivots containing all bars within 0.25 ATR).
- Prior trend up = broadening top; down = bottom.
- Bulkowski: ≥5 touches (3 on one line, 2+ on the other), price filling the area. The engine requires the same minimum (5 touches in total, ≥3 on one line).
- Breakout = CLOSE outside either line; any direction.
- Engine: lines through confirmed pivots (window 8→5 pivots, grown back to ≤16 while all touches kept), bars contained within 0.25 ATR, touch = within 0.35 ATR, lines interleave (≥2 touches each from the other's first touch); high line rising and low line falling, each ≥1.5 ATR, end width ≥1.3× start, ≥5 touches in total and ≥3 on one line, height = width at the last touch; direction = the prior trend (a ≥2 ATR close change over the 20 bars before the pattern; none → undetermined, no target); ≥15 bars; height ≥2.5 ATR and the price-share minimum. Lines drawn solid first→last touch, dashed to the bar the printed value is read. Status `failed breakout` = a close beyond the breakout line by >0.25 ATR after its last touch, last close back inside: structure intact but the break failed — not plain `forming`, not a confirmed break (`broken` = last close outside).

### Grading
- Partial decline (turns up before the lower line) predicts an up-break — works 72–73% (Bulkowski); strongest signal here. Partial rise works only 52–53%.
- Increase: ≥5 touches; upward volume trend inside the pattern.
- Decrease: minimal touches; a single late spike on a real channel; throwback/pullback after the break.
- Up-breaks outperform; weight a downside break less.

### Geometry (do not calculate targets)
`geometry` = { direction: the prior-trend direction (≥2 ATR close change over the 20 bars before the pattern), breakoutLevel: that side's trendline at the last bar, extremeLevel: breakout ∓ height (width at the last touch, the widest point), invalidationLevel: the last confirmed touch of the opposite boundary }. If the candidate says 'Direction: undetermined (no prior trend)', set geometry to null (no target). Copy from `## Chart Pattern Candidates (computed)` only when this instance is listed there (with its Candidate id); when not listed, the pattern may be described but `geometry` is null and candidateId empty. Never compute a measured target, conservative target, or R:R — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: upper & lower trendline at last bar.
- patternSummaries: top/bottom; status (forming / partial decline / partial rise / broken up/down); touches; width %.
- geometry per above — never a computed target or R:R; only for a listed instance, else `geometry` null and candidateId empty.
- trend: neutral until a close outside a line.
<!-- PROMPT_DIGEST:END -->
