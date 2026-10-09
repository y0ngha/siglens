---
title: ATR
aliases: [Average True Range, ATR indicator, volatility indicator]
summary: A volatility indicator that shows how far price moves per bar on average, regardless of direction. Often used to set stop distance and position size.
seoTitle: ATR Indicator Meaning and Stop-Loss Distance
seoDescription: What ATR is, how the 14-bar value is calculated, how to use it for stop distance and position size, and why it can't tell you which way price will go.
demoCaption: Synthetic, illustrative bars. They show ATR rising as bar movement grows and falling as it calms down.
faq:
  - q: Is a high ATR good or bad?
    a: Neither. It is just the size of the movement. A high value means price is swinging widely, and it doesn't say whether price will rise or fall.
  - q: Can I compare ATR across different stocks?
    a: ATR numbers differ a lot between price levels. Divide ATR by the closing price to turn it into a percentage, then compare.
  - q: How do I set a stop-loss with ATR?
    a: A common default is an initial stop 2 times ATR below the entry price. Short-term trades sometimes use 1.5 times, and longer trades or volatile stocks widen it to 3 times.
---

## How it's calculated

J. Welles Wilder created ATR (Average True Range) in 1978. First, each bar's True Range is found: the largest of the high minus the low, the high minus the previous close, and the low minus the previous close. This way, movement on gap days isn't missed. Averaging that value over 14 bars with Wilder's method gives ATR.

ATR says nothing about direction. It measures only how large the price movement was. Indicators that draw lines from volatility, such as [Supertrend](/guide/indicators/supertrend) and Keltner Channels, use ATR as an input.

## What it tells you

- ATR rising: volatility is increasing. This is common when a trend starts, or on a breakout or a sharp drop.
- ATR falling: movement is shrinking. More common in sideways markets and late in a trend.
- ATR unusually low for that stock: energy may be building, and a big move could come in either direction. Check direction separately with [Bollinger Bands](/guide/indicators/bollinger-bands) or the [Donchian Channel](/guide/indicators/donchian-channel).

In practice it is used in three main ways.

- Stop distance: subtracting 2 times ATR from the entry price is a common default. A multiple of 1.5 suits short-term trades, and 3 suits longer trades or volatile stocks.
- Position size: quantity = acceptable loss ÷ (ATR × multiple). With $500 of account risk, an ATR of $2.50 and a multiple of 2, that is 100 shares. Stocks with different volatility can get a similar risk per trade.
- Breakout confirmation: if ATR grows above its own 20-bar average during a breakout, the move is treated as having real volatility behind it. If ATR stays flat or shrinks, a false breakout is more likely.

## How Siglens detects it

Siglens calculates ATR over 14 bars and uses it as a risk-management indicator, not a directional signal. It checks whether ATR is rising or falling, and whether ATR grew along with a breakout, to judge the quality of the move. It also computes ATR as a percentage of the current price so volatility can be compared across stocks.

ATR also serves as a yardstick for other signals. For example, a gap signal counts only when the distance from the previous bar is at least 0.25 times ATR.

When ATR and [ADX](/guide/indicators/adx) rise together, it is read as a trending market where trend and volatility are growing together. If Bollinger Band width is narrowing and ATR is also very low for that stock, the volatility squeeze is confirmed by both indicators.

## Watch out for

- It doesn't give direction. A high value doesn't mean up or down.
- A single gap lifts ATR for the next 14 bars. Around earnings or big news, the number can be inflated.
- Price levels differ between stocks, so don't compare raw ATR numbers. Convert to a percentage with ATR ÷ close × 100.
- It's an average of past volatility and doesn't predict the future. Use it to size risk, not to forecast direction.
