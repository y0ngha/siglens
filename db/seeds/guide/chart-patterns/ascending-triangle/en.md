---
title: Ascending Triangle
aliases: [Rising Triangle, Ascending Triangle Pattern]
summary: Highs stall at a flat line while lows keep rising and the range narrows. Breakouts go up more often than down.
seoTitle: "Ascending Triangle Pattern: How to Read It"
seoDescription: An ascending triangle forms from a flat resistance line and rising lows. How to confirm a break above resistance, what happens when it breaks down, and how to spot false breakouts.
demoCaption: Synthetic, illustrative bars. Shows a flat resistance line, a rising support line, and a bar breaking above resistance.
faq:
  - q: Does an ascending triangle always break upward?
    a: No. In Thomas Bulkowski's tabulation, 63% broke upward and the rest broke down. Judge the direction only after a close moves beyond one of the lines.
  - q: How do I tell an ascending triangle from a double or triple top?
    a: Both have highs stalling at the same price, but in an ascending triangle the lows keep rising. When the lows between the highs rise by at least 1.5 times ATR, Siglens treats it as a triangle and excludes it from double and triple tops.
  - q: When is a breakout confirmed?
    a: Many traders look for a close above the flat resistance line, and trust it more when volume rises with it.
---

## How it looks

The highs stall at nearly the same price along a horizontal line, while each low is higher than the one before. With a flat top and a rising bottom, price is squeezed into a narrowing space and forms a triangle.

## What it tells you

Sellers stop price at the same level every time, but buyers step in at higher prices each time. Buyers are steadily pushing price up, so many traders lean toward an upward break through resistance.

That is only a modest tilt, not a certainty. In Thomas Bulkowski's tabulation, 63% broke upward and more than a third broke down. A breakout counts when the close finishes above resistance on rising volume. Volume usually shrinks as the triangle narrows.

## How it differs from a descending triangle

An ascending triangle leans fairly clearly to one side. In Bulkowski's tabulation, 63% broke upward, and after an upward breakout the break-even failure rate (the share that ended without moving far enough in the breakout direction) was 17%, with 70% reaching the target. It ranked 16th of 39 bullish patterns.

The part to watch is the rest that broke down. Ascending triangles that broke downward had a 38% failure rate and a 44% target rate, ranking only 30th of 36 bearish patterns. Unlike the [descending triangle](/guide/chart-patterns/descending-triangle), which splits nearly evenly, the ascending triangle gives some reason to expect upside, but when it breaks down, the move that follows is hard to trust as well.

A breakout is considered most reliable when it comes 50% to 75% of the way from the triangle's start to its apex. Volume at least 50% above average on the breakout bar, and a pullback that finds support at the old resistance, add confirmation. Higher lows that rise faster and faster are read as buying pressure building.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). It draws the upper and lower boundaries through the 5 to 8 most recent swings, then extends back to earlier swings (up to 16) as long as the same lines still hold. Each line passes through actual swing extremes.

- The upper line must be flat: across the whole pattern it moves less than the smaller of 0.75 times ATR and 1% of price.
- The lower line must rise by at least 1.5 times ATR.
- Both lines must be touched at least twice (a swing counts as a touch if it is within 0.35 times ATR of the line). No bar in the span may poke out past a line by more than 0.25 times ATR.
- The width at the end must have narrowed to 0.7 times the starting width or less.
- It must span at least 15 bars, and the width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Siglens takes the breakout direction as up. The measured target is resistance plus the starting width (the pattern height), and the conservative target is resistance plus half the height. The invalidation level is the last low that touched the lower line.

If the close breaks above resistance by more than 0.25 times ATR and the last close then returns inside the triangle, Siglens marks it as a "failed breakout". The shape is still there, but because price broke out and came back, the breakout is not treated as confirmed.

## Watch out for

- If either line has fewer than 2 touches, it is hard to call it a triangle.
- A breakout near the apex or after it tends to be weak.
- If it forms in a sideways range with no prior uptrend, it is considered less reliable.
- If volume rises during the narrowing without a breakout, the signal is weighted lower.
- A close below the lower line means the pattern has failed, and some read it as a reversal to the downside.
