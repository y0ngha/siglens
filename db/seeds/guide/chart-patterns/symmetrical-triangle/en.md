---
title: Symmetrical Triangle
aliases: [Converging Triangle, Symmetric Triangle, Coil]
summary: Highs fall and lows rise, so the range narrows. The direction only shows once price leaves one of the lines.
seoTitle: "Symmetrical Triangle Pattern: How to Read It"
seoDescription: How to judge the breakout direction of a symmetrical triangle, and how to spot weak signals such as breakouts that come only near the apex.
demoCaption: Synthetic, illustrative bars. Shows a falling upper line, a rising lower line, and a bar breaking out of the lines.
faq:
  - q: Will a symmetrical triangle go up or down?
    a: The shape alone cannot tell you. Textbooks say it continues in the direction of the prior trend, but you judge the direction only after a close leaves one of the lines. In Thomas Bulkowski's tabulation, 60% broke upward.
  - q: What kind of pattern is a symmetrical triangle?
    a: In textbooks it is a continuation pattern, a pause in the prior trend. After price movement shrinks, a large move in one direction often follows, so it is also read as a sign that volatility is about to increase.
  - q: How is it different from an ascending triangle?
    a: In an ascending triangle the upper line is flat; in a symmetrical triangle the upper line falls and the lower line rises. If either line is nearly flat, it is not a symmetrical triangle.
---

## How it looks

Each high is a little lower than the last, and each low a little higher. The upper and lower trendlines converge toward a single point (the apex), forming a triangle, and both lines have a clear slope.

## What it tells you

Buyers and sellers are evenly matched and the price range keeps shrinking. After the range narrows like this, a large move in one direction often follows, so the triangle itself is read as a sign that volatility is about to increase.

Textbooks say it continues in the direction of the prior trend. But in the tabulation of Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in books, only 60% broke upward. Its performance ranking (a ranking by how far price went after the breakout) was also low: 36th of 39 bullish patterns for upward breaks. Since neither side clearly dominates, the direction is judged only after a close clearly leaves one of the lines.

## How SIGLENS detects it

SIGLENS connects clearly turned highs and lows (swings: turning points from which price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average size of recent bars' moves) into upper and lower lines, then checks whether the upper line falls, the lower line rises, and the gap narrows. The conditions:

- The upper line falls and the lower line rises, each by at least 1.5 times ATR. A line that moves no more than the smaller of 0.75 times ATR and 1% of price is treated as flat, and the pattern is classed as an [ascending triangle](/guide/chart-patterns/ascending-triangle) or [descending triangle](/guide/chart-patterns/descending-triangle) instead.
- Both lines must be touched at least twice. A swing within 0.35 times ATR of a line counts as a touch.
- No bar inside the pattern may stick out beyond a line by more than 0.25 times ATR.
- The width at the end must narrow to 0.7 times the starting width or less.
- It must last at least 15 bars.
- The width at the first touch must be at least 2.5 times ATR and also at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Direction follows the prior trend: the side toward which the close moved by at least 2 times ATR over the 20 bars before the pattern. Without a trend that large, SIGLENS sets no direction and computes no target. SIGLENS assumes the prior trend's direction, while keeping in mind that in the tabulation upward breaks were more common, at 60%.

Once a direction is set, the measured target is the starting width (the pattern's height) projected from the line on the breakout side, and the conservative target is half of that. The target is the price reached if the move repeats the pattern's height; it is a reference drawn from past cases, not a promise that price will get there. Past cases reached it a little over half the time after upward breaks, and less often after downward breaks. The invalidation level is the price at which the pattern is considered broken: the last swing that touched the opposite line.

If the close moves beyond a line by more than 0.25 times ATR and the last close then returns inside the triangle, SIGLENS marks it as a "failed breakout". The shape is still there, but the breakout has not been confirmed.

## Watch out for

- If it forms in a sideways range with no clear prior trend, there is little basis for gauging the direction.
- Breakouts near or after the apex tend to be weak.
- A break opposite to the prior trend is less reliable.
- If volume stays high even as the triangle narrows, the outcome may still be undecided.
- If either line has fewer than 2 touches, it is hard to call it a triangle.
