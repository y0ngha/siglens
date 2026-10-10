---
title: Marubozu
aliases: [Marubozu, White Marubozu, Black Marubozu, Long Bullish Candle, Long Bearish Candle]
summary: "A long body with almost no wicks. One side pushed the whole period, but it confirms a trend only weakly."
seoTitle: Marubozu Candlestick Meaning and Signals
seoDescription: How a marubozu, a candle with a body and no wicks, reads differently with the trend and against it, and how often it actually worked.
demoCaption: Synthetic, illustrative bars made for this explanation. A bullish marubozu that opens at its low and closes at its high with no wicks, next to its bearish opposite.
faq:
  - q: Does a marubozu confirm a strong trend?
    a: Textbooks say so, but the data is weak. In Thomas Bulkowski's data the trend continued after a white marubozu 56% of the time and after a black marubozu 53%.
  - q: Are a marubozu and a long bullish candle the same?
    a: They are similar, but a marubozu must have almost no wicks. A long body with long wicks is not a marubozu.
---

## How it looks

Marubozu is Japanese for a shaved head. As the name says, it is a bar with almost no upper or lower wick, opening at one end and closing at the other.

- Bullish (white) marubozu: opens near the low and closes near the high.
- Bearish (black) marubozu: opens near the high and closes near the low.

## What it tells you

One side pushed the price for the whole period. It carries more weight when it appears where price breaks through support or resistance.

But a marubozu in the direction of the trend is weak evidence of trend confirmation. A marubozu of the opposite color to the trend is often a temporary pullback, not a reversal.

## How Siglens detects it

A bar is a marubozu when its body is at least 90% of the high-to-low range. A bullish bar is a bullish marubozu and a bearish bar is a bearish marubozu. Siglens checks bar shape only, not the preceding trend.

In Thomas Bulkowski's data, uptrends continued after a white marubozu 56% of the time and downtrends after a black marubozu 53%, both close to a coin flip. Bulkowski considered the marubozu overrated relative to its actual performance.

The cases where Bulkowski confirmed good performance were actually those of the opposite color to the trend. A black marubozu inside an uptrend, followed by a close above that bar's high, ranked 2nd among common bullish continuation candles, with a 10-day average gain of 4.39%. A white marubozu inside a downtrend, followed by a close below that bar's low, ranked 2nd among common bearish continuation candles, with a 10-day average decline of 3.55%.

So Siglens reads an opposite-color marubozu as a resumed trend only after such a confirming close appears, and withholds judgment before that.

## Watch out for

A run of marubozu may mean price has already moved a lot, so check for overheating with an indicator such as [RSI](/guide/indicators/rsi). A marubozu on thin volume may just be a liquidity effect. Ignore it in a sideways market ([ADX](/guide/indicators/adx) below 20).
