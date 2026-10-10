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
    a: Siglens only picks up a double bottom when the two lows differ by no more than the smaller of 1 times ATR and 3% of their average price. A difference within 1% carries more weight.
  - q: Does price always rise after a double bottom?
    a: No. In a strong downtrend, the two lows can be a brief pause before further decline. That is why the neckline breakout is read together with volume.
---

## What it looks like

Price falls, bottoms once, and bounces, then gets pushed back down and stops again near the first low. The chart leaves a W shape. The horizontal line through the bounce high between the two lows is the neckline.

## What it tells you

When a decline stops twice at about the same price, buyers at that level have absorbed the selling both times. That is why it is read as a sign the downtrend may end and turn into an uptrend.

The pattern is complete only when, after the second low, a close finishes above the neckline. Volume rising at the second low compared with the first, and heavy volume on the bar that clears the neckline, add weight to the signal. A bullish divergence (price and an indicator pointing different ways) at the second low, where price is near the first low but [RSI](/guide/indicators/rsi) makes a higher low, is supporting evidence.

## How it differs from a double top

Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results, split double bottoms into four types by the shape of each low. A sharp low is called Adam and a rounded low Eve, and the types are the pairings (Adam & Adam, Adam & Eve, and so on).

- The share that failed to move far enough after the breakout (the break-even failure rate) was 12–16%.
- 65–73% reached the price target.
- Eve & Eve, with two rounded lows, ranked best: 5th of 39 bullish patterns in performance rank (a ranking by how far price went afterward).
- Adam & Adam, with two sharp lows, was weakest: a 16% failure rate and 26th place.

The same four types of [double top](/guide/chart-patterns/double-top) had failure rates of 20–25% and reached the target 43–64% of the time. The shapes mirror each other, but the bottom version worked better.

Volume is read the opposite way from a double top. In a double bottom, volume at the second low should be higher than at the first or spike noticeably. That suggests someone is accumulating at that price. If price comes back down after clearing the neckline but holds above it, the bullish case gets stronger.

## How Siglens finds it

Siglens takes the two most recent clear lows (swing lows: turning points where price bounced more than 1.5 times [ATR](/guide/indicators/atr), the average range of recent bars) and checks whether they form a W at a similar level. Once a turning point is set, it does not change as more bars arrive. All of these must hold:

- The two lows differ by no more than the smaller of 1× ATR and 3% of their average price.
- The two lows are at least 10 bars apart.
- No bar between them dips more than 0.25 ATR below the lows.
- The neckline is the highest swing high between the two lows. It must sit in the middle half of the span between them, meaning at least 25% of the full distance from either low.
- The height from the average low to the neckline is at least 2.5 ATR and at least a minimum share of price (0.5% on 5–30 minute bars, 1% on 1–4 hour bars, 3% on daily bars).
- If the highs between the two lows clearly fall toward them (by 1.5 ATR or more), Siglens treats it as a [descending triangle](/guide/chart-patterns/descending-triangle), not a double bottom.
- If the second low is older than the longer of the last 20 bars and half the pattern's length, it is not shown.

The invalidation level (the price at which the pattern counts as broken) is the lower of the two lows. A close below it breaks the pattern. The neckline plus the pattern height is the measured target, and the neckline plus half the height is the conservative target. A target is the price reached if price moves another pattern height; it is a reference based on how often that happened in the past, not a promise. Once a close falls below the invalidation level or price has already reached the measured target, the pattern is no longer shown.

## Watch out when

- In a strong downtrend, the two lows may be a brief pause before further decline rather than a bottom.
- If the lows are fewer than 10 bars apart, it is closer to short-term noise than a bottom being built.
- If volume at the second low is equal to or lower than at the first, the case for accumulation is weak.
- If the middle bounce rises less than 3% above the average low, it is too shallow to call a neckline.
- A wick above the neckline intraday with the close back below is not confirmation.
