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
    a: Thomas Bulkowski rated the broadening top as a poor performer. Upward breakouts did clearly better than downward ones.
---

## How it looks

Highs keep getting higher and lows keep getting lower, so the range widens over time like a megaphone. The upper line rises and the lower line falls, and they spread apart. It looks like a [symmetrical triangle](/guide/chart-patterns/symmetrical-triangle) flipped left to right.

## What it tells you

Price swings wider and wider in both directions. It sets new highs and new lows, but no direction is established; only volatility grows. Many traders take it as a sign of an unstable market.

The direction only shows after price leaves the lines. In Thomas Bulkowski's tabulation, 60% broke upward for both the top and bottom versions, and the upward breakouts also performed better afterward. It is said to work better when volume rises inside the pattern.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). It draws the upper and lower boundaries through the 5 to 8 most recent swings, then extends back to earlier swings (up to 16) as long as the same lines still hold. Each line passes through actual swing extremes.

- The upper line must rise and the lower line must fall, each by at least 1.5 times ATR over the span.
- The final width must be at least 1.3 times the starting width.
- There must be at least 5 touches in total and at least 3 on one line (a swing counts as a touch if it is within 0.35 times ATR of the line). No bar in the span may poke out past a line by more than 0.25 times ATR.
- It must span at least 15 bars, and the width at the last touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars). Because the pattern keeps widening, the height is measured at the last touch.

Direction follows the prior trend: the side toward which the close moved at least 2 times ATR over the 20 bars before the pattern. If there is no such trend, Siglens sets no direction and calculates no target. Once a direction is set, the measured target is the pattern height projected from the line on that side, and the conservative target is half of that.

If the close moves beyond a line by more than 0.25 times ATR and the last close then returns inside, Siglens marks it as a "failed breakout".

## Watch out for

- If there are only the minimum 5 touches, the shape may be loose.
- One large spike at the end can widen the range and make it look like a broadening formation. Bulkowski treated this as a channel with a single spike attached at the end.
- If price moves back toward the line after leaving it, results afterward are said to be worse.
- If price hugs one side instead of moving between both lines, the pattern means less.
- Downward breakouts have performed worse than upward ones, so they are generally not weighted the same.
