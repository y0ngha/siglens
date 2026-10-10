---
title: Divergence
aliases: [RSI divergence, bullish divergence, bearish divergence, hidden divergence, divergence trading]
summary: "Price makes a new high or low but an indicator such as RSI does not follow: the trend may be losing strength."
seoTitle: "RSI Divergence: Meaning and How to Read It"
seoDescription: How bullish, bearish and hidden divergences differ, how to confirm them, how SIGLENS finds RSI divergences, and what to watch out for.
demoCaption: "Synthetic, illustrative candles. Shows a bullish divergence: within the last 20 bars, price makes a lower second low while RSI makes a higher second low at the same time."
faq:
  - q: Does the trend reverse as soon as a divergence appears?
    a: No. A divergence is closer to a warning, and in a strong trend it can appear several times before a reversal. It is usually read together with confirmation, such as RSI leaving oversold territory (where price has fallen far and a bounce is seen as possible) or overbought territory (where price has risen far and a pullback is seen as possible), or price reacting at support or resistance.
  - q: What is the difference between regular and hidden divergence?
    a: Regular divergence signals that the trend is weakening and may reverse. Hidden divergence signals that the trend is continuing even during a brief pullback. The directional readings are opposite, so the two should not be mixed up.
  - q: Which indicator should I use?
    a: RSI is the most widely used, and the MACD histogram and Stochastic are also common. When several indicators show a divergence at the same spot, it counts for more than a single indicator. But they are all calculated from the same price, so their agreement is not independent confirmation.
---

## How it looks

Price and an indicator move in different directions. The indicator is usually an oscillator, one that shows the force behind price moves (momentum) as a number within a fixed range. There are two main types.

- **Regular divergence**: a reversal signal that the trend has weakened.
  - Bullish: price makes a lower low, the indicator makes a higher low
  - Bearish: price makes a higher high, the indicator makes a lower high
- **Hidden divergence**: a signal that the trend is continuing.
  - Bullish: price makes a higher low, the indicator makes a lower low
  - Bearish: price makes a lower high, the indicator makes a higher high

[RSI](/guide/indicators/rsi) is the most common choice, and the [MACD](/guide/indicators/macd) histogram and [Stochastic](/guide/indicators/stochastic) are also used.

## What it tells you

What follows is the traditional reading. SIGLENS uses divergence as a warning to read alongside other evidence.

If price makes a new low but RSI does not fall as far as before, the selling force has weakened. If price makes a new high but RSI's high is lower, the buying force has weakened.

A divergence is a warning, though, not a signal of when to buy or sell. In a strong trend, divergences can appear several times in a row while the trend carries on. That is why it is usually read together with confirmation: RSI leaving the 30 line (oversold) or the 70 line (overbought), price reacting at support or resistance, or a reversal candle. Divergences on larger timeframes such as daily or weekly charts are considered less noisy than those on short minute charts.

## How SIGLENS detects it

SIGLENS automatically finds regular RSI divergences within the last 20 bars and draws them on the chart. It picks two noticeable lows (or highs) and compares the direction of price and RSI.

- A low is a bar whose low is below the 2 bars on each side; a high is a bar whose high is above the 2 bars on each side.
- Bullish: comparing the two most recent lows, price's low is lower and RSI's low is higher.
- Bearish: comparing the two most recent highs, price's high is higher and RSI's high is lower.
- The second point must fall within the last 5 bars. Old divergences are not picked up.

The MACD histogram is checked separately. When negative bars shrink on each of 5 consecutive bars, the selling force is fading, which is read as a possible turn upward. When positive bars shrink for 5 consecutive bars, the buying force is fading, which is read as a possible turn downward.

When several indicators show the same divergence at the same swing (a clearly turned high or low), it counts for more than a single indicator, though it is not independent confirmation since all come from the same price. More weight goes to divergences near support or resistance, or where volume dried up as price reached its extreme. Divergences seen in only one indicator, or on very short bars such as 1- or 5-minute charts, are considered less reliable.

## Watch out for

- A divergence without confirmation is only a warning.
- In a strong trend, regular divergences can appear repeatedly while the trend continues. That is why many readings check the direction on the larger timeframe first.
- Do not read a hidden divergence as a reversal signal.
- On a bar that has not closed yet, a divergence can appear and then vanish once the bar closes.
- A divergence and its confirmation should be read on the same timeframe.
