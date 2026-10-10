---
title: Inverse Head and Shoulders
aliases: [Inverted Head and Shoulders, Head and Shoulders Bottom, Reverse Head and Shoulders, Inverse H&S]
summary: Three troughs with a lower middle one (head) between two shoulders. A neckline breakout is read as a turn up.
seoTitle: Inverse Head and Shoulders Pattern Explained
seoDescription: How an inverse head and shoulders builds a bottom at the end of a decline, how to confirm a neckline breakout, and how to read shrinking volume on the right shoulder.
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

Price dips three times to form three troughs. The middle trough (the head) is the deepest, and the left and right shoulders on either side are shallower. Connecting the two bounce highs between the troughs gives the neckline, which can slant rather than run flat. It is a [head and shoulders](/guide/chart-patterns/head-and-shoulders) turned upside down.

## What it tells you

In a downtrend, the head marks the lowest low, and then the right shoulder turns up before falling that far. Selling is running out of steam near the bottom, so it is read as a sign the decline may end and turn into an advance.

The pattern completes when the close finishes above the neckline. Above-normal volume at that point makes it more reliable. A pullback that dips toward the neckline after the break and finds support above it adds one more piece of bullish evidence.

## How it differs from a head and shoulders

In Bulkowski's tabulation, the inverse head and shoulders had a break-even failure rate (the share that ended without moving far enough in the breakout direction) of 11% and a target rate of 71%. That beats the [head and shoulders](/guide/chart-patterns/head-and-shoulders) top at 19% and 51%. It ranked 13th of 39 bullish patterns.

Do not read volume by simply flipping the head and shoulders. Bulkowski found that in the inverse pattern, volume is usually highest on the left shoulder or the head and lighter on the right shoulder. Volume trended downward through the pattern in 65% of cases. So a quiet right shoulder is normal, not a warning; what to check is whether volume rises as price clears the neckline. A bullish divergence, where price makes a new low at the head while the lows of [RSI](/guide/indicators/rsi) or [MACD](/guide/indicators/macd) get higher, adds weight.

## How Siglens detects it

A swing high or low is confirmed at its turning point once price has moved one way and then reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). Siglens lines up five consecutive swings as left shoulder, high, head, high and right shoulder, and checks whether they meet all the conditions below.

- The span from the left shoulder to the right shoulder must be at least 15 bars. The textbook standard is 20 bars or more, so patterns of 15 to 19 bars are rated lower.
- The head must be at least 1 times ATR lower than both shoulders, and the two shoulders must differ by no more than 5% of the higher shoulder's price.
- The neckline is the line through the two highs. It may slope, but if it falls by 1.5 times ATR or more in the direction of the prior decline, it is just falling highs within a trend and is excluded.
- Both shoulders must be at least 1 times ATR below the neckline. From the second high to the right shoulder, no close may break through the neckline by more than 0.25 times ATR.
- Closes must have fallen at least 2 times ATR over the 20 bars before the left shoulder, and from then until the right shoulder, no bar may be lower than the head by more than 0.25 times ATR.
- Height (from the neckline at the head's position down to the head) must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Siglens keeps showing the pattern until two more swings form after the right shoulder, so it does not disappear while price breaks up through the neckline. On the chart, the neckline is a solid line between the two highs and a dotted line out to the bar that first clears it.

The invalidation level is the right shoulder's low. A close below it means the pattern has broken. The measured target is the price where the neckline broke plus the pattern height, and the conservative target is that price plus half the height.

## Watch out for

- In a strong downtrend, a bounce that is only a pause can look like three troughs. First check whether the larger trend points to a bottom.
- If the two shoulders differ a lot in depth, the shape has broken down. A gap over 10% usually rules out an inverse head and shoulders, and Siglens is stricter, looking only within 5%.
- If the head sits less than 3% of the neckline price below the neckline, the rise after a breakout tends to be small.
- If only the wick clears the neckline and the close stays below, the pattern is not complete yet.
- If volume never rises between the right shoulder and the neckline breakout and only shrinks, the evidence for the bullish signal is thin.
