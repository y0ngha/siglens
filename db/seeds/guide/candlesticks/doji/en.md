---
title: Doji / Spinning Top
aliases: [Doji, Doji Candle, Dragonfly Doji, Gravestone Doji, Long-legged Doji, Spinning Top, Cross Candle]
summary: "A bar with nearly equal open and close: buyers and sellers were evenly matched. The next close sets direction."
seoTitle: "Doji Candlestick Meaning: Dragonfly, Gravestone"
seoDescription: What doji and spinning tops look like, how the dragonfly and gravestone doji differ, and why a doji on its own can't tell you the direction.
demoCaption: Synthetic, illustrative bars made for this explanation. A standard doji, dragonfly, gravestone and spinning top side by side to compare body size.
faq:
  - q: Does a doji mean the trend will change?
    a: A single doji can't tell you that. It means a pause, and direction is only known once a close appears above the doji's high or below its low.
  - q: Is a dragonfly doji a bullish signal?
    a: Textbooks say so, but the measured results differ. In Thomas Bulkowski's data the dragonfly doji's reversal rate was 50%, a coin flip.
---

## How it looks

A doji is a bar whose open and close are almost the same, so the body is as thin as a line. With wicks above and below, it looks like a cross. It means neither buyers nor sellers won during that period.

- Standard doji: a thin body with wicks above and below. If both wicks are very long, it is called a long-legged doji.
- Dragonfly doji: almost no upper wick and a long lower wick. The close is near the high.
- Gravestone doji: almost no lower wick and a long upper wick. The close is near the low.
- Spinning top: a small body that isn't as thin as a doji's, with wicks above and below.

## What it tells you

A doji signals a pause, not a direction. After a long advance or near support or resistance, it is a clue that the trend is resting. A later close above the doji's high reads as upward, and a close below its low as downward. Until then, you are waiting for confirmation.

## How Siglens detects it

A bar is a doji when its body is at most 10% of the high-to-low range. If the upper wick is also at most 10% of that range, it is a dragonfly; if the lower wick is at most 10%, it is a gravestone. A long-legged doji is not separated and is counted as a standard doji. A spinning top has a body of at most 40% of the range with wicks on both sides. It is so common that Siglens doesn't list it as a detected pattern.

Siglens checks bar shape only, not the preceding trend. In Thomas Bulkowski's data the reversal rate was 50% for the dragonfly doji, 51% for the gravestone doji and 50-51% for the spinning top. A standard doji after a trend was also around 50%. All are close to a coin flip, so Siglens treats these bars as reference clues, not directional signals.

## Watch out for

A doji in a sideways market ([ADX](/guide/indicators/adx) below 20) only means volatility has shrunk. Don't conclude "up" from a dragonfly or "down" from a gravestone; wait for a confirming close. In another of Bulkowski's studies, when a dragonfly doji after an advance was followed by a break below its low, it performed second best among the common bearish reversal candles. That is the opposite of the textbook "bullish signal". A spinning top is so common that one alone carries almost no information.
