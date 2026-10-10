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
    a: When a close falls below the neckline between the two lows. A wick that breaks it intraday and returns is not a confirmation.
  - q: What if the lows keep rising?
    a: If the highs stall at the same price but the lows rise, it is closer to an ascending triangle than a triple top. In that case, keep the possibility of an upward breakout open.
---

## How it looks

Price rises to a similar high and gets pushed back three times. Two lows form between the highs, and the line through those two lows is the neckline. It looks like a [double top](/guide/chart-patterns/double-top) with one more high added.

## What it tells you

If a rise stops three times in the same price zone, that price is acting as resistance. That is read as a sign the uptrend may be ending and turning down.

The pattern completes when the close finishes below the neckline. It is considered more reliable if volume shrinks as the highs repeat, and even more so if volume rises as the neckline breaks. However, in Thomas Bulkowski's tabulation, the triple top ranked in the bottom tier for performance. Confirming resistance one more time does not make it work out proportionally better.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has moved one way and then reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). A confirmed swing does not change as more bars arrive. If the three most recent swing highs meet all the conditions below, Siglens treats it as a triple top.

- The difference between the highest and lowest of the three highs must be no more than the smaller of 1 times ATR and 3% of their average price.
- Adjacent highs must be at least 10 bars apart, so the whole pattern is at least 21 bars long.
- No bar between the first and last high may rise above the highs by more than 0.25 times ATR.
- Neckline: instead of connecting the two lows, Siglens uses a horizontal line at the lower of the two lows.
- Height: from the average high to the neckline, at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).
- If the lows between the highs clearly rise toward the highs (by at least 1.5 times ATR), Siglens treats it as an [ascending triangle](/guide/chart-patterns/ascending-triangle), not a triple top.
- If the third high is too far back, it is not shown. The cutoff is the longer of the last 20 bars and half the pattern's length.

The invalidation level is the highest of the three highs. A close above it means the pattern has broken. The measured target is the neckline minus the pattern height, and the conservative target is the neckline minus half the height.

## Watch out for

- In a directionless, choppy market, three highs can end up at similar levels by chance.
- If the third high is clearly lower than the first two, it may be a gradual downtrend.
- If the lows between the highs are not at least 3% below the average high, the dip in the middle is too shallow to count as a neckline.
- If volume does not shrink as the highs repeat, the evidence that buying has weakened is thin.
- Dipping below the neckline with only a wick and then recovering is not a confirmation.
