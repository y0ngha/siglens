---
name: 상승 채널
description: 고점과 저점이 평행하게 함께 높아지는 우상향 추세 통로 — 어느 쪽 추세선을 종가로 이탈하느냐로 방향이 정해지는 패턴
type: pattern
category: neutral
pattern: ascending_channel
indicators: []
confidence_weight: 0.5
display:
  chart:
    show: true
    type: line
    color: "#78909c"
    label: "채널 추세선"
gating:
  tier: gated
  signal_kind: event
  triggers: [ascending_channel]
token_cost: 498
digest_hash: "fa39445c"
---

## Detection Criteria

- Price trends upward between two parallel (or nearly parallel) rising trendlines — a pipe tilted up. A horizontal pipe is a rectangle, not a channel.
- Engine rule: boundary lines through confirmed swing pivots (the last 5–8 of them), each through at least 2 touches and containing every bar of the pattern within 0.25 ATR — not a regression fit. Both lines must rise by at least 1.5 ATR over the pattern span, and the end width must stay within 0.85–1.15× the start width — parallel. If the lines converge (end width ≤0.7× the start) with at least 3 touches per side it is an ascending wedge instead; a pair in between is not drawn. Minimum 15 bars, and a height of at least 2.5 ATR and a minimum share of price (0.5% on 5–30 minute, 1% on 1–4 hour, 3% on daily bars).
- Bulkowski (channels.html): "Price should touch each trendline at least twice as distinct peaks or valleys" and "should cross the pattern from trendline to trendline, nearly filling the available space."
- Breakout: a CLOSE outside either trendline; Bulkowski: it "can be in any direction."

## Confidence Weight Rationale

confidence_weight: 0.5 — no published rate. Bulkowski (thepatternsite.com/channels.html): "I haven't studied channels for performance (statistics). My feeling is that they are a lot like rectangles." With no measured break-even failure rate, the weight takes the lowest pattern tier (0.5). Treat the channel as a trend description, not a directional signal.

Factors that increase confidence:
- ≥2 distinct touches on each trendline, with price crossing the full width
- Tall channel relative to price (room between the lines)

Factors that decrease confidence:
- Touches that come "close" but do not reach a line
- A channel at a shallower angle than the move before it — Bulkowski's example calls that "momentum loss" a warning
- Thin channel: breaks are noise-dominated

## Key Signals

- **Inside the channel**: the rising trend is intact. Bulkowski: trade up channels from the long side and "Avoid going short in an up-sloping channel."
- **Close below the lower trendline**: the up-trend channel is broken — Bulkowski's example treats that as the sell signal. This is the more informative break for an ascending channel.
- **Close above the upper trendline**: acceleration of the up-trend.
- **Partial decline** (a drop that turns before reaching the lower line): Bulkowski — expect an upward breakout. **Partial rise**: expect a downward breakout.

## False Positive Conditions

- **Converging lines**: that is an ascending wedge (different skill).
- **Horizontal lines**: that is a rectangle.
- **Single spike**: one outlier high/low skews the fit; check that each line has at least two genuine touches.
- **Unconfirmed break**: an intrabar poke without a close outside is not a breakout.

## Entry/Exit Considerations

- **Pattern geometry (for the `geometry` field)**: `direction` = the prior-trend direction ('up' after a rise of at least 2 ATR in the close over the 20 bars before the pattern start, 'down' after a fall) — the computed geometry assumes continuation; for a pattern you identify yourself, use the side of the close outside a trendline, or the prior-trend side before any. `breakoutLevel` = that side's trendline value at the last bar (the upper line for 'up', the lower for 'down'); `extremeLevel` = the breakout level minus (up) or plus (down) the channel height; `invalidationLevel` = the last confirmed touch of the opposite boundary (a fixed pivot price, not the line's current value). If the candidate is printed as 'Direction: undetermined (no prior trend)', it lists both boundaries and the height only — set `geometry` to null and state no target. When this pattern instance is listed in `## Chart Pattern Candidates (computed)`, copy these values from there; otherwise identify them yourself from the bars. Never compute a measured target, conservative target, or risk/reward ratio yourself — the app derives those from `geometry` and appends them to keyPrices (측정 목표가, 보수 목표가(50%)).
- **Stops**: Bulkowski: "If price closes outside the channel in the adverse direction, then close out the trade."

Note: These are analytical reference points for technical analysis, not trading recommendations.

## AI Analysis Instructions

When this pattern is detected, include the following in the analysis response:

- **keyPrices**: Upper and lower trendline values at the last bar.
- **patternSummaries**: Status (inside channel / broken up / broken down), touches per line, channel height as % of price, position of price within the channel, slope relative to the prior move.
- **Completion status**: Inside the channel is a trend state, not a signal; only a close outside a line is a breakout.
- **geometry**: Fill `patternSummaries[].geometry` = `{ breakoutLevel, extremeLevel, direction, invalidationLevel }` per the Entry/Exit Considerations definition above. Never state a computed measured target, conservative target, or risk:reward ratio yourself — the app derives those from `geometry`.

<!-- PROMPT_DIGEST:START -->
상승 채널 (Ascending Channel) — neutral trend pipe, confidence_weight 0.5. No published rate: Bulkowski channels.html "I haven't studied channels for performance (statistics)."

### Detection
- Two parallel rising boundary lines through confirmed swing pivots (each ≥2 touches, containing all bars within 0.25 ATR): both rise ≥1.5 ATR over the span, end width 0.85–1.15× the start. Converging (≤0.7×) with ≥3 touches per side = ascending wedge; flat = rectangle.
- ≥2 distinct touches per line; price crosses the full width.
- Breakout = CLOSE outside either line; any direction.

### Reading
- Inside: up-trend intact — favour longs, avoid shorts (Bulkowski).
- Close below the lower line: channel broken — the key bearish event for this pattern.
- Close above the upper line: acceleration.
- Partial decline (turns before lower line) → expect up-break; partial rise → expect down-break.
- Warnings: channel flatter than the prior move (momentum loss); near-miss touches; thin channel.

### Geometry (do not calculate targets)
`geometry` = { direction: the prior-trend direction (≥2 ATR close change over the 20 bars before the pattern), breakoutLevel: that side's trendline at the last bar (upper for up, lower for down), extremeLevel: breakout ∓ channel height, invalidationLevel: the last confirmed touch of the opposite boundary }. If the candidate says 'Direction: undetermined (no prior trend)', set geometry to null (no target). Copy from `## Chart Pattern Candidates (computed)` when listed; else identify from the bars. Never compute a measured target, conservative target, or R:R — the app derives them from `geometry` into keyPrices (측정 목표가, 보수 목표가(50%)).

### Output
- keyPrices: upper & lower trendline at last bar.
- patternSummaries: status (inside / broken up / broken down); touches; height %; price position; slope vs prior move.
- geometry per above — never a computed target or R:R.
- trend: describe as up-trend while inside; bearish only after a close below the lower line.
<!-- PROMPT_DIGEST:END -->
