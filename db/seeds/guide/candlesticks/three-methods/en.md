---
title: Rising / Falling Three Methods
aliases: [Rising Three Methods, Falling Three Methods, Three Methods]
summary: "A five-bar continuation: a long bar, three small bars resting inside its range, then another long bar."
seoTitle: Rising and Falling Three Methods Candlesticks
seoDescription: How rising and falling three methods show a pause within a trend, and why they continue the trend often yet rank low on performance.
demoCaption: "Synthetic, illustrative bars made for this explanation. A rising three methods: a long bullish bar, three small bars resting inside its range, then a long bullish bar closing above the first close."
faq:
  - q: Is the three methods a reversal signal?
    a: No. As the name says, it is a continuation pattern where the trend rests and then resumes. The three small bars in the middle are read as a rest.
  - q: Why is the performance rank low when the continuation rate is high?
    a: In Bulkowski's data the rising three methods continued 74% of the time, but the moves afterward were smaller than for other candles, so it ranked 94th of 103 for performance.
---

## How it looks

It has five bars.

- Rising three methods: a long bullish bar, three small bars that stay inside the first bar's high-to-low range, then a long bullish bar closing above the first bar's close.
- Falling three methods: a long bearish bar, three small bars that stay inside the first bar's range, then a long bearish bar closing below the first bar's close.

## What it tells you

The trend rested for a moment and then went back the way it was going. Because the small bars in the middle never leave the first bar's range, the pullback is read as having failed to gain strength.

## How Siglens detects it

The first and fifth bars must be long bars whose bodies are at least 60% of their high-to-low range. The three middle bars must have shorter bodies, and both their highs and lows must sit inside the first bar's range. The fifth close must go beyond the first bar's close. The preceding trend is not checked, and the color of the middle bars is not considered (Bulkowski's definition requires them to drift against the trend).

In Thomas Bulkowski's data, the rising three methods continued upward 74% of the time and the falling three methods continued downward 71%. The continuation rates are high, but the moves after the pattern were smaller than for other candles, so they ranked 94th and 89th of 103 for performance. Both are rare.

Siglens reads this pattern as the rest ending and the earlier move starting again, and doesn't expect a large move afterward. It carries more weight when a clear trend ran in the pattern's direction, the middle bars drifted against the trend on low volume, and the fifth bar has high volume.

## Watch out for

Without a prior trend, it is just a breakout from a small range. Bulkowski also said the rising three methods is only useful when the larger trend is up. If a close returns inside the first bar's range after the pattern, the continuation read weakens. It is weak in a sideways market ([ADX](/guide/indicators/adx) below 20) too.
