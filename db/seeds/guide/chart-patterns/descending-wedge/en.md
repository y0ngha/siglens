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
    a: In a falling wedge the two lines converge; in a descending channel they run nearly parallel. Siglens treats a width ratio of 0.85 to 1.15 as a channel.
---

## How it looks

Highs and lows both fall, and the upper and lower trendlines converge toward a single point. Both slope downward, but the upper line is steeper, so the range narrows into a wedge. It is the opposite shape of a [rising wedge](/guide/chart-patterns/ascending-wedge).

## What it tells you

Price is falling, but the range of movement shrinks as it drops. That signals fading downward momentum, so a close above the upper line is read as a turn up. It is known as a reversal pattern at the end of a downtrend.

In Thomas Bulkowski's tabulation, 68% broke upward. But performance after the breakout was on the low side among bullish patterns. It is considered more reliable when volume shrinks during the narrowing and rises on the breakout.

## How it differs from a rising wedge

A falling wedge has a clearer direction than a [rising wedge](/guide/chart-patterns/ascending-wedge) and better results. 68% broke upward, and after an upward breakout the break-even failure rate (the share that ended without moving far enough in the breakout direction) was 26%, with 62% reaching the target. Compared with rising wedges that broke down (51% failure, 32% target rate), the gap is large.

That does not make it a strong pattern. It ranked 31st of 39 bullish patterns, and Bulkowski called it a poor performer as bullish chart patterns go. The remaining 32% broke downward, with a 29% failure rate. A falling wedge that forms while earnings are worsening or the sector is weak can resolve downward instead of up. A bullish divergence, where price keeps falling inside the wedge while the lows of [RSI](/guide/indicators/rsi) or [MACD](/guide/indicators/macd) get higher, adds weight to the upside.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). It draws the upper and lower boundaries through the 5 to 8 most recent swings, then extends back to earlier swings (up to 16) as long as the same lines still hold. Each line passes through actual swing extremes.

- Both lines must fall at least 1.5 times ATR over the span.
- Both lines must be touched at least 3 times (a swing counts as a touch if it is within 0.35 times ATR of the line). No bar in the span may poke out past a line by more than 0.25 times ATR.
- The final width must be 0.7 times the starting width or less. Ratios between 0.7 and 0.85 are not drawn, and a ratio of 0.85 to 1.15 means the lines are parallel, so it is a channel rather than a wedge.
- It must span at least 15 bars, and the width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Siglens takes the direction of this pattern as up. The measured target is the upper line plus the starting width (the pattern height), and the conservative target is the upper line plus half the height. The invalidation level is the last swing low that touched the lower line. A close below it means the bullish pattern has failed.

If the close breaks above the upper line by more than 0.25 times ATR and the last close then returns inside the wedge, Siglens marks it as a "failed breakout".

## Watch out for

- With fewer than 3 touches, it is hard to call it a wedge.
- A breakout near the apex leaves little room to move, so it tends to be weak.
- If volume changes little while the wedge forms, it is considered less reliable.
- If the two lines are nearly parallel, it may be a [descending channel](/guide/chart-patterns/descending-channel) rather than a wedge.
- Trendlines vary a little from person to person, so interpretations by eye can differ.
