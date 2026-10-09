---
title: Rectangle
aliases: [Trading Range, Box Range, Rectangle Pattern, Sideways Range]
summary: Price moves between flat resistance and support. Upward breakouts were more common whatever the prior trend.
seoTitle: "Rectangle Pattern: Breakouts and Direction"
seoDescription: What a rectangle (trading range) looks like, which way it tends to break in Bulkowski's data, how many touches Siglens requires, and how to read false breaks.
demoCaption: Synthetic, illustrative bars. Shows flat resistance and support lines and a bar closing above the box.
faq:
  - q: Does a rectangle break up or down?
    a: Upward breakouts were more common. In Thomas Bulkowski's tabulation, 63% of boxes after an advance and 59% of boxes after a decline broke upward. Downward breaks also performed clearly worse afterward.
  - q: Is every sideways range a rectangle?
    a: No. Siglens only treats it as a rectangle if both lines are flat, each is touched at least 3 times, and it lasts at least 15 bars. If one side is touched only twice, it is hard to tell apart from a double or triple top or bottom.
  - q: When is a rectangle breakout confirmed?
    a: Many traders look for a close clearly beyond the top or bottom of the box on rising volume.
---

## How it looks

The highs stall at a horizontal line at nearly the same price, and the lows find support at another horizontal line at nearly the same price. Price moves back and forth between the two lines, forming a box. It should show clear bounces off each line, not a slow drift.

## What it tells you

Buyers and sellers are in balance. Textbooks treat it as a rest in the prior trend: a box after an advance breaks upward and a box after a decline breaks downward, so the trend continues. A break in the opposite direction is read as a trend reversal.

The actual numbers lean upward. In Thomas Bulkowski's tabulation, 63% of boxes after an advance and 59% of boxes after a decline broke upward. So even boxes after a decline turned up more often than they continued down. Downward breaks also performed worse afterward. It is considered more reliable if volume shrinks inside the box and rises on the breakout.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). It draws the upper and lower boundaries through the 5 to 8 most recent swings, then extends back to earlier swings (up to 16) as long as the same lines still hold. Each line passes through actual swing extremes.

- Both lines must be flat: across the whole pattern each moves less than the smaller of 0.75 times ATR and 1.5% of price (more generous than the 1% used for other patterns).
- Both lines must be touched at least 3 times (a swing counts as a touch if it is within 0.35 times ATR of the line). With only 2 touches each, it would overlap with double and triple tops and bottoms. No bar in the span may poke out past a line by more than 0.25 times ATR.
- It must span at least 15 bars, and the width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Direction follows the prior trend: the side toward which the close moved at least 2 times ATR over the 20 bars before the pattern. If there is no such trend, Siglens sets no direction and calculates no target. Once a direction is set, the measured target is the box height projected from the boundary on the breakout side, and the conservative target is half of that. The invalidation level is the price of the last swing that touched the opposite boundary.

If the close moves beyond a boundary by more than 0.25 times ATR and the last close then returns inside the box, Siglens marks it as a "failed breakout".

## Watch out for

- If either boundary has too few touches, it is hard to call it a box.
- If volume inside the box is large and erratic, it is considered less reliable.
- Without a clear prior trend, the breakout direction is hard to gauge.
- If there have already been several false breakouts, the boundaries may have lost meaning.
- Downward breaks have tended to perform weakly, so they are often not weighted the same as upward breaks.
- A target is not a price that will surely be reached. In Bulkowski's tabulation, a fair number of boxes that broke downward fell short of the target.
