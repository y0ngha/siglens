---
title: Donchian Channel
aliases: [Donchian Channels, Turtle channel, 20-day breakout channel]
summary: A channel drawn from the highest high and lowest low of the last 20 bars, best known as the breakout benchmark in Turtle Trading.
seoTitle: Donchian Channel and the Turtle Breakout Rule
seoDescription: The Donchian Channel formula, the Turtle rule of buying a 20-day high breakout and exiting at a 10-day low, plus false breakouts and low win rates in ranges.
demoCaption: Synthetic, illustrative bars. A close breaks above the 20-bar high line, and the channel narrows and then widens.
faq:
  - q: How did Turtle Trading use the Donchian Channel?
    a: They bought when price rose above the 20-day high and sold short when it broke the 20-day low. Exits came at the 10-day low for longs and the 10-day high for shorts.
  - q: Is the win rate of Donchian breakout trading high?
    a: It is known to be low. The method works by making the average gain on winning trades larger than the average loss on losing ones, so you have to put up with frequent small losses.
  - q: Can I use a period other than 20 bars?
    a: On short-term charts people sometimes use 10 to 15 bars, and for longer holds 50 to 55 bars. The longer the period, the fewer the noise signals.
---

## How it's calculated

The Donchian Channel was created by Richard Donchian, known as the "father of trend following." The highest high of the last N bars (20 as standard) is the upper line, the lowest low is the lower line, and the middle line is the average of the two. It is the indicator behind the Turtle Trading system of the 1980s, and it is also widely used in trend-following futures strategies.

## What it tells you

- Close above the upper line: a new 20-bar high, an upside breakout. In a trend-following system it is the entry criterion.
- Close below the lower line: a new low, a downside breakout.
- A breakout is seen as stronger when volume is above average and [ATR](/guide/indicators/atr) is rising.

The Turtle rule enters long when price breaks the 20-day high and short when it breaks the 20-day low. Long positions are closed at the 10-day low and short positions at the 10-day high. With slow entries and fast exits, it is designed to let profits run and cut losses short.

Channel width is also a measure of volatility. A widening channel means expanding volatility and an active trend, and a narrowing one means contracting volatility and a breakout coming soon. A channel at its narrowest in several weeks is a sign that a big move is near. Price staying near the upper line means an uptrend, staying near the lower line means a downtrend, and moving back and forth between the two lines means a sideways market. The middle line is treated as a pullback target and as secondary support or resistance.

## How Siglens detects it

Siglens calculates a 20-bar Donchian Channel that includes the current bar. If the current price has touched the upper or lower line, or come within 5% of the channel width of it, that position is interpreted separately. Because the current bar is part of the channel, touching the upper line means the current bar has set a new 20-bar high.

To confirm a breakout, it uses combinations like these.

- Breakout together with rising ATR: the trend is likely starting. If ATR stays flat, a false breakout is more likely.
- [ADX](/guide/indicators/adx) above 25 at the breakout: already in a trend, and the breakout is acceleration. Below 20: the breakout came in a sideways market and needs more confirmation.
- [OBV](/guide/indicators/obv) at a new high in the breakout direction, or the MACD histogram growing: volume and momentum point the same way.

## Watch out for

- It uses price only and doesn't reflect volume. Look at breakouts together with a volume indicator.
- In a sideways market the channel is flat, and breakouts and pullbacks repeat often (whipsaws). Filter out sideways markets with ADX or channel width.
- Breakout trading has a low win rate. It only pays when the average gain is larger than the average loss, so you have to be able to take frequent small losses.
- It reacts the same way to real and false breakouts. Filters such as ATR, volume and ADX are essential.
