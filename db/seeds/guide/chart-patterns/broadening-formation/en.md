---
title: Broadening Formation
aliases: [Megaphone Pattern, Broadening Top, Broadening Bottom, Expanding Triangle]
summary: Highs get higher and lows get lower, so the range keeps widening like a megaphone. It can break either way.
seoTitle: Broadening Formation (Megaphone) Pattern Explained
seoDescription: The megaphone shape of a broadening formation, where highs and lows keep spreading apart, how many touches each line needs, and how to judge the breakout direction.
demoCaption: Synthetic, illustrative bars. Shows a rising upper line and a falling lower line that spread apart, with bars moving between them.
faq:
  - q: Is a broadening formation a top or a bottom signal?
    a: Either. One that appears at the end of an advance is called a broadening top, and one at the end of a decline a broadening bottom. Siglens does not name them separately; it reads it as a top if the trend before the pattern was up and as a bottom if it was down.
  - q: How is it different from a triangle?
    a: A triangle narrows and a broadening formation widens. In a broadening formation highs rise, lows fall, and volatility grows.
  - q: Is it reliable?
    a: Thomas Bulkowski rated the broadening top as a poor performer. Both tops and bottoms broke upward 60% of the time, but bottoms ranked higher on how far price went after the breakout. In both, upward breakouts did clearly better than downward ones.
---

## How it looks

Highs keep getting higher and lows keep getting lower, so the range widens over time like a megaphone. The upper line rises and the lower line falls, and they spread apart. It looks like a [symmetrical triangle](/guide/chart-patterns/symmetrical-triangle) flipped left to right.

## What it tells you

Price swings wider and wider in both directions. It sets new highs and new lows, but no direction is established; only volatility grows. So it is read as a sign of an unstable market.

The direction only shows after price leaves the lines. In the tabulation of Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in his books, 60% broke upward for both the top and bottom versions. In both, the upward breakouts also performed better afterward. In the performance ranking, though, which orders patterns by how far price went after the breakout, the bottom version ranked higher than the top, and Bulkowski called the broadening top a poor performer. Results were reportedly better when volume rose inside the pattern.

## How Siglens detects it

Siglens connects clearly turning highs and lows (swings: turning points where price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average range of recent bars) to draw the upper and lower boundaries. When the upper line rises, the lower line falls, and the gap clearly widens, it treats the shape as a broadening formation.

- The upper line must rise and the lower line must fall, each moving at least 1.5 times ATR over the pattern.
- The final width must be at least 1.3 times the starting width.
- There must be at least 5 touches in total, with at least 3 on one line. A swing within 0.35 times ATR of a line counts as a touch.
- No bar may poke out past a line by more than 0.25 times ATR.
- It must last at least 15 bars.
- The width at the last touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars). Because the pattern keeps widening, height is measured at the last touch.

Siglens does not label tops and bottoms separately; direction comes from the trend over the 20 bars before the pattern. The side toward which the close moved at least 2 times ATR in that span sets the direction; with no such trend, Siglens sets neither a direction nor a target. Siglens assumes the prior trend's direction, but keeps in mind that the tabulation found more upward breakouts.

Once a direction is set, the measured target is the pattern height projected from the line on that side, and the conservative target is half of that. A target is the price reached if the move extends by the pattern's height: a reference value drawn from past cases, not a promise. The invalidation level, the price at which the pattern is considered broken, is the last swing that touched the opposite line.

If the close moves beyond a line by more than 0.25 times ATR and the last close then returns inside, Siglens marks it as a "failed breakout".

## Watch out for

- If there are only the minimum 5 touches, the shape may be loose.
- One large spike at the end can widen the range and make it look like a broadening formation. Bulkowski treated this as a channel with a single spike attached at the end.
- If price moves back toward the line after leaving it, results afterward are said to be worse.
- If price hugs one side instead of moving between both lines, the pattern means less.
- Downward breakouts have performed worse than upward ones, so they are generally not weighted the same.
