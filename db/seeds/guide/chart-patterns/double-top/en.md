---
title: Double Top
aliases: [M Pattern, M-Shaped Top, Double Top Pattern]
summary: Two highs at similar levels; a break of the low between them (the neckline) is read as a turn down.
seoTitle: "Double Top Pattern: How to Read It"
seoDescription: What a double top looks like, how to confirm it with a close below the neckline, how it differs from a double bottom, and what Bulkowski's data says.
demoCaption: Synthetic, illustrative bars. Shows two highs, the neckline between them, and a bar closing below the neckline.
faq:
  - q: When is a double top considered complete?
    a: When, after the second high, a close finishes below the neckline (the low between the two highs). A brief intraday break that falls back is not a confirmation.
  - q: How is a double top different from a double bottom?
    a: They are mirror images. A double top is an M-shaped signal that an advance is ending; a double bottom is a W-shaped signal that a decline is ending.
  - q: What should volume look like on the second high?
    a: Lower than on the first high is read as a sign buying has weakened. If it is the same or higher, many traders put less weight on a turn down.
---

## How it looks

Price rises, turns down at a high, bounces and gets stopped at a similar height, forming the letter M. The horizontal line through the low between the two highs is the neckline.

## What it tells you

If a rise stops twice at the same price zone, there is a lot of selling at that price. That is read as a sign the uptrend is losing strength and may turn down.

The pattern completes when the close finishes below the neckline. It is often considered more reliable when volume is lower at the second high than at the first and rises as price breaks the neckline. A bearish divergence, where [RSI](/guide/indicators/rsi) makes a lower high at the second high, is also used as supporting evidence.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has moved one way and then reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). A confirmed swing does not change as more bars arrive. If the two most recent swing highs meet all the conditions below, Siglens treats it as a double top.

- The two highs must differ by no more than the smaller of 1 times ATR and 3% of their average price.
- The two highs must be at least 10 bars apart.
- No bar between the two highs may rise above the highs by more than 0.25 times ATR.
- Neckline: the lowest swing low between the two highs. It must fall in the middle half of the span in time, so it is at least 25% of the total gap away from either high.
- Height: from the average high to the neckline, at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).
- If the lows between the two highs clearly rise toward the highs (by at least 1.5 times ATR), Siglens treats it as an [ascending triangle](/guide/chart-patterns/ascending-triangle), not a double top.
- If the second high is too far back, it is not shown. The cutoff is the longer of the last 20 bars and half the pattern's length.

The invalidation level is the higher of the two highs. A close above it means the pattern has broken. The measured target is the neckline minus the pattern height, and the conservative target is the neckline minus half the height. Patterns whose close has passed the invalidation level, or whose price has already reached the measured target, are no longer shown.

In Thomas Bulkowski's tabulation of bull-market cases, 43% to 64% of double tops reached their target, depending on the specific shape. That is on the low side compared with the [double bottom](/guide/chart-patterns/double-bottom).

## Watch out for

- In a strong uptrend, the two highs can be a breather before a further rise.
- If the two highs are closer than 10 bars, it is more likely a short-term wobble than a change of trend.
- If the second high's volume is the same as or higher than the first, the evidence that buying has weakened is thin.
- If the neckline is not at least 3% below the average high, the dip in the middle is too shallow to count as a neckline.
- Dipping below the neckline with only a wick and then recovering is not a confirmation.
