---
title: "Yang-Zhang Volatility"
aliases: [Yang-Zhang, Yang-Zhang Volatility, YZ Volatility, Yang Zhang Estimator]
summary: "Measures actual volatility from the open, high, low, close and overnight gap. It gives no direction."
seoTitle: "Yang-Zhang Volatility: What It Is and Its Uses"
seoDescription: How Yang-Zhang volatility captures both gaps and intraday moves, how it helps gauge stop distance, and why it says nothing about direction.
demoCaption: "Synthetic, illustrative bars. The volatility value rises while gaps and long bars keep coming."
faq:
  - q: "Does high Yang-Zhang volatility mean the price will fall?"
    a: "No. Volatility only tells you how large the moves were, not whether price rises or falls. It is not used as a directional signal."
  - q: "How is Yang-Zhang volatility different from ATR?"
    a: "Both measure the size of moves, but Yang-Zhang blends the gap from the previous close to the open, the open-to-close move, and the intraday high-low move in the proportions that keep estimation error smallest. It is designed to give a stable value from fewer bars."
---

## How it's calculated

In one line: it folds in the overnight gap, the open-to-close move and the intraday high and low, so it measures how much price actually swung more accurately than the close alone.

It blends three kinds of movement. For each, it finds how widely that move was spread over recent bars (its variance).

- Overnight gap: the percentage move from the previous close to the open
- The percentage move from the open to the close
- Intraday movement: how far the high and low stretched from the open and close (the Rogers-Satchell method)

The blending ratio is set by k = 0.34 ÷ (1.34 + (n+1)/(n−1)), where n is the number of bars used. The weights are chosen to minimize estimation error, so a fairly stable value comes out even from few bars. It is not thrown off by a steady one-way trend, and it stays unbiased when the open gaps far from the previous close.

The value is per bar: on a daily chart it shows, as a decimal, roughly how many percent price typically swings in a day. That is a much smaller number than the annualized volatility you usually see.

The method was published by Dennis Yang and Qiang Zhang in the Journal of Business in 2000.

## What it tells you

It measures only the size of the swings, so it has no direction. It is mainly used for risk management.

- A high value means everyday swings are large, so a tight stop is easily hit by meaningless noise. A low value is taken only as a hint that there is little need to widen the stop much.
- A rising value means price has room to go further when another signal appears, and a falling value means little room.

## How Siglens detects it

Siglens flags Yang-Zhang volatility when it has grown or shrunk well beyond its usual level. It does not judge whether price will rise or fall, and uses the value only as a reference for gauging stop distance.

- Range: the last 20 bars. Each bar needs the previous close, so the first 20 bars of the chart have no value.
- High-volatility phase: the latest value is 1.5 times the last-20-bar average or more.
- Low-volatility phase: the latest value is half the last-20-bar average or less.

Read alongside the [Chandelier Exit](/guide/indicators/chandelier-exit), which sets its stop from [ATR](/guide/indicators/atr) (the average range of recent bars), it helps judge whether that stop fits the current size of swings. [EWMA volatility](/guide/indicators/ewma-volatility) is calculated only from close-to-close returns and weights recent values more. When the two diverge widely, it means the intraday swings and the close-to-close moves differ in size.

## Watch out for

- It has no direction. High volatility is not read as bullish or bearish.
- Even if it is stable from few bars, it is an estimate. A value measured over 20 bars has error, so do not put much weight on small differences.
- It is affected by stray prints such as quote errors, and by prices moving only in fixed tick steps. It is also an estimate from past bars, so it reacts more slowly than a close-to-close measure when a sudden shock arrives.
