---
title: "Squeeze Momentum"
aliases: [Squeeze Momentum, Squeeze Momentum Indicator, TTM Squeeze, LazyBear Squeeze, Bollinger Keltner Squeeze]
summary: "Shows when Bollinger Bands narrow inside the Keltner Channel (the squeeze) and which way momentum points when it releases."
seoTitle: "Squeeze Momentum Indicator: Squeeze ON and OFF"
seoDescription: How Squeeze Momentum finds volatility compression with Bollinger Bands and Keltner Channels, what ON and OFF mean, and how to read the momentum bars.
demoCaption: "Synthetic, illustrative bars. A compression stretch where bars narrow, then a move up after release, with the momentum bars growing positive."
faq:
  - q: "What do squeeze ON and OFF mean?"
    a: "ON means the Bollinger Bands are inside the Keltner Channel and volatility is compressed; OFF means the bands have moved back outside the channel. ON is usually read as the setup stage and OFF as the point where the compression releases."
  - q: "Which way does price move when the squeeze releases?"
    a: "The squeeze itself does not give a direction. You estimate it from whether the momentum value is positive or negative, and whether it is growing or shrinking, at the moment of release."
---

## How it's calculated

Squeeze Momentum is an indicator LazyBear published on TradingView, based on John Carter's TTM Squeeze. It finds a state where volatility is compressed and shows which way force builds when it releases. It has two components.

- Squeeze state: the [Bollinger Bands](/guide/indicators/bollinger-bands) and the [Keltner Channel](/guide/indicators/keltner-channel) are overlaid. When the bands are fully inside the channel, the squeeze is ON; when they move back outside, it is OFF; otherwise it is neutral.
- Momentum value: first a reference price is set, which is the average of the midpoint of the highest high and lowest low of the last 20 bars and the 20-bar simple moving average. Then the distance of the close from this reference is calculated and smoothed with a 20-bar linear regression, which fits the straight line that best matches the last 20 values and so evens out the jagged readings. What counts is whether the bar is above or below 0, and whether it is growing or shrinking.

## What it tells you

When price stays in a narrow range for a long time, volatility is considered to be held down, and some hold that the longer the squeeze, the bigger the move after release.

- Momentum above 0 and growing means upward force is strengthening; above 0 but shrinking means it is weakening.
- Momentum below 0 and falling further means downward force is strengthening; below 0 but rising means it is weakening.
- Momentum crossing the zero line is read as a change of direction.
- If the squeeze turns OFF while momentum is positive and growing, it is seen as releasing upward; if negative and falling further, downward.
- If the squeeze has released but momentum direction is already turning, it can be a false breakout, or the move may have run out of force early.

## How Siglens detects it

Siglens flags the moment the momentum bar crosses the zero line and changes direction.

- Bullish signal: momentum turns from negative to positive within the last 3 bars
- Bearish signal: momentum turns from positive to negative within the last 3 bars
- Squeeze ON/OFF: not a signal on its own; it is read alongside as background for the signals above.

For confirmation it looks at the direction of the [MACD](/guide/indicators/macd) histogram at the same point, RSI above or below 50, and surges in buying volume.

The Bollinger Bands and Keltner Channel inside this indicator use different settings from the Bollinger Bands and Keltner Channel articles in this guide.

- Bollinger Bands: the length is the same 20, but the deviation multiplier is 1.5 instead of the standard 2.0. LazyBear's original code is written that way, and Siglens follows the original. So the bands are narrower than regular Bollinger Bands (20, 2.0), and squeezes show up more often.
- Keltner Channel: the Keltner Channel article adds and subtracts 2 times the 10-day ATR around a 20-day EMA, but here it is 1.5 times the 20-bar average True Range around a 20-bar simple moving average.

So it is better not to compare their values directly with a Bollinger Band or Keltner Channel shown separately on the chart.

## Watch out for

- A long-running squeeze does not make the signal weaker. Some hold that a longer squeeze leads to a bigger move after release, but its length doesn't tell you the direction.
- In quiet, choppy markets, ON and OFF can flip often without any big move. So Siglens also checks whether [ADX](/guide/indicators/adx), which measures trend strength, is above 20.
- The momentum value is smoothed by regression, so it misses sharp intraday reversals.
- On short timeframes it crosses the zero line often. Look for whether it holds for a bar or two before judging.
- It suits daily and hourly charts. On minute charts, some traders shorten the length to 10–14.
