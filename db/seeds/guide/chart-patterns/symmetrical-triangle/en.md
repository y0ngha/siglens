---
title: Symmetrical Triangle
aliases: [Converging Triangle, Symmetric Triangle, Coil]
summary: Highs fall and lows rise, so the range narrows. The direction only shows once price leaves one of the lines.
seoTitle: "Symmetrical Triangle Pattern: How to Read It"
seoDescription: How to judge the breakout direction of a symmetrical triangle, and how to spot weak signals such as breakouts that come only near the apex.
demoCaption: Synthetic, illustrative bars. Shows a falling upper line, a rising lower line, and a bar breaking out of the lines.
faq:
  - q: Will a symmetrical triangle go up or down?
    a: The shape alone cannot tell you. It often continues in the direction of the prior trend, but you judge the direction only after a close leaves one of the lines. In Thomas Bulkowski's tabulation, 60% broke upward.
  - q: What kind of pattern is a symmetrical triangle?
    a: In textbooks it is a continuation pattern, a pause in the prior trend. After price movement shrinks, a large move in one direction often follows, so it is also read as a sign that volatility is about to increase.
  - q: How is it different from an ascending triangle?
    a: In an ascending triangle the upper line is flat; in a symmetrical triangle the upper line falls and the lower line rises. If either line is nearly flat, it is not a symmetrical triangle.
---

## How it looks

Highs get lower and lows get higher, one step at a time. The upper and lower trendlines converge toward a single point (the apex), forming a triangle in which both lines have a clear slope.

## What it tells you

Buyers and sellers are evenly matched and the price range keeps shrinking. After the range narrows like this, a large move in one direction often follows, so the triangle itself is read as a sign that volatility is about to rise.

Textbooks say it continues in the direction of the prior trend. But in Thomas Bulkowski's tabulation, only 60% broke upward, and the pattern's overall performance was on the low side. Because neither side clearly dominates, it is usual to judge only after a close clearly leaves one of the lines.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). It draws the upper and lower boundaries through the 5 to 8 most recent swings, then extends back to earlier swings (up to 16) as long as the same lines still hold. Each line passes through actual swing extremes.

- The upper line must fall and the lower line must rise, each by at least 1.5 times ATR. A line that moves no more than the smaller of 0.75 times ATR and 1% of price is treated as flat, and the pattern then becomes an [ascending triangle](/guide/chart-patterns/ascending-triangle) or [descending triangle](/guide/chart-patterns/descending-triangle).
- Both lines must be touched at least twice (a swing counts as a touch if it is within 0.35 times ATR of the line). No bar in the span may poke out past a line by more than 0.25 times ATR.
- The width at the end must have narrowed to 0.7 times the starting width or less.
- It must span at least 15 bars, and the width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Direction follows the prior trend: the side toward which the close moved at least 2 times ATR over the 20 bars before the pattern. If there is no such trend, Siglens sets no direction and calculates no target. Once a direction is set, the measured target is the starting width (the pattern height) projected from the line on the breakout side, and the conservative target is half of that. The invalidation level is the price of the last swing that touched the opposite line.

If the close moves beyond a line by more than 0.25 times ATR and the last close then returns inside the triangle, Siglens marks it as a "failed breakout". The shape is still there, but the breakout is not treated as confirmed.

## Watch out for

- If it forms in a sideways range with no clear prior trend, there is little basis for gauging the direction.
- A breakout near the apex or after it tends to be weak.
- A break in the direction opposite to the prior trend is considered less reliable.
- If volume stays high while the triangle narrows, the outcome may not be settled yet.
- If either line has fewer than 2 touches, it is hard to call it a triangle.
