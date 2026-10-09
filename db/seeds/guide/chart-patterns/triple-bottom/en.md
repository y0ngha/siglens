---
title: Triple Bottom
aliases: [Triple Bottom Pattern, Three-Bottom Pattern]
summary: Three lows at similar levels; a move above the neckline through the highs between them is read as a turn up.
seoTitle: "Triple Bottom Pattern: How to Read It"
seoDescription: What a triple bottom looks like, how it differs from a double bottom and an inverse head and shoulders, and what Bulkowski's data says.
demoCaption: Synthetic, illustrative bars. Shows three lows, the neckline through the two highs between them, and a bar closing above the neckline.
faq:
  - q: How is a triple bottom different from a double bottom?
    a: The difference is whether the decline stopped at the same price zone twice or three times. A triple bottom takes longer to form and is rarer, but holding the same price three times is read as steady buying.
  - q: Is it a triple bottom if the middle low is much lower?
    a: No. If the middle low is clearly lower than the other two, it is treated as an inverse head and shoulders.
  - q: When is a triple bottom considered complete?
    a: When a close finishes above the neckline between the two highs. A wick that clears it intraday is not a confirmation.
---

## How it looks

Price falls to a similar low and bounces three times. Two highs form between the lows, and the line through those two highs is the neckline. It looks like a [double bottom](/guide/chart-patterns/double-bottom) with one more low added.

## What it tells you

If a decline stops three times in the same price zone, that price is acting as support. That is read as a sign the downtrend may be ending and turning up.

The pattern completes when the close finishes above the neckline. It is considered more reliable if volume shrinks as the lows repeat, as though selling pressure is running out, and even more so if volume rises as price clears the neckline. A rising series of lows in [RSI](/guide/indicators/rsi) across the three lows is also used as supporting evidence. In Thomas Bulkowski's tabulation of bull-market cases, 74% of triple bottoms reached their target.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has moved one way and then reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). A confirmed swing does not change as more bars arrive. If the three most recent swing lows meet all the conditions below, Siglens treats it as a triple bottom.

- The difference between the highest and lowest of the three lows must be no more than the smaller of 1 times ATR and 3% of their average price.
- Adjacent lows must be at least 10 bars apart, so the whole pattern is at least 21 bars long.
- No bar between the first and last low may go below the lows by more than 0.25 times ATR.
- Neckline: the highest price among the swing highs between the lows.
- Height: from the average low to the neckline, at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).
- If the highs between the lows clearly fall toward the lows (by at least 1.5 times ATR), Siglens treats it as a [descending triangle](/guide/chart-patterns/descending-triangle), not a triple bottom.
- If the third low is too far back, it is not shown. The cutoff is the longer of the last 20 bars and half the pattern's length.

The invalidation level is the lowest of the three lows. A close below it means the pattern has broken. The measured target is the neckline plus the pattern height, and the conservative target is the neckline plus half the height.

## Watch out for

- In a strong downtrend, the three lows can be a pause before further decline.
- If each low is more than 3% lower than the one before, it is closer to a [descending channel](/guide/chart-patterns/descending-channel) than a triple bottom.
- If the three lows form in under 20 bars, it may be a wobble rather than meaningful accumulation (steady buying of shares).
- If the third low is clearly deeper than the first two, it may be a sign the decline is accelerating.
- Crossing the neckline briefly intraday and falling back is not a confirmation.
