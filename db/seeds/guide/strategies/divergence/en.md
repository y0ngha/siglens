---
title: Divergence
aliases: [RSI divergence, bullish divergence, bearish divergence, hidden divergence, divergence trading]
summary: "Price makes a new high or low but an indicator such as RSI does not follow: the trend may be losing strength."
seoTitle: "RSI Divergence: Meaning and How to Read It"
seoDescription: The difference between bullish, bearish and hidden divergence, how to confirm one, how Siglens finds RSI divergence, and what to watch out for.
demoCaption: "Synthetic, illustrative candles. Shows a bullish divergence: price makes a lower second low while RSI makes a higher second low at the same time."
faq:
  - q: Does the trend reverse as soon as a divergence appears?
    a: No. A divergence is closer to a warning, and in a strong trend the reversal sometimes comes only after several of them. Many traders also wait for confirmation, such as RSI leaving oversold or overbought territory or price reacting at support or resistance.
  - q: What is the difference between regular and hidden divergence?
    a: Regular divergence signals that the trend is weakening and may reverse. Hidden divergence signals that the trend continues through a pullback. They read in opposite directions, so do not mix them up.
  - q: Which indicator should I use?
    a: RSI is the most common. The MACD histogram and stochastic are also used. A divergence on several indicators at the same point carries more weight, but they are all computed from the same prices, so they are not independent confirmation.
---

## How it looks

Price and an indicator move in different directions. There are two main kinds.

- **Regular divergence**: a reversal signal that the trend has weakened.
  - Bullish: price makes a lower low, the indicator makes a higher low
  - Bearish: price makes a higher high, the indicator makes a lower high
- **Hidden divergence**: a signal that the trend continues.
  - Bullish: price makes a higher low, the indicator makes a lower low
  - Bearish: price makes a lower high, the indicator makes a higher high

[RSI](/guide/indicators/rsi) is the most common choice. The [MACD](/guide/indicators/macd) histogram and [stochastic](/guide/indicators/stochastic) are also used.

## What it tells you

If price hits a new low but RSI does not fall as far as before, selling pressure has weakened. If price hits a new high but RSI makes a lower high, buying pressure has weakened.

A divergence is a warning, not a signal of when to enter. In a strong trend, several divergences can appear in a row while the trend continues. That is why many traders also look for confirmation: RSI leaving the 30 or 70 lines, a reaction at support or resistance, or a reversal candle. A divergence on a larger timeframe such as daily or weekly is considered less noisy than one on short intraday charts.

## How Siglens detects it

What Siglens detects automatically and draws on the chart is regular RSI divergence, within the last 20 bars.

- A swing low (high) is a bar lower (higher) than the 2 bars on each side. Bullish uses the bar's low and bearish uses the bar's high.
- It compares the two most recent swing lows (highs). For bullish, price must be lower and RSI higher. Bearish is the reverse.
- The second point must be within the last 5 bars. Older divergences are not picked up.

The MACD histogram is checked separately. If the last 5 bars are all negative and the bars get shorter each time, it is read as a sign that momentum may be shifting up. If all are positive and shrinking, it may be shifting down.

For interpretation, a divergence is considered more reliable when several indicators show the same divergence on the same swing, when it sits near support or resistance, or when volume dries up at the price extreme. It is considered less reliable when only one indicator shows it, or when it comes from very short bars such as 1- or 5-minute charts.

## Watch out for

- A divergence without confirmation is only a warning.
- In a strong trend, regular divergences can appear one after another while the trend continues. Check the direction on the larger timeframe first.
- Do not read a hidden divergence as a reversal signal.
- On a bar that has not closed yet, a divergence can appear and then disappear when the bar closes.
- Check the divergence and the entry confirmation on the same timeframe.
