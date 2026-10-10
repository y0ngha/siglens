---
title: Triple Top
aliases: [Triple Top Pattern, Three-Top Pattern]
summary: Three highs at similar levels; a break of the neckline through the lows between them is read as a turn down.
seoTitle: "Triple Top Pattern: How to Read It"
seoDescription: A triple top turns down after price is stopped three times at a similar height. See how it differs from a double top and how to check the neckline break and volume.
demoCaption: Synthetic, illustrative bars. Shows three highs, the neckline through the two lows between them, and a bar closing below the neckline.
faq:
  - q: Is a triple top more reliable than a double top?
    a: Being stopped three times at the same price makes the shape more distinct, but it does not work out proportionally better. In Thomas Bulkowski's tabulation of bull-market cases, only 49% of triple tops reached their target.
  - q: When is a triple top considered complete?
    a: When a close falls below the neckline (for Siglens, the lower of the two lows). A wick that breaks it intraday and returns is not a confirmation.
  - q: What if the lows keep rising?
    a: If the highs stall at the same price but the lows rise, it is closer to an ascending triangle than a triple top. In that case, an upward breakout is also possible.
---

## How it looks

Price rises to a similar high and gets pushed back down three times. Two lows form between the highs, and the line connecting those two lows is the neckline. It is a [double top](/guide/chart-patterns/double-top) with one more high added. Instead of a sloped line through the two lows, Siglens draws a horizontal line at the lower of the two and uses it as the neckline.

## What it tells you

If an advance was stopped three times in the same price zone, that price is acting as resistance. It is read as a sign that the uptrend may be ending and turning down.

The pattern completes only when a close finishes below the neckline. Volume that shrinks with each new high, then rises as price breaks the neckline, makes it more reliable. Even so, in the tabulation of Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in books, the triple top sat in the lower ranks of his performance ranking (a ranking by how far price went after the breakout): 24th of 36 bearish patterns. Confirming resistance one more time does not make it work out proportionally better.

## How Siglens detects it

Siglens checks whether the three most recent clearly turned highs (swing highs: turning points from which price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average size of recent bars' moves) sit at a similar price. Once a swing is set, it does not change as more bars arrive. The conditions:

- The gap between the highest and lowest of the three highs must be within the smaller of 1 times ATR and 3% of the average price.
- Neighboring highs must be at least 10 bars apart, so the whole pattern spans at least 21 bars.
- Between the first and last high, no bar may rise above the highs by more than 0.25 times ATR.
- The neckline is a horizontal line at the lower of the two lows.
- The height (from the average high to the neckline) must be at least 2.5 times ATR and also at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).
- If the lows between the highs rise clearly toward the highs (by 1.5 times ATR or more), Siglens treats it as an [ascending triangle](/guide/chart-patterns/ascending-triangle), not a triple top.
- If the third high is older than the last 20 bars or half the pattern's length, whichever is longer, it is not shown.

The measured target subtracts the pattern's height from the neckline, and the conservative target subtracts half the height. The target is the price reached if the move repeats the pattern's height; it is a reference value, not a promise. Fewer than half of triple tops reached it. The invalidation level is the price at which the pattern is considered broken: the highest of the three highs. If a close rises above it, the pattern is treated as broken.

## Watch out for

- In a directionless, choppy market, three highs can end up at similar prices by chance.
- If the third high is clearly lower than the first two, it may be a gentle downtrend.
- If the lows between the highs are not at least 3% below the average high, the dips are too shallow to count as a neckline.
- If volume does not shrink as the highs repeat, there is little evidence that buying has weakened.
- A wick that dips below the neckline intraday and comes back is not a confirmation.
