---
title: Falling Wedge
aliases: [Descending Wedge, Falling Wedge Pattern]
summary: Highs and lows both fall, but the range narrows. A break above the upper line is read as a reversal up.
seoTitle: "Falling Wedge Pattern: Meaning and Reliability"
seoDescription: What a falling wedge looks like, why breaking the upper line is read as a reversal, how reliable it was in Bulkowski's data, and how it differs from a channel.
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
