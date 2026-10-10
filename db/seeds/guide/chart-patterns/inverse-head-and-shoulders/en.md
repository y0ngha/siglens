---
title: Inverse Head and Shoulders
aliases: [Inverted Head and Shoulders, Head and Shoulders Bottom, Reverse Head and Shoulders, Inverse H&S]
summary: Three troughs with a lower middle one (head) between two shoulders. A neckline breakout is read as a turn up.
seoTitle: Inverse Head and Shoulders Pattern Explained
seoDescription: How an inverse head and shoulders builds a bottom at the end of a decline, how to confirm a neckline breakout, and how to read shrinking volume on the right shoulder.
demoCaption: Synthetic, illustrative bars. Shows the left shoulder, head and right shoulder, the neckline through the two highs, and the bar that breaks above it.
faq:
  - q: Is it a problem if volume falls on the right shoulder?
    a: No. In Thomas Bulkowski's tabulation, volume also fell toward the right shoulder in 65% of cases. What matters more is whether volume rises as price clears the neckline.
  - q: When is an inverse head and shoulders considered complete?
    a: When, after the right shoulder, a close finishes above the neckline (the line through the two highs). A brief intraday break above it that falls back is not a confirmation.
  - q: Is it a failure if price falls back after clearing the neckline?
    a: If price comes back to the neckline and holds above it, that is read as a pullback that supports the signal. If a close falls below the right shoulder's low, the pattern has broken.
---

## What it looks like

Price drops three times, forming three troughs. The middle trough (the head) is the deepest, and the left and right shoulders on either side are shallower. Connecting the two bounce highs between the troughs gives the neckline, which can be sloped rather than flat. It is a [head and shoulders](/guide/chart-patterns/head-and-shoulders) flipped upside down.

## What it tells you

In a downtrend, the head makes the lowest low, and then the right shoulder turns back before falling that far. Selling is running out near the bottom, so it is read as a sign the downtrend may end and turn into an uptrend.

The pattern is complete only when, after the right shoulder, a close finishes above the neckline. Heavier-than-usual volume at that point adds weight to the signal. A pullback after the break that dips near the neckline and finds support above it adds one more piece of bullish evidence.

## How it differs from a head and shoulders

In the counts of Thomas Bulkowski, who tallied what actually happened after patterns across decades of US stock charts and published the results, the inverse head and shoulders did better than the [head and shoulders](/guide/chart-patterns/head-and-shoulders).

- The share that failed to move far enough after the breakout (the break-even failure rate) was 11%, lower than the head and shoulders' 19%.
- 71% reached the price target, higher than the head and shoulders' 51%.
- Its performance rank (a ranking by how far price went afterward) was 13th of 39 bullish patterns.

Volume is read differently in the two patterns. In a head and shoulders, falling volume on the right shoulder counts as bearish evidence, but in an inverse head and shoulders it is common and does not count as evidence either way. Bulkowski found that volume is usually heaviest on the left shoulder or head and lighter on the right shoulder, and volume declined over the pattern in 65% of cases. So what matters is whether volume rises at the moment price clears the neckline. A bullish divergence (price and an indicator pointing different ways), where price makes a new low at the head while [RSI](/guide/indicators/rsi) or [MACD](/guide/indicators/macd) makes a higher low, adds to the evidence.

## How SIGLENS finds it

SIGLENS checks whether five clear turning points in a row (swings: highs and lows where price reversed more than 1.5 times [ATR](/guide/indicators/atr), the average range of recent bars) form a left shoulder, high, head, high, and right shoulder. All of these must hold:

- The left shoulder to the right shoulder spans at least 15 bars. The textbook standard is 20 bars or more, so 15–19-bar patterns are rated lower.
- The head is at least 1 ATR below both shoulders.
- The two shoulders differ by no more than 5% of the higher shoulder's price.
- The neckline is the line through the two highs. It may slope, but if it falls 1.5 ATR or more in the direction of the prior decline, it is just the trend's own falling highs and is excluded.
- Both shoulders sit at least 1 ATR below the neckline.
- From the second high to the right shoulder, no close breaks up through the neckline by more than 0.25 ATR.
- Over the 20 bars before the left shoulder, the close fell at least 2 ATR, so there was a prior decline.
- From the start of those 20 bars to the right shoulder, no bar falls more than 0.25 ATR below the head.
- The height (from the neckline at the head's bar to the head) is at least 2.5 ATR and at least a minimum share of price (0.5% on 5–30 minute bars, 1% on 1–4 hour bars, 3% on daily bars).

Until two more swings form after the right shoulder, the pattern stays on the chart even while price breaks up through the neckline.

The invalidation level (the price at which the pattern counts as broken) is the right shoulder's low. A close below it breaks the pattern. The neckline-break price plus the pattern height is the measured target, and plus half the height is the conservative target. A target is the price reached if price moves another pattern height; it is a reference based on how often that happened in the past, not a promise.

## Watch out when

- In a strong downtrend, a brief relief rally can look like three troughs. Whether the larger trend points toward a bottom matters as well.
- If the shoulders differ a lot in depth, the shape has broken down. A gap of more than 10% usually rules out an inverse head and shoulders, and SIGLENS is stricter, accepting only 5% or less.
- If the head is less than 3% of the neckline price below the neckline, the rise after clearing it tends to be small.
- If only a wick clears the neckline and the close stays below, it is not complete yet.
- If volume never rises and only shrinks from the right shoulder to the neckline break, the case for the bullish signal is weak.
