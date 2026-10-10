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
    a: Both have highs stalling at the same price, but in an ascending triangle the lows keep rising. When the lows between the highs rise by at least 1.5 times ATR (the average range of recent bars), Siglens treats it as a triangle and excludes it from double and triple tops.
  - q: When is a breakout confirmed?
    a: Many traders look for a close above the flat resistance line, and give the signal more weight when volume rises with it.
---

## How it looks

The highs stall at nearly the same price along a horizontal line, while each low is higher than the one before. With a flat top and a rising bottom, price is squeezed into a narrowing space and forms a triangle.

## What it tells you

Sellers stop price at the same level every time, but buyers step in at higher prices each time. Buyers are steadily pushing price up, so many traders lean toward an upward break through resistance.

That is only a modest tilt, not a certainty. Thomas Bulkowski counted what actually happened after patterns across decades of US stock charts and published the results in his books. In his tabulation, 63% broke upward and more than a third broke down. A breakout counts when the close finishes above resistance on rising volume. Volume usually shrinks as the triangle narrows.

## How it differs from a descending triangle

An ascending triangle leans toward one side. In Bulkowski's tabulation, the 63% that broke upward had a break-even failure rate (the share that did not travel far enough after the breakout) of 17%, and 70% reached the target. A target is the price reached if the move extends by the pattern's height: a reference value based on how often past patterns went that far, not a promise. In the performance ranking, which orders patterns by how far price went after the breakout, it came 16th of 39 bullish patterns.

The part to be careful with is the remainder that broke down. Ascending triangles that broke downward had a 38% failure rate and a 44% target hit rate, ranking only 30th of 36 bearish patterns. Unlike a [descending triangle](/guide/chart-patterns/descending-triangle), where up and down are nearly even, an ascending triangle gives some grounds for expecting the upside. Once it breaks down, though, the move that follows is hard to rely on too.

A breakout is considered strongest when it comes 50% to 75% of the way from the start of the triangle to its apex. Volume on the breakout bar at least 50% above average, and a pullback after the breakout that holds at the old resistance line, add support. If the lows rise faster and faster, it is read as buying pressure growing.

## How Siglens detects it

Siglens connects clearly turning highs and lows (swings: turning points where price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average range of recent bars) to draw the upper and lower boundaries. When the upper line is nearly flat, only the lower line rises, and the gap narrows, it treats the shape as an ascending triangle.

- The upper line must be flat: over the whole pattern it must move less than the smaller of 0.75 times ATR and 1% of price.
- The lower line must rise at least 1.5 times ATR.
- Swings must touch each line at least twice. A swing within 0.35 times ATR of a line counts as a touch.
- No bar may poke out past a line by more than 0.25 times ATR.
- The width at the end must narrow to 0.7 times the starting width or less.
- It must last at least 15 bars.
- The width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Following the textbook, the direction is set upward for the calculation. The measured target is the resistance line plus the starting width (the pattern's height), and the conservative target adds half the height. The invalidation level, the price at which the pattern is considered broken, is the last low that touched the lower line.

If the close breaks above resistance by more than 0.25 times ATR and the last close then returns inside the triangle, Siglens marks it as a "failed breakout". The shape is still there, but because price broke out once and came back, the breakout is not treated as confirmed.

## Watch out for

- If either line has fewer than 2 touches, it is hard to call it a triangle.
- A breakout near the apex or after it tends to be weak.
- If it forms in a sideways range with no prior uptrend, it is considered less reliable.
- If volume rises during the narrowing without a breakout, the signal is weighted lower.
- A close below the lower line means the pattern has failed, and some read it as a reversal to the downside.
