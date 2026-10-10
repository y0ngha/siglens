---
title: Marubozu
aliases: [Marubozu, White Marubozu, Black Marubozu, Long Bullish Candle, Long Bearish Candle]
summary: "A long body with almost no wicks. One side pushed the whole period, but it confirms a trend only weakly."
seoTitle: Marubozu Candlestick Meaning and Signals
seoDescription: How a marubozu, a candle with a body and no wicks, reads differently with the trend and against it, and how often it actually worked.
demoCaption: Synthetic, illustrative bars made for this explanation. A bullish marubozu that opens at its low and closes at its high with no wicks, next to its bearish opposite.
faq:
  - q: Does a marubozu confirm a strong trend?
    a: Textbooks say so, but the data is weak. In Thomas Bulkowski's data the advance continued after a bullish marubozu 56% of the time, and the decline continued after a bearish marubozu 53% of the time.
  - q: Are a marubozu and a long bullish candle the same?
    a: They are similar, but a marubozu must have almost no wicks. A long body with long wicks is not a marubozu.
---

## How it looks

Marubozu is Japanese for a shaved head. As the name says, it is a bar with almost no upper or lower wick, opening at one end and closing at the other.

- Bullish marubozu: opens near the low and closes near the high.
- Bearish marubozu: opens near the high and closes near the low.

## What it tells you

One side pushed the price for the whole period. It means more when it appears where price breaks through support or resistance.

Textbooks read a marubozu in the direction of the trend as confirmation that the trend is strong, but the data does not back that up. Thomas Bulkowski, who tallied what actually happened after patterns across decades of US stock charts and published the results in books, found that the advance continued after a bullish marubozu 56% of the time and the decline continued after a bearish marubozu 53% of the time. Both are close to a coin flip. Bulkowski thought the marubozu was overrated relative to its results.

Where Bulkowski did find good results was the opposite-color case:

- A bearish marubozu inside an uptrend, followed by a close above its high: 2nd-best performer among common bullish continuation candles, with an average rise of 4.39% ten days later.
- A bullish marubozu inside a downtrend, followed by a close below its low: 2nd-best performer among common bearish continuation candles, with an average drop of 3.55% ten days later.

## How SIGLENS detects it

SIGLENS looks for a bar with almost no wicks, where the body fills nearly the whole bar.

- The body is at least 90% of its own high-to-low range.
- A bullish bar is a bullish marubozu; a bearish bar is a bearish marubozu.
- Only the bar's shape is checked, not the preceding trend.

A marubozu against the trend is usually a brief pullback rather than a sign that the trend is turning. If a later close moves above that bar's high (a bearish bar in an uptrend) or below its low (a bullish bar in a downtrend), SIGLENS reads the original trend as resuming. Until such a close appears, it holds off.

## Watch out for

Several marubozu in a row can mean price has already moved a lot. In that case, check [RSI](/guide/indicators/rsi) for overbought (risen so far it may pull back) or oversold (fallen so far it may bounce) conditions. A marubozu on low volume may be a shape that appeared by chance because trading was thin. When [ADX](/guide/indicators/adx), which measures trend strength, is below 20 and the market has no clear direction, SIGLENS does not count it as a signal.
