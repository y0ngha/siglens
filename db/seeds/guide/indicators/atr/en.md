---
title: ATR
aliases: [Average True Range, ATR indicator, volatility indicator]
summary: A volatility indicator that shows how far price moves per bar on average, regardless of direction. Often used to set stop distance and position size.
seoTitle: ATR Indicator Meaning and Stop-Loss Distance
seoDescription: What ATR is, how it is calculated over 14 bars, how to use it to set stop distance and position size, and why it says nothing about direction.
demoCaption: Synthetic, illustrative bars. They show ATR rising in a stretch where the range widens and falling once things quiet down.
faq:
  - q: Is a high ATR good or bad?
    a: Neither. It is just the size of the movement. A high value means price is swinging widely, and it doesn't say whether price will rise or fall.
  - q: Can I compare ATR across different stocks?
    a: ATR numbers differ a lot between price levels. Dividing ATR by the closing price turns it into a percentage you can compare.
  - q: How do I set a stop-loss with ATR?
    a: A common default is an initial stop 2 times ATR below the entry price. Short-term trades sometimes use 1.5 times, and longer trades or volatile stocks widen it to 3 times.
---

## How it's calculated

J. Welles Wilder created ATR (Average True Range) in 1978. First, each bar's True Range is found: the largest of the high minus the low, the high minus the previous close, and the low minus the previous close. This way, movement on gap days isn't missed. Averaging that value over 14 bars with Wilder's method gives ATR.

ATR says nothing about direction. It measures only how large the price movement was. Indicators that draw lines from volatility, such as [Supertrend](/guide/indicators/supertrend) and Keltner Channels, use ATR as an input.

## What it tells you

- ATR rising: volatility is increasing. This is common when a trend starts, or on a breakout or a sharp drop.
- ATR falling: movement is shrinking. More common in sideways markets and late in a trend.
- ATR unusually low for that stock: movement is being held down, and a big move could come in either direction. Check direction separately with [Bollinger Bands](/guide/indicators/bollinger-bands) or the [Donchian Channel](/guide/indicators/donchian-channel).

In practice it is used in three main ways.

- Stop distance: subtracting 2 times ATR from the entry price is a common default. A multiple of 1.5 suits short-term trades, and 3 suits longer trades or volatile stocks.
- Position size: a widely known method sets quantity = acceptable loss ÷ (ATR × multiple). With $500 of account risk, an ATR of $2.50 and a multiple of 2, that works out to 100 shares. This way, stocks with different volatility end up with a similar risk per trade.
- Breakout confirmation: if ATR grows above its own 20-bar average during a breakout, the move is treated as having real volatility behind it. If ATR stays flat or shrinks, it is often a false breakout.

## How Siglens detects it

Siglens doesn't use ATR to guess direction. It uses it to measure how big the current movement is and so gauge risk. ATR is calculated over the last 14 bars.

- Volatility trend: whether ATR is rising or falling, and whether ATR grew along with a breakout, help judge whether the move is reliable.
- Comparing stocks: ATR is expressed as a percentage of the current price, so volatility can be compared across stocks at different price levels.
- Yardstick for other signals: for example, a gap signal counts only when the distance from the previous bar is at least 0.25 times ATR.

When ATR and [ADX](/guide/indicators/adx), which measures trend strength, rise together, it is read as a stretch where the trend is strengthening and movement is growing. If Bollinger Band width is narrowing and ATR is also very low for that stock, both indicators are saying movement has shrunk.

## Watch out for

- It doesn't give direction. A high value doesn't mean up or down.
- A single gap lifts ATR for the next 14 bars. Around earnings or big news, the number can be inflated.
- Price levels differ between stocks, so raw ATR numbers are hard to compare. Converting to a percentage with ATR ÷ close × 100 makes them comparable.
- It's an average of past volatility and doesn't predict the future. Use it to size risk, not to forecast direction.
