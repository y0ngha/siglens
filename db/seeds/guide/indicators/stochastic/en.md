---
title: "Stochastic Oscillator"
aliases: [Stochastic, Stochastic Oscillator, Slow Stochastic, "%K %D", Stochastics]
summary: "A momentum indicator showing, from 0 to 100, where the current close sits within the recent high-low range."
seoTitle: "How to Read the Stochastic: %K/%D Crosses and 80/20"
seoDescription: How the stochastic oscillator is calculated, its 80 and 20 levels, how to read %K/%D crosses and divergences, and when overbought and oversold readings mislead in a trend.
demoCaption: "Synthetic, illustrative bars. As price rises off the bottom, %K crosses up through %D below 20."
faq:
  - q: "What does Stochastic (14, 3, 3) mean?"
    a: "%K looks at the high-low range of 14 bars, and that value is smoothed over 3 bars to make slow %K. The last 3 is %D, the 3-bar simple moving average of slow %K."
  - q: "When can I trust a Stochastic golden cross?"
    a: "When %K crosses above %D and both lines are below 20, reliability is considered high. Crosses in the middle zone between 40 and 60 are weak, so the trend direction is often checked as well."
---

## How it's calculated

The Stochastic Oscillator was popularized by George Lane in the 1950s. It expresses, as a percentage, where the current close sits between the highest high and lowest low of a recent period. A close near the recent high pushes it toward 100, and one near the recent low pushes it toward 0.

The standard setting is (14, 3, 3). The raw %K is built from the high-low range of 14 bars, and smoothing it with a 3-bar simple moving average gives slow %K. Taking a 3-bar simple moving average of that %K gives the signal line %D.

## What it tells you

- %K above 80 is treated as overbought and below 20 as oversold. Above 90 or below 10 means the force in that direction is very strong, so betting against it without checking the trend is risky.
- %K crossing above %D (golden cross) signals an upward turn, and crossing below (death cross) signals a downward turn. They are considered most reliable when both lines make a golden cross below 20 or a death cross above 80. Crosses between 40 and 60 are weak.
- If price makes a lower low but the Stochastic low is higher, that is bullish divergence, meaning downward force is easing. If price makes a higher high but the Stochastic high is lower, that is bearish divergence. They count for more when they appear in the overbought or oversold zone.
- %D staying above 50 means upward momentum dominates, and staying below 50 means downward momentum dominates.

## How Siglens detects it

Siglens uses the standard (14, 3, 3) and marks the last bar's slow %K at 80 or above as overbought and at 20 or below as oversold. [Williams %R](/guide/indicators/williams-r) carries the same information as this indicator, but the Stochastic Siglens shows is the smoothed slow %K, so reading the two together is meaningful. If the unsmoothed %R reaches an extreme first and slow %K follows, a turning point may be close.

It weighs reliability differently by market state. In a sideways market where [ADX](/guide/indicators/adx) is below 20, signals fit better, and in a trending market above 25, signals can lag price. A combination it recommends is timing with the Stochastic and medium-term direction with [MACD](/guide/indicators/macd), using a cross only when both point the same way.

## Watch out for

- In a strong trend, it can sit above 80 or below 20 for several bars with no reversal. Do not treat crossing 80 as an immediate decline.
- Shortening the %K period to 5 or 9 gives faster signals but adds noise. Lengthening it to 21 gives fewer signals, leaving only more filtered ones.
- Rather than a standalone signal, it is often used together with another oscillator like RSI and a check at the lower Bollinger Band.
