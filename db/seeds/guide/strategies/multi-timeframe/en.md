---
title: Multi-Timeframe Analysis
aliases: [multi timeframe, higher timeframe trend, timeframe alignment, MTF analysis, Multi Timeframe Analysis]
summary: "Check the larger timeframe's trend first, then screen whether the signal you see agrees with it."
seoTitle: "Multi-Timeframe Analysis: How to Read It"
seoDescription: Why signals are filtered by the higher-timeframe trend, how the 60-, 120- and 200-day moving averages are used to gauge that trend, and how to read timeframe alignment.
demoCaption: Synthetic, illustrative candles. Shows a larger uptrend above the long moving averages and the short pullbacks inside it.
faq:
  - q: Do I need to look at several charts for multi-timeframe analysis?
    a: The original approach is to read the direction on the weekly chart and pick the timing on the daily or hourly chart. Siglens analyzes one timeframe at a time, so it estimates the big trend from the long moving averages and price structure within that chart.
  - q: Should I ignore counter-trend signals?
    a: No. A signal against the larger trend is read with a note that it needs more confirmation.
  - q: Does alignment mean price will rise?
    a: No. Alignment is a filter for screening signals, not a tool for calling direction. Even when everything is aligned, it can fail if unexpected news arrives.
---

## What it is

The same stock looks different on different timeframes. It may look like it is falling on the daily chart but be a pullback inside an uptrend on the weekly chart. Multi-timeframe analysis is the sequence of confirming direction on a larger timeframe and then picking the timing on a smaller one.

Siglens analyzes bars from one timeframe at a time. So instead of comparing three charts, this strategy estimates the big trend from the long moving averages and price structure already on the chart, and uses it as a filter on other signals.

## What it tells you

A signal in the same direction as the big trend gets more weight, and a signal against it is treated as needing more confirmation. When support or resistance on the larger timeframe collides with a short-term signal, the larger one is read as more important. In a sideways or transitional stretch with no clear trend, confidence is lowered either way.

This strategy does not predict direction. It is a filter that tells you whether other analysis agrees with the larger flow.

## How Siglens detects it

Siglens sets the big trend to one of three states by checking whether price is above the long moving averages and whether highs and lows are rising or falling. The long lines are the 60-, 120- and 200-bar [moving averages](/guide/indicators/ma) (the 60-, 120- and 200-day lines on a daily chart), and highs and lows are judged from clear turning points (swings).

- **Uptrend**: price is above the 120- and 200-day lines, the 60-day line is above the 200-day line and rising, and highs and lows are both getting higher.
- **Downtrend**: price is below the 120- and 200-day lines, the 60-day line is below the 200-day line and falling, and highs and lows are both getting lower.
- **Sideways or transition**: price sits between the long lines, or the long lines are flat or tangled, and there is no clear swing sequence.

It then compares whether three things (long-term trend, short-term structure, momentum) point the same way.

- **Long-term trend**: the big trend set above.
- **Short-term structure**: the direction of the 5- and 20-day lines and recent swings.
- **Momentum** (the force behind price moves): whether [RSI](/guide/indicators/rsi) is above 50 and MACD is above the zero line.

The result is one of three.

- **Strong**: all three point the same way. The current signal is not going against the larger flow.
- **Partial**: only two agree. The signal has that much less support.
- **Conflict**: the long-term trend disagrees with the other two. The short-term flow runs against the big trend, so a signal in that direction is read as counter-trend and treated as needing more confirmation.

## Watch out for

- Long moving averages on one timeframe do not replace an actual higher-timeframe chart. If there are too few bars to calculate the 200-day line, the estimate is weaker.
- When to act on a shorter timeframe cannot be judged from this analysis alone. That takes a separate look at the shorter chart.
- When the long lines are flat or tangled, reliability drops.
- Late in a trend, an overbought reading (risen so far that it may be pushed back) or a sudden volume surge can mean the trend is ending, even if the direction matches.
- Even with alignment, it fails on unexpected news.
