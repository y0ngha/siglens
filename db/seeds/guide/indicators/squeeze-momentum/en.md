---
title: "Squeeze Momentum"
aliases: [Squeeze Momentum, Squeeze Momentum Indicator, TTM Squeeze, LazyBear Squeeze, Bollinger Keltner Squeeze]
summary: "Shows when Bollinger Bands narrow inside the Keltner Channel (the squeeze) and which way momentum points when it releases."
seoTitle: "Squeeze Momentum Indicator: Squeeze ON and OFF"
seoDescription: "How Squeeze Momentum finds volatility compression with Bollinger Bands and the Keltner Channel: the calculation, what ON and OFF mean, and how to read the bars."
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
- Momentum value: first a reference price is set, which is the average of the midpoint of the highest high and lowest low of the last 20 bars and the 20-bar simple moving average. Then the distance of the close from this reference is calculated and smoothed with a 20-bar linear regression. What counts is whether the bar is above or below 0, and whether it is growing or shrinking.

## What it tells you

When price stays in a narrow range for a long time, energy is considered to have built up, and some hold that the longer the squeeze, the bigger the move after release.

- Momentum above 0 and growing means upward force is strengthening; above 0 but shrinking means it is weakening.
- Momentum below 0 and falling further means downward force is strengthening; below 0 but rising means it is weakening.
- Momentum crossing the zero line is read as a change of direction.
- If the squeeze turns OFF while momentum is positive and growing, it is seen as releasing upward; if negative and falling further, downward.
- If the squeeze has released but momentum direction is already turning, it can be a false breakout or early exhaustion.

## How Siglens detects it

Siglens uses Bollinger Band length 20, Keltner Channel length 20 and Keltner multiplier 1.5. The Bollinger deviation multiplier is also 1.5 rather than the standard 2.0. LazyBear's original code is written that way, and Siglens follows the original. So the bands in this indicator are narrower than regular Bollinger Bands (20, 2.0), and squeezes show up more often. The Keltner Channel here is also built by adding and subtracting 1.5 times the average True Range around a 20-bar simple moving average, so its values differ from a standalone Keltner Channel. It is better not to compare them directly with other Bollinger Bands or Keltner Channels on the chart.

A signal is flagged when the momentum bar crosses the zero line. A change from negative to positive within the last 3 bars is a bullish signal, and positive to negative is a bearish signal. Whether the squeeze is ON or OFF is read alongside as background for the signal. For confirmation it looks at the direction of the [MACD](/guide/indicators/macd) histogram at the same point, RSI above or below 50, and surges in buying volume.

## Watch out for

- A long-running squeeze does not make the signal weaker. But the direction of release cannot be known from the squeeze alone.
- In quiet, choppy markets, ON and OFF can flip often without any big move. One way to check is whether [ADX](/guide/indicators/adx) is above 20.
- The momentum value is smoothed by regression, so it misses sharp intraday reversals.
- On short timeframes it crosses the zero line often. Look for whether it holds for a bar or two before judging.
- It suits daily and hourly charts. On minute charts, some traders shorten the length to 10–14.
