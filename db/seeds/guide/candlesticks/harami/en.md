---
title: Harami
aliases: [Harami, Bullish Harami, Bearish Harami, Harami Cross, Inside Bar Candle]
summary: A small bar tucked inside the body of a big one. Closer to a hesitation than a reversal signal.
seoTitle: Harami and Harami Cross Candlestick Meaning
seoDescription: How the bullish harami, bearish harami and harami cross differ, why they are hard to read as reversal signals, and how Siglens detects them.
demoCaption: Synthetic, illustrative bars made for this explanation. A bullish harami with a small bullish bar inside a large bearish body, and a harami cross with a doji in place of the small bar.
faq:
  - q: What does harami mean?
    a: It is a Japanese word meaning pregnant. A big bar holding a small one looks like that, hence the name.
  - q: Is a harami cross stronger than a regular harami?
    a: No. In Bulkowski's data the harami cross did slightly worse than the regular harami.
---

## How it looks

It has two bars. The first has a large body. The second is a small bar whose body sits entirely inside the first body.

- Bullish harami: a small bar inside a large bearish bar. Textbooks read it as a decline stalling.
- Bearish harami: a small bar inside a large bullish bar. Textbooks read it as an advance stalling.
- Harami cross: the second bar is a [doji](/guide/candlesticks/doji), a bar with almost no body.

## What it tells you

The move made by the big bar did not carry through on the next bar and hesitated. The range is shrinking, so the bar after that sets the direction.

Textbooks present the harami as a reversal signal, but the counts of Thomas Bulkowski, who tallied what actually happened after patterns across decades of US stock charts and published the results in books, told a different story. The reversal rate below is the share of cases that actually turned in the direction the textbook expects.

- Bullish harami: 53% bullish reversal.
- Bearish harami: not a bearish reversal; the advance continued 53% of the time.
- Bullish harami cross: 45% bullish reversal, the decline continued 55% of the time.
- Bearish harami cross: 43% bearish reversal, the advance continued 57% of the time.

All four are close to a coin flip.

## How Siglens detects it

Siglens looks for two bars where the second body sits wholly inside a large first body. The criteria:

- The first body is at least 60% of its own high-to-low range.
- The second body sits entirely inside the first body. If it extends even slightly outside, it is not a harami.
- If the second body is at most 10% of its own high-to-low range, it counts as a harami cross.
- The preceding trend is not checked.

Because the counts are close to even, Siglens reads a harami as a brief pause, not a reversal signal. It treats the direction as settled only when a later close moves above the first bar's high or below its low.

## Watch out for

It matters more at the end of a long trend or near support or resistance. Pay closer attention when [RSI](/guide/indicators/rsi) is at an overbought extreme (risen so far it may pull back) or an oversold extreme (fallen so far it may bounce), or when the [MACD](/guide/indicators/macd) histogram bars are shrinking. A bearish harami near the upper edge of a rising channel was reported to break downward more often. When [ADX](/guide/indicators/adx), which measures trend strength, is below 20 and the market has no clear direction, Siglens does not count it as a signal. Bulkowski's observation that larger bars gave better results is also worth keeping in mind.
