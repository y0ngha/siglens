---
title: Double Bottom
aliases: [W Pattern, W-Shaped Bottom, Double Bottom Pattern]
summary: Two lows at similar levels; a move above the high between them (the neckline) is read as a turn up.
seoTitle: "Double Bottom Pattern: How to Read It"
seoDescription: What a double bottom looks like, how to confirm it with a close above the neckline, how alike the two lows must be, and what Bulkowski's data says.
demoCaption: Synthetic, illustrative bars. Shows two lows, the neckline between them, and a bar closing above the neckline.
faq:
  - q: When is a double bottom considered complete?
    a: When, after the second low, a close finishes above the neckline (the high between the two lows). If only the wick clears the neckline and the close stays below, it is not yet confirmed.
  - q: How similar do the two lows have to be?
    a: Siglens only picks up a double bottom when the two lows differ by no more than the smaller of 1 times ATR and 3% of their average price. A difference within 1% is considered more reliable.
  - q: Does price always rise after a double bottom?
    a: No. In a strong downtrend, the two lows can be a brief pause before further decline. Many traders check the neckline breakout together with volume.
---

## How it looks

Price falls, stops and bounces, then falls again and gets stopped at a similar price, forming the letter W. The horizontal line through the bounce high between the two lows is the neckline.

## What it tells you

If a decline stops twice at the same price zone, buyers at that price absorbed the selling. That is read as a sign the downtrend may be ending and turning up.

The pattern completes when the close finishes above the neckline. It is often considered more reliable when volume is higher at the second low than at the first and rises as price clears the neckline. A bullish divergence, where [RSI](/guide/indicators/rsi) makes a higher low at the second low than at the first, is also used as supporting evidence.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has moved one way and then reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). A confirmed swing does not change as more bars arrive. If the two most recent swing lows meet all the conditions below, Siglens treats it as a double bottom.

- The two lows must differ by no more than the smaller of 1 times ATR and 3% of their average price.
- The two lows must be at least 10 bars apart.
- No bar between the two lows may go below the lows by more than 0.25 times ATR.
- Neckline: the highest swing high between the two lows. It must fall in the middle half of the span in time, so it is at least 25% of the total gap away from either low.
- Height: from the average low to the neckline, at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).
- If the highs between the two lows clearly fall toward the lows (by at least 1.5 times ATR), Siglens treats it as a [descending triangle](/guide/chart-patterns/descending-triangle), not a double bottom.
- If the second low is too far back, it is not shown. The cutoff is the longer of the last 20 bars and half the pattern's length.

The invalidation level is the lower of the two lows. A close below it means the pattern has broken. The measured target is the neckline plus the pattern height, and the conservative target is the neckline plus half the height. Patterns whose close has passed the invalidation level, or whose price has already reached the measured target, are no longer shown.

In Thomas Bulkowski's tabulation of bull-market cases, 65% to 73% of double bottoms reached their target, depending on the specific shape.

## Watch out for

- In a strong downtrend, the two lows can be a pause before further decline.
- If the two lows are closer than 10 bars, it is more likely a short-term wobble than a change of trend.
- If the second low's volume is the same as or lower than the first, the evidence that buying has increased is weak.
- If the neckline is not at least 3% above the average low, the bounce in the middle is too shallow to count as a neckline.
- Crossing the neckline briefly intraday and falling back is not a confirmation.
