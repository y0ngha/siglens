---
title: Rectangle
aliases: [Trading Range, Box Range, Rectangle Pattern, Sideways Range]
summary: Price moves between flat resistance and support. Upward breakouts were more common whatever the prior trend.
seoTitle: "Rectangle Pattern: Breakouts and Direction"
seoDescription: How to judge the breakout direction of a rectangle (trading range), how it relates to the prior trend, and how to spot false breakouts, with an example chart.
demoCaption: Synthetic, illustrative bars. Shows flat resistance and support lines and a bar closing above the box.
faq:
  - q: Does a rectangle break up or down?
    a: Upward breakouts were more common. In Thomas Bulkowski's tabulation, 63% of boxes after an advance and 59% of boxes after a decline broke upward. Downward breaks also performed clearly worse afterward.
  - q: Is every sideways range a rectangle?
    a: No. Siglens only treats it as a rectangle if both lines are flat, each is touched at least 3 times, and it lasts at least 15 bars. If one side is touched only twice, it is hard to tell apart from a double or triple top or bottom.
  - q: When is a rectangle breakout confirmed?
    a: A breakout is confirmed when the close moves clearly beyond the top or bottom of the box on rising volume.
---

## How it looks

The highs stall at a horizontal line at nearly the same price, and the lows find support at another horizontal line at nearly the same price. Price moves back and forth between the two lines, forming a box. It should show clear bounces off each line, not a slow drift.

## What it tells you

Buyers and sellers are in balance. Textbooks treat it as a rest in the prior trend: a box after an advance breaks upward and a box after a decline breaks downward, so the trend continues. A break in the opposite direction is read as a trend reversal.

The actual numbers lean upward. In the tabulation of Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in books, 63% of boxes after an advance and 59% of boxes after a decline broke upward. So even boxes after a decline turned up more often than they continued down. Downward breaks also performed worse afterward. A breakout counts as more reliable when volume shrinks inside the box and rises on the break.

## How Siglens detects it

Siglens connects clearly turned highs and lows (swings: turning points from which price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average size of recent bars' moves) into upper and lower boundaries, then checks that both lines are flat and touched several times. The conditions:

- Both lines must be flat. Over the whole pattern each line must move less than the smaller of 0.75 times ATR and 1.5% of price (looser than the 1% used for other patterns).
- Both lines must be touched at least 3 times. A swing within 0.35 times ATR of a line counts as a touch. With only two touches per side, the shape cannot be told apart from a double or triple top or bottom.
- No bar inside the pattern may stick out beyond a line by more than 0.25 times ATR.
- It must last at least 15 bars.
- The width at the first touch must be at least 2.5 times ATR and also at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Direction follows the prior trend: the side toward which the close moved by at least 2 times ATR over the 20 bars before the pattern. Without a trend that large, Siglens sets no direction and computes no target. Siglens assumes the prior trend's direction, while keeping in mind that in the tabulation upward breaks were more common whatever the prior trend.

Once a direction is set, the measured target is the box height projected from the boundary on the breakout side, and the conservative target is half of that. The target is the price reached if the move repeats the pattern's height; it is a reference value because past moves often went that far, not a promise that price will get there. The invalidation level is the price at which the pattern is considered broken: the last swing that touched the opposite boundary.

If the close moves beyond a boundary by more than 0.25 times ATR and the last close then returns inside the box, Siglens marks it as a "failed breakout".

## Watch out for

- If either boundary has too few touches, it is hard to call it a box.
- Heavy, erratic volume inside the box lowers reliability.
- Without a clear prior trend, it is hard to gauge the breakout direction.
- If there have already been several false breakouts, the boundaries may have lost meaning.
- Downward breaks tend to perform worse, so they are not weighted the same as upward breaks. In Bulkowski's tabulation, too, many boxes that broke downward fell short of the target.
