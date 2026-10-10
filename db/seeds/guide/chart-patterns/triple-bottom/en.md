---
title: Triple Bottom
aliases: [Triple Bottom Pattern, Three-Bottom Pattern]
summary: Three lows at similar levels; a move above the neckline through the highs between them is read as a turn up.
seoTitle: "Triple Bottom Pattern: How to Read It"
seoDescription: How a triple bottom differs from a double bottom, and how to check the neckline breakout and volume, with an example chart.
demoCaption: Synthetic, illustrative bars. Shows three lows, the neckline through the two highs between them, and a bar closing above the neckline.
faq:
  - q: How is a triple bottom different from a double bottom?
    a: The difference is whether the decline stopped at the same price zone twice or three times. A triple bottom takes longer to form and is rarer, but holding the same price three times is read as steady buying.
  - q: Is it a triple bottom if the middle low is much lower?
    a: No. If the middle low is clearly lower than the other two, it is treated as an inverse head and shoulders.
  - q: When is a triple bottom considered complete?
    a: When a close finishes above the neckline (for SIGLENS, the higher of the two highs). A wick that clears it intraday is not a confirmation.
---

## How it looks

Price falls to a similar low and bounces three times. Two highs form between the lows, and the line connecting those two highs is the neckline. It is a [double bottom](/guide/chart-patterns/double-bottom) with one more low added. Instead of a sloped line through the two highs, SIGLENS draws a horizontal line at the higher of the two and uses it as the neckline.

## What it tells you

If a decline stopped three times in the same price zone, that price is acting as support. It is read as a sign that the downtrend may be ending and turning up.

The pattern completes only when a close finishes above the neckline. It counts as a more reliable triple bottom when these show up as well:

- Volume shrinks with each new low, a sign that selling is running out.
- Volume rises as price clears the neckline.
- [RSI](/guide/indicators/rsi) makes progressively higher lows across the three lows.

In the tabulation of bull-market cases by Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in books, 74% of triple bottoms reached their target.

## How SIGLENS detects it

SIGLENS checks whether the three most recent clearly turned lows (swing lows: turning points from which price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average size of recent bars' moves) sit at a similar price. Once a swing is set, it does not change as more bars arrive. The conditions:

- The gap between the highest and lowest of the three lows must be within the smaller of 1 times ATR and 3% of the average price.
- Neighboring lows must be at least 10 bars apart, so the whole pattern spans at least 21 bars.
- Between the first and last low, no bar may fall below the lows by more than 0.25 times ATR.
- The neckline is a horizontal line at the higher of the two highs.
- The height (from the average low to the neckline) must be at least 2.5 times ATR and also at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).
- If the highs between the lows drop clearly toward the lows (by 1.5 times ATR or more), SIGLENS treats it as a [descending triangle](/guide/chart-patterns/descending-triangle), not a triple bottom.
- If the third low is older than the last 20 bars or half the pattern's length, whichever is longer, it is not shown.

The measured target adds the pattern's height to the neckline, and the conservative target adds half the height. The target is the price reached if the move repeats the pattern's height; it is a reference value because past moves often went that far, not a promise that price will get there. The invalidation level is the price at which the pattern is considered broken: the lowest of the three lows. If a close falls below it, the pattern is treated as broken.

## Watch out for

- In a strong downtrend, the three lows may just be a brief pause before further declines.
- If each low is more than 3% lower than the last, it is closer to a [descending channel](/guide/chart-patterns/descending-channel) than a triple bottom.
- If the three lows form within a short period, it may be noise rather than meaningful accumulation (steady buying of shares).
- If the third low is clearly deeper than the first two, the decline may be accelerating.
- A brief intraday move above the neckline that comes back down is not a confirmation.
