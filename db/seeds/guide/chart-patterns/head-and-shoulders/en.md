---
title: Head and Shoulders
aliases: [Head & Shoulders, H&S, Head and Shoulders Top, Head and Shoulders Pattern]
summary: Three peaks with a higher middle one (head) between two shoulders. A neckline break is read as a turn down.
seoTitle: "Head and Shoulders Pattern: Neckline Explained"
seoDescription: How a head and shoulders top signals a turn down at the end of a rise, how to confirm a neckline break, and the false signals when the shoulders differ a lot in height.
demoCaption: Synthetic, illustrative bars. Shows the left shoulder, head and right shoulder, the neckline through the two lows, and the bar that breaks it.
faq:
  - q: When is a head and shoulders considered complete?
    a: When, after the right shoulder, a close finishes below the neckline (the line through the two lows). If only a wick touches the neckline and price comes back, it is not confirmed.
  - q: Can the neckline be sloped?
    a: Yes. But the closer to flat it is, the more reliable it is considered, and the steeper the slope, the less weight it gets.
  - q: How is it different from an inverse head and shoulders?
    a: It is the same shape flipped upside down. A head and shoulders signals a turn down at the end of an advance; an inverse head and shoulders signals a turn up at the end of a decline.
---

## How it looks

Three peaks form in sequence. The first is the left shoulder, the highest one in the middle is the head, and the third is the right shoulder. The line through the two lows between the peaks is the neckline, which can be flat or sloped.

## What it tells you

An uptrend runs, sets a new high at the head, and then the right shoulder fails to get above the head. That means the push to go higher has weakened, so it is read as a sign the uptrend may be ending and turning down.

The pattern completes when the close finishes below the neckline. It is considered more reliable if volume during the right shoulder is lower than during the left shoulder and the head, and volume is above normal when the neckline breaks. A pullback, where price rises back after the break and is stopped at the neckline, also supports the bearish signal. In Thomas Bulkowski's tabulation of bull-market cases, 51% of head and shoulders patterns reached their target.

## How it differs from an inverse head and shoulders

The shape is just flipped, but Bulkowski's numbers differ. After a neckline break, head and shoulders tops had a break-even failure rate (the share that ended without moving far enough in the breakout direction) of 19% and ranked 9th of 36 bearish patterns. Yet only 51% reached the target, about half. The [inverse head and shoulders](/guide/chart-patterns/inverse-head-and-shoulders) did better, with an 11% failure rate and a 71% target rate. So treat the measured target of a head and shoulders as a distance price might cover, not a price it is sure to reach.

Volume is read differently too. In a head and shoulders, shrinking volume while the right shoulder forms is itself evidence that buying has weakened. If volume does not fall on the right shoulder, the signal is rated lower. A bearish divergence, where price makes a new high at the head while the peaks of [RSI](/guide/indicators/rsi) or [MACD](/guide/indicators/macd) get lower, adds weight. A head and shoulders that forms in the middle of a strong uptrend with no resistance overhead is considered less reliable.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has moved one way and then reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). Five consecutive swings (left shoulder, low, head, low, right shoulder) that meet all the conditions below are treated as a head and shoulders.

- The span from the left shoulder to the right shoulder must be at least 15 bars. The textbook standard is 20 bars or more, so patterns of 15 to 19 bars are rated lower.
- The head must be at least 1 times ATR higher than both shoulders, and the two shoulders must differ by no more than 5% of the higher shoulder's price.
- The neckline is the line through the two lows. It may slope, but if it rises by 1.5 times ATR or more in the direction of the prior advance, it is just rising lows within a trend and is excluded.
- Both shoulders must be at least 1 times ATR above the neckline. From the second low to the right shoulder, no close may break through the neckline by more than 0.25 times ATR.
- Closes must have risen at least 2 times ATR over the 20 bars before the left shoulder, and from then until the right shoulder, no bar may be higher than the head by more than 0.25 times ATR.
- Height (from the neckline at the head's position up to the head) must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Siglens keeps showing the pattern until two more swings form after the right shoulder, so it does not disappear while price breaks down through the neckline. On the chart, the neckline is a solid line between the two lows and a dotted line out to the bar that first breaks it.

The invalidation level is the right shoulder's high. A close above it means the pattern has broken. The measured target is the price where the neckline broke minus the pattern height, and the conservative target is that price minus half the height.

## Watch out for

- A temporary pullback inside a strong uptrend can look like three peaks. Read it together with the larger trend.
- If the two shoulders are at very different heights, the shape has broken down. Usually a difference over 10% is not treated as a head and shoulders, and Siglens only picks up differences within 5%.
- If the distance from the head to the neckline is under 3% of the neckline price, the move afterward is likely to be small too.
- A brief intraday break of the neckline that falls back is not a confirmation.
- If volume does not rise as the neckline breaks, the signal is weighted lower.
