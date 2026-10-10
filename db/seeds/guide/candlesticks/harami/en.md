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

The move made by the big bar did not carry through on the next bar and hesitated. Volatility is shrinking, so the next bar sets the direction.

## How Siglens detects it

If the first bar's body is at least 60% of its high-to-low range and the second body sits entirely inside the first body, it is a harami. If the second body is at most 10% of its own high-to-low range, it counts as a harami cross. If the second body extends even slightly outside the first, it is not a harami. The preceding trend is not checked.

Thomas Bulkowski's data differed from the textbook:

- Bullish harami: 53% bullish reversal.
- Bearish harami: not a bearish reversal but 53% upward continuation.
- Bullish harami cross: 45% bullish reversal, 55% downward continuation.
- Bearish harami cross: 43% bearish reversal, 57% upward continuation.

All are close to a coin flip, so Siglens reads a harami as a brief pause, not a reversal signal. Direction comes from the next close beyond the first bar's high or low.

## Watch out for

It matters more at the end of a long trend or near support or resistance. Pay closer attention when [RSI](/guide/indicators/rsi) is at an extreme or the [MACD](/guide/indicators/macd) histogram is shrinking. A bearish harami near the upper edge of a rising channel was reported to break downward more often. Ignore it in a sideways market ([ADX](/guide/indicators/adx) below 20). Bulkowski's observation that larger bars gave better results is also worth keeping in mind.
