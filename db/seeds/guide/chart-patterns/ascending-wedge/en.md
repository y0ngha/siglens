---
title: Rising Wedge
aliases: [Ascending Wedge, Rising Wedge Pattern]
summary: Highs and lows both rise, but the range narrows. A break below the lower line is read as a reversal down.
seoTitle: "Rising Wedge Pattern: Meaning and Reliability"
seoDescription: What a rising wedge looks like, why a break of the lower line is read as a reversal, how reliable it was in Bulkowski's data, and how it differs from a channel.
demoCaption: Synthetic, illustrative bars. Shows two rising, converging trendlines and a bar closing below the lower line.
faq:
  - q: Why is a rising wedge a bearish signal?
    a: Price keeps rising, but highs rise by less than lows do, so upward momentum fades as price climbs. That is why a break of the lower line is read as a reversal down.
  - q: How do I tell a rising wedge from an ascending channel?
    a: In a rising wedge the two lines converge; in an ascending channel they run nearly parallel. Siglens treats a width ratio of 0.85 to 1.15 as a channel.
  - q: How reliable is a rising wedge?
    a: Not very. In Thomas Bulkowski's tabulation, only 32% of rising wedges that broke downward reached their target.
---

## How it looks

Highs and lows both rise, and the upper and lower trendlines converge toward a single point. Both slope upward, but the lower line is steeper, so the range narrows into a wedge.

## What it tells you

Price is rising, but the range of movement shrinks as it climbs. That signals fading upward momentum, so a close below the lower line is read as a turn down. For this reason it is known as a reversal pattern at the end of an uptrend.

Its track record is poor, though. In Thomas Bulkowski's tabulation, 60% broke downward, but after breaking down, its performance ranked last among 36 bearish patterns. It is considered more reliable when volume shrinks during the narrowing and rises as the lower line breaks.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). It draws the upper and lower boundaries through the 5 to 8 most recent swings, then extends back to earlier swings (up to 16) as long as the same lines still hold. Each line passes through actual swing extremes.

- Both lines must rise at least 1.5 times ATR over the span.
- Both lines must be touched at least 3 times (a swing counts as a touch if it is within 0.35 times ATR of the line). No bar in the span may poke out past a line by more than 0.25 times ATR.
- The final width must be 0.7 times the starting width or less. Ratios between 0.7 and 0.85 are not drawn, and a ratio of 0.85 to 1.15 means the lines are parallel, so it is a channel rather than a wedge.
- It must span at least 15 bars, and the width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Siglens takes the direction of this pattern as down. The measured target is the lower line minus the starting width (the pattern height), and the conservative target is the lower line minus half the height. The invalidation level is the last swing high that touched the upper line. A close above it means the bearish pattern has failed.

If the close breaks below the lower line by more than 0.25 times ATR and the last close then returns inside the wedge, Siglens marks it as a "failed breakout".

## Watch out for

- With fewer than 3 touches, it is hard to call it a wedge.
- A break near the apex leaves little width to project, so the move tends to be weak.
- If volume does not shrink during the narrowing, it is considered less reliable.
- If the two lines are nearly parallel, it may be an [ascending channel](/guide/chart-patterns/ascending-channel) rather than a wedge.
- Trendlines vary a little from person to person, so interpretations by eye can differ.
