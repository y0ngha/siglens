---
title: Donchian Channel
aliases: [Donchian Channels, Turtle channel, 20-day breakout channel]
summary: A channel drawn from the highest high and lowest low of the last 20 bars, best known as the breakout benchmark in Turtle Trading.
seoTitle: Donchian Channel and the Turtle Breakout Rule
seoDescription: How the Donchian Channel is calculated, the Turtle rules of buying a 20-day high breakout and exiting on a 10-day low, and why fake breakouts pile up in ranging markets.
demoCaption: Synthetic, illustrative bars. A close breaks above the 20-bar high line, and the channel narrows and then widens.
faq:
  - q: How did Turtle Trading use the Donchian Channel?
    a: They bought when price rose above the 20-day high and sold short when it broke the 20-day low. Exits came at the 10-day low for longs and the 10-day high for shorts.
  - q: Is the win rate of Donchian breakout trading high?
    a: It is known to be low. The method works by making the average gain on winning trades larger than the average loss on losing ones, so small losses come often.
  - q: Can I use a period other than 20 bars?
    a: On short-term charts people sometimes use 10 to 15 bars, and for longer holds 50 to 55 bars. The longer the period, the fewer the noise signals.
---

## How it's calculated

The Donchian Channel was created by Richard Donchian, known as the "father of trend following." The highest high of the last N bars (20 as standard) is the upper line, the lowest low is the lower line, and the middle line is the average of the two. It is the indicator behind the Turtle Trading system of the 1980s, and it is also widely used in trend-following futures strategies.

## What it tells you

- Close above the upper line: a new 20-bar high, an upside breakout. Trend-following systems treat this spot as their buy criterion.
- Close below the lower line: a new low, a downside breakout.
- A breakout is seen as stronger when volume is above average and [ATR](/guide/indicators/atr) is rising.

The Turtle traders bought when price broke the 20-day high and took a position betting on a fall (a short sale) when it broke the 20-day low. They closed long positions at the 10-day low and short positions at the 10-day high. Getting in slowly and out quickly, the approach was designed to let profits run and cut losses short.

Channel width is also a measure of volatility. A widening channel means expanding volatility and an active trend, and a narrowing one means contracting volatility and a breakout coming soon. A channel at its narrowest in several weeks is a sign that a big move is near. Price staying near the upper line means an uptrend, staying near the lower line means a downtrend, and moving back and forth between the two lines means a sideways market. The middle line is treated as a pullback target and as secondary support or resistance.

## How Siglens detects it

Siglens watches whether price has reached the very top or bottom of the last 20 bars' range. The channel is calculated over 20 bars including the current bar.

- Reached: the current price has touched the upper or lower line
- Near: the current price is within 5% of the channel width of the upper or lower line

Because the current bar is part of the channel, touching the upper line means the current bar has set a new 20-bar high. So in this calculation the close can never sit above the upper line; touching it is the new-high breakout. The "close above the upper line" described earlier assumes a channel drawn from the previous 20 bars, without the current one. Such a spot is read as a breakout candidate, and in a sideways market also as a resistance or support candidate.

To check whether it is a real breakout, it looks at combinations like these.

- Breakout together with rising ATR: the trend is likely starting. If ATR stays flat, it is often a false breakout.
- [ADX](/guide/indicators/adx), which measures trend strength, above 25 at the breakout: already in a trend, and the breakout is acceleration. Below 20: the breakout came in a sideways market and needs more confirmation.
- [OBV](/guide/indicators/obv) at a new high in the breakout direction, or the MACD histogram growing: volume and momentum (the force behind the move) point the same way.

## Watch out for

- It uses price only and doesn't reflect volume, so breakouts are checked against a volume indicator.
- In a sideways market the channel is flat, and breakouts and pullbacks repeat often (whipsaws). ADX or channel width is used to screen out those sideways stretches.
- Breakout trading has a low win rate. It only pays when the average gain is larger than the average loss, so small losses come often.
- It reacts the same way to real and false breakouts. Filters such as ATR, volume and ADX are essential.
