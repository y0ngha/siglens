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

The trend rested for a moment and then went back the way it was going. Because the small bars in the middle never leave the first bar's range, the counter-move is read as weak.

Thomas Bulkowski tallied what actually happened after patterns across decades of US stock charts and published the results in books. In his data the advance continued after the rising three methods 74% of the time, and the decline continued after the falling three methods 71% of the time. The direction held well, but the moves afterward were smaller than for other candles. So in his performance ranking, which ranks 103 candle patterns by how far price went afterward, they placed low, at 94th and 89th. Both are also rare.

## How SIGLENS detects it

SIGLENS looks for five bars: two long bars with three small bars resting inside the first bar's range between them.

- The first and fifth bars are long, with bodies at least 60% of their own high-to-low range.
- The three middle bars have shorter bodies, and both their highs and lows sit inside the first bar's range.
- The fifth close goes beyond the first bar's close.
- The preceding trend and the color of the middle bars are not considered. Bulkowski's definition requires the middle bars to drift against the trend.

SIGLENS reads this pattern as the rest ending and the earlier move starting again, and doesn't expect a large move afterward. It carries more weight when:

- A clear trend ran in the pattern's direction
- The middle bars drifted against the trend on low volume
- The fifth bar has high volume

## Watch out for

Without a prior trend, it is just price leaving a narrow range. Bulkowski found the rising three methods useful only when the larger trend was up. If a close returns inside the first bar's range after the pattern, the continuation read weakens. It is also weak when [ADX](/guide/indicators/adx), which measures trend strength, is below 20 and the market has no clear direction.
