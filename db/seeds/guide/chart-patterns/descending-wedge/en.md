---
title: Falling Wedge
aliases: [Descending Wedge, Falling Wedge Pattern]
summary: Highs and lows both fall, but the range narrows. A break above the upper line is read as a reversal up.
seoTitle: "Falling Wedge Pattern: Meaning and Reliability"
seoDescription: Why a falling wedge at the end of a downtrend is read as a bullish signal, how to confirm a break above its upper line, and how to filter out false signals.
demoCaption: Synthetic, illustrative bars. Shows two falling, converging trendlines and a bar closing above the upper line.
faq:
  - q: Why is a falling wedge a bullish signal?
    a: Price keeps falling, but lows fall by less than highs do, so downward momentum fades as price drops. That is why a break of the upper line is read as a reversal up.
  - q: How reliable is a falling wedge?
    a: Not very. In Thomas Bulkowski's tabulation, 68% broke upward, but performance after the breakout ranked on the low side among bullish patterns.
  - q: How is it different from a descending channel?
    a: In a falling wedge the two lines converge; in a descending channel they run nearly parallel. SIGLENS treats a width ratio of 0.85 to 1.15 as a channel.
---

## What it looks like

Highs and lows both move lower while the two trendlines above and below converge toward a point. Both slope down, but the upper line is steeper, so the range narrows into a wedge. It is the mirror image of the [rising wedge](/guide/chart-patterns/ascending-wedge).

## What it tells you

Price is falling, but the swings get smaller as it falls. That is a sign downward pressure is fading, so a close above the upper line is read as a turn up. It is known as a reversal pattern that appears at the end of a downtrend.

In the counts of Thomas Bulkowski, who tallied what actually happened after patterns across decades of US stock charts and published the results, 68% broke upward. Performance after the breakout, however, was on the low side among bullish patterns. Volume that shrinks as the wedge narrows and then rises on the breakout adds weight to the signal.

## How it differs from a rising wedge

The falling wedge has a clearer direction than the [rising wedge](/guide/chart-patterns/ascending-wedge) and better results.

- 68% broke upward.
- After an upward breakout, the share that failed to move far enough (the break-even failure rate) was 26%, and 62% reached the price target.
- A rising wedge that broke down had a 51% failure rate and reached its target 32% of the time, a wide gap.

That does not make it a strong pattern. Its performance rank (a ranking by how far price went afterward) was 31st of 39 bullish patterns, and Bulkowski himself rated it a poor performer among bullish chart patterns. The other 32% broke down, with a 29% failure rate in that case. A falling wedge that forms while earnings are deteriorating or the whole sector is weak can resolve downward instead of up. A bullish divergence (price and an indicator pointing different ways), where price makes lower lows inside the wedge while [RSI](/guide/indicators/rsi) or [MACD](/guide/indicators/macd) makes higher lows, adds to the upside case.

## How SIGLENS finds it

SIGLENS connects clear turning points (swings: highs and lows where price reversed more than 1.5 times [ATR](/guide/indicators/atr), the average range of recent bars) into upper and lower boundary lines, and checks whether both fall while narrowing. It starts with the latest 5–8 swings and, if the same shape holds, extends back to earlier swings (up to 16).

- Both lines fall at least 1.5 ATR over the pattern.
- Each line is touched at least three times. A swing within 0.35 ATR of a line counts as a touch.
- No bar inside the span pokes more than 0.25 ATR outside the lines.
- The final width is 0.7× the starting width or less. A ratio of 0.7–0.85 is not treated as a wedge, and a nearly parallel 0.85–1.15 counts as a channel.
- It spans at least 15 bars, and the width at the first touch (the pattern height) is at least 2.5 ATR and at least a minimum share of price (0.5% on 5–30 minute bars, 1% on 1–4 hour bars, 3% on daily bars).

SIGLENS treats the direction as up and computes the measured target as the upper line plus the pattern height, and the conservative target as the upper line plus half the height. A target is the price reached if price moves another pattern height; it is a reference based on how often that happened in the past, not a promise. The invalidation level (the price at which the pattern counts as broken) is the last swing low that touched the lower line. A close below it breaks the bullish pattern.

If a close clears the upper line by more than 0.25 ATR and the latest close is back inside the wedge, SIGLENS marks it as a "failed breakout."

## Watch out when

- With fewer than three touches on the lines, it is hard to call it a wedge.
- A breakout near the apex has little room to run and tends to be weak.
- If volume shows no clear change while the wedge forms, the signal is rated lower.
- If the two lines are nearly parallel, it may be a [descending channel](/guide/chart-patterns/descending-channel) rather than a wedge.
- Trendlines vary a little depending on who draws them, so readings by eye can differ.
