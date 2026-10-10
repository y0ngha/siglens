---
title: Double Bottom
aliases: [W Pattern, W-Shaped Bottom, Double Bottom Pattern]
summary: Two lows at similar levels; a move above the high between them (the neckline) is read as a turn up.
seoTitle: "Double Bottom Pattern: How to Read It"
seoDescription: A double bottom is a W-shaped bullish reversal pattern. Learn how to confirm a break above the neckline and when false signals tend to show up.
demoCaption: Synthetic, illustrative bars. Shows two lows, the neckline through the bounce high between them, and a bar closing above the neckline.
faq:
  - q: When is a double bottom considered complete?
    a: When, after the second low, a close finishes above the neckline (the high between the two lows). If only the wick clears the neckline and the close stays below, it is not yet confirmed.
  - q: How similar do the two lows have to be?
    a: Siglens only picks up a double bottom when the two lows differ by no more than the smaller of 1 times ATR and 3% of their average price. A difference within 1% is considered more reliable.
  - q: Does price always rise after a double bottom?
    a: No. In a strong downtrend, the two lows can be a brief pause before further decline. Many traders check the neckline breakout together with volume.
---

## How it looks

A falling price hits a low and bounces, then gets pushed back down and stops again near the first low. The chart is left with the letter W. The horizontal line through the bounce high between the two lows is the neckline.

## What it tells you

When a decline stops twice at about the same price, buyers in that zone soaked up the selling that poured in. So it is read as a sign the decline may end and turn into an advance.

The pattern completes when the close finishes above the neckline. It tends to be considered more reliable when volume at the second low is higher than at the first and volume is also heavy on the bar that clears the neckline. A bullish divergence, where [RSI](/guide/indicators/rsi) makes a higher low at the second low than at the first, serves as supporting evidence.

## How it differs from a double top

Bulkowski also split double bottoms into four variants by whether each low is narrow and sharp (Adam) or wide and rounded (Eve). The break-even failure rate (the share that ended without moving far enough in the breakout direction) was 12% to 16%, and 65% to 73% reached their target. Eve & Eve, with two rounded lows, did best at 5th of 39 bullish patterns, while Adam & Adam, with two sharp lows, trailed with a 16% failure rate and a rank of 26th.

The [double top](/guide/chart-patterns/double-top), split the same four ways, had failure rates of 20% to 25% and target rates of 43% to 64%. Mirror-image shapes, but the bottom version worked more often.

Read volume the opposite way from a double top. In a double bottom, volume at the second low should rise above the first or show a clear spike. That is evidence that someone is accumulating at that price. If price clears the neckline and a pullback then holds above it, the bullish case gets stronger.

## How Siglens detects it

When price moves one way and then reverses by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar), Siglens confirms that turning point as a swing high or swing low and does not change it as more bars arrive. If the two most recent swing lows meet all the conditions below, it is a double bottom.

- The two lows must differ by no more than the smaller of 1 times ATR and 3% of their average price.
- The two lows must be at least 10 bars apart.
- No bar between the two lows may go below the lows by more than 0.25 times ATR.
- Neckline: the highest swing high between the two lows. It must fall in the middle half of the span in time, so it is at least 25% of the total gap away from either low.
- Height: from the average low to the neckline, at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).
- If the highs between the two lows clearly fall toward the lows (by at least 1.5 times ATR), Siglens treats it as a [descending triangle](/guide/chart-patterns/descending-triangle), not a double bottom.
- If the second low is too far back, it is not shown. The cutoff is the longer of the last 20 bars and half the pattern's length.

The invalidation level is the lower of the two lows. A close below it means the pattern has broken. The measured target is the neckline plus the pattern height, and the conservative target is the neckline plus half the height. Patterns whose close has passed the invalidation level, or whose price has already reached the measured target, are no longer shown.

## Watch out for

- In a strong downtrend, the two lows may not be a bottom but a brief stop before price heads lower.
- If the two lows are fewer than 10 bars apart, it is closer to a short wobble than a base.
- If the second low's volume is the same as or lower than the first, there is little evidence that anyone is accumulating.
- If the bounce in the middle did not rise even 3% above the average low, it is too shallow to call a neckline.
- A wick that pokes above the neckline intraday while the close falls back below is not a confirmation.
