---
title: Inverse Head and Shoulders
aliases: [Inverted Head and Shoulders, Head and Shoulders Bottom, Reverse Head and Shoulders, Inverse H&S]
summary: Three troughs with a lower middle one (head) between two shoulders. A neckline breakout is read as a turn up.
seoTitle: Inverse Head and Shoulders Pattern Explained
seoDescription: What an inverse head and shoulders looks like, how to confirm a neckline breakout, how right-shoulder volume is read, and what Bulkowski's data says.
demoCaption: Synthetic, illustrative bars. Shows the left shoulder, head and right shoulder, the neckline through the two highs, and the bar that breaks above it.
faq:
  - q: Is it a problem if volume falls on the right shoulder?
    a: No. In Thomas Bulkowski's tabulation, volume also fell toward the right shoulder in 65% of cases. What many traders check instead is whether volume rises as price clears the neckline.
  - q: When is an inverse head and shoulders considered complete?
    a: When, after the right shoulder, a close finishes above the neckline (the line through the two highs). A brief intraday break above it that falls back is not a confirmation.
  - q: Is it a failure if price falls back after clearing the neckline?
    a: If price comes back to the neckline and holds above it, that is read as a pullback that supports the signal. If a close falls below the right shoulder's low, the pattern has broken.
---

## How it looks

Three troughs form in sequence. The first is the left shoulder, the deepest one in the middle is the head, and the third is the right shoulder. The line through the two highs between the troughs is the neckline, which can be flat or sloped. It is a [head and shoulders](/guide/chart-patterns/head-and-shoulders) flipped upside down.

## What it tells you

A downtrend runs, sets a new low at the head, and then the right shoulder fails to fall as far as the head. That means the push to go lower has weakened, so it is read as a sign the decline may be ending and turning up.

The pattern completes when the close finishes above the neckline. It is considered more reliable if volume is above normal as the neckline breaks. A pullback, where price comes back down to the neckline after the break and holds above it, also supports the bullish signal. In Thomas Bulkowski's tabulation of bull-market cases, 71% of inverse head and shoulders patterns reached their target.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has moved one way and then reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). Five consecutive swings (left shoulder, high, head, high, right shoulder) that meet all the conditions below are treated as an inverse head and shoulders.

- The span from the left shoulder to the right shoulder must be at least 15 bars. The textbook standard is 20 bars or more, so patterns of 15 to 19 bars are rated lower.
- The head must be at least 1 times ATR lower than both shoulders, and the two shoulders must differ by no more than 5% of the higher shoulder's price.
- The neckline is the line through the two highs. It may slope, but if it falls by 1.5 times ATR or more in the direction of the prior decline, it is just falling highs within a trend and is excluded.
- Both shoulders must be at least 1 times ATR below the neckline. From the second high to the right shoulder, no close may break through the neckline by more than 0.25 times ATR.
- Closes must have fallen at least 2 times ATR over the 20 bars before the left shoulder, and from then until the right shoulder, no bar may be lower than the head by more than 0.25 times ATR.
- Height (from the neckline at the head's position down to the head) must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Siglens keeps showing the pattern until two more swings form after the right shoulder, so it does not disappear while price breaks up through the neckline. On the chart, the neckline is a solid line between the two highs and a dotted line out to the bar that first clears it.

The invalidation level is the right shoulder's low. A close below it means the pattern has broken. The measured target is the price where the neckline broke plus the pattern height, and the conservative target is that price plus half the height.

## Watch out for

- A temporary bounce inside a strong downtrend can look like three troughs. Read it together with the larger trend.
- If the two shoulders are at very different depths, the shape has broken down. Usually a difference over 10% is not treated as an inverse head and shoulders, and Siglens only picks up differences within 5%.
- If the distance from the neckline to the head is under 3% of the neckline price, the move afterward is likely to be small too.
- A brief intraday break above the neckline that falls back is not a confirmation.
- If volume never rises between the right shoulder and the neckline breakout and only shrinks, the evidence for the bullish signal is thin.
