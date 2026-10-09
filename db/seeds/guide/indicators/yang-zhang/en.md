---
title: "Yang-Zhang Volatility"
aliases: [Yang-Zhang, Yang-Zhang Volatility, YZ Volatility, Yang Zhang Estimator]
summary: "Measures actual volatility from the open, high, low, close and overnight gap. It gives no direction."
seoTitle: "Yang-Zhang Volatility: What It Is and Its Uses"
seoDescription: "How Yang-Zhang volatility combines gaps and intraday moves, how to use it for stop width and position size, and why it gives no direction."
demoCaption: "Synthetic, illustrative bars. The volatility value rises where gaps are large and bars are long, and falls in quiet stretches."
faq:
  - q: "Does high Yang-Zhang volatility mean the price will fall?"
    a: "No. Volatility only tells you how large the moves were, not whether price rises or falls. It is not used as a directional signal."
  - q: "How is Yang-Zhang volatility different from ATR?"
    a: "Both measure the size of moves, but Yang-Zhang blends the gap from the previous close to the open, the open-to-close move, and the intraday high-low move in a way close to minimum variance. It is designed to give a stable value from fewer bars."
---

## How it's calculated

Yang-Zhang volatility is an estimation method published by Dennis Yang and Qiang Zhang in the Journal of Business in 2000. It uses the open, high, low and close rather than the close alone. It is not thrown off by a steady one-way trend, and it stays unbiased when the open gaps far from the previous close.

It blends three kinds of movement.

- Overnight gap: the variance of the log return from the previous close to the open
- The variance of the open-to-close move
- The move that reflects the intraday high and low (the Rogers-Satchell estimator)

The blending ratio is set by k = 0.34 ÷ (1.34 + (n+1)/(n−1)), where n is the number of bars used. The weights are chosen to minimize estimation error, so a fairly stable value comes out even from few bars.

## What it tells you

It measures only the size of the swings, so it has no direction. It is mainly used for risk management.

- A high value suggests widening the stop and reducing position size, and a low value suggests there is room to tighten the stop and increase size.
- A rising value means there is room for a move to go further when another signal appears, and a falling value means little room.

## How Siglens detects it

Siglens calculates it over the last 20 bars. Each bar needs the previous close, so the first 20 bars of the chart have no value.

When the latest value is 1.5 times the average of the last 20 bars or more, it is marked as a high-volatility phase, and at 0.5 times or less as a low-volatility phase. It does not judge whether price will rise or fall, and uses the value only as a reference for setting stop width and position size.

Combined with the [Chandelier Exit](/guide/indicators/chandelier-exit), which is based on [ATR](/guide/indicators/atr), it can help set a stop that matches volatility. [EWMA volatility](/guide/indicators/ewma-volatility) is calculated only from close-to-close returns and weights recent values more. When the two diverge widely, it means the intraday swings and the close-to-close moves differ in size.

## Watch out for

- It has no direction. High volatility is not read as bullish or bearish.
- Even if it is stable from few bars, it is an estimate. A value measured over 20 bars has error, so do not put much weight on small differences.
- It is affected by tick outliers such as quote errors and by price discreteness. It is an estimator based on past data, so it reacts more slowly than a close-based measure when a sudden shock arrives.
