---
title: "Moving Average (MA)"
aliases: [Moving Average, MA, SMA, Simple Moving Average, Golden Cross, Death Cross]
summary: "A line of average closing prices over a set period, used to read trend, support and resistance, and crosses."
seoTitle: "Moving Averages: Golden Cross and Death Cross"
seoDescription: How to read the 5-, 20-, 60-, 120- and 200-day moving averages, what golden and death crosses and bullish or bearish alignment mean, and the limits of a lagging line.
demoCaption: "Synthetic, illustrative bars. The marked point is a golden cross, where the 20-day line crosses above the 50-day line."
faq:
  - q: "What are a golden cross and a death cross?"
    a: "A golden cross is when a short moving average crosses above a long one; a death cross is when it crosses below. Both confirm a trend change that has already started, so they are not a way to predict what comes next."
  - q: "Which moving average periods are most common?"
    a: "The 5, 20, 60, 120 and 200-day averages. Siglens calculates all five, and also uses the 50-day line for golden cross and support/resistance detection."
  - q: "Can I trust golden crosses on minute or hourly charts?"
    a: "They are fairly reliable on daily charts and above. On minute and hourly charts, false signals are common."
---

## How it's calculated

A simple moving average (SMA) adds the last N closes and divides by N. Slide the window forward one bar at a time and connect the results, and you get a moving average line. Every close carries the same weight, so it moves more slowly than an [exponential moving average](/guide/indicators/ema) and suits medium- to long-term trends and structural price levels.

## What it tells you

- Support and resistance: the 20-day line is often tested as support in an uptrend or resistance in a downtrend. The 60-day line is the pivot of the medium-term trend, and a close above or below it is often read as a major shift. The 120-day and 200-day lines are long-term baselines, and the 200-day in particular is a level many investors watch.
- Golden cross and death cross: a shorter line crossing above a longer one is a golden cross; crossing below is a death cross. The 20-day or 60-day line crossing the 120-day or 200-day line is the case most often treated as a medium- to long-term signal. A cross is considered more meaningful when volume rises or [ADX](/guide/indicators/adx) (a gauge of trend strength) is climbing.
- Alignment: when the lines sit in the order 5 > 20 > 60 > 120 > 200 from the top and price is above them all, that is bullish alignment, the strongest uptrend structure. The reverse order with price below all of them is bearish alignment. When the lines converge, the trend is weakening.
- Distance (how far price has moved from a moving average): when price is more than 10–15% away from the 200-day line, that is often treated as an extreme, with a growing pull back toward the average.

## How Siglens detects it

Siglens uses moving averages to read the frame of the current trend, and separately flags crosses and moments when price nears a key line. The 5, 20, 60, 120 and 200-day lines always go into the analysis: it works out how many percent price sits above or below each line, whether the lines are in bullish alignment, bearish alignment or mixed, and how far apart neighboring lines are. From the order of the 5, 20 and 60-day lines it also determines which stage of the [moving average grand cycle](/guide/strategies/ma-cycle) (a way of splitting a trend into stages by the order of those three lines) the chart is in.

Crosses and approaches to support or resistance count as signals. The 50-day line used here is calculated separately from the five lines above.

- Golden cross and death cross: if the 20-day line crosses above the 50-day line within the last 3 bars, it is a golden cross; crossing below is a death cross. Siglens uses this 20/50-day cross, not the 20/60-day over 120/200-day crosses described above.
- Support approach: the close has fallen to within 2% above the 50-day or 200-day line while being lower than 5 bars ago.
- Resistance approach: the close has risen to within 2% below the 50-day or 200-day line while being higher than 5 bars ago.

A cross is trusted more when volume rises with it, and it is read alongside timing indicators such as [MACD](/guide/indicators/macd). The moving averages show the frame of the trend; MACD crossovers help judge when the flow turns inside that frame.

## Watch out for

- Every period is weighted equally, so it lags more than an EMA. In a fast market, support can break before the line catches up.
- A line everyone watches, like the 200-day, can act as support or resistance simply because many participants are aware of it.
- Crosses are often false on minute and hourly charts.
- When a line lies flat, there is no trend. Trend-following with moving averages does not fit then.
