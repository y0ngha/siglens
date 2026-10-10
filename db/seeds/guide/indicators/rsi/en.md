---
title: "RSI"
aliases: [RSI, Relative Strength Index, RSI 14, RSI Divergence]
summary: "Turns the ratio of recent gains to losses into a 0 to 100 scale to gauge overbought and oversold conditions."
seoTitle: "RSI Explained: What 70 and 30 Mean"
seoDescription: How RSI 14 is calculated, its 70 and 30 levels, 50-line crosses, how to read divergences and failure swings, and when RSI misleads you in a trend.
demoCaption: "Synthetic, illustrative bars. Price rises sharply, RSI climbs above 70, and then turns down."
faq:
  - q: "Should I sell when RSI goes above 70?"
    a: "It cannot be treated as an automatic sell signal. In a strong uptrend, RSI can stay above 70 for a long time. Trend strength and other indicators are usually checked as well."
  - q: "What is RSI divergence?"
    a: "It is a mismatch where price makes a new high but the RSI high is lower, or price makes a new low but the RSI low is higher. It means momentum is not keeping up with price, and it is read as a possible turn."
---

## How it's calculated

RSI (Relative Strength Index) is a momentum indicator introduced by J. Welles Wilder in 1978. It turns the ratio of average gain to average loss over a set period into a number between 0 and 100. The averages are smoothed using Wilder's method, which blends in recent values gradually. The stronger the up days, the closer to 100; the stronger the down days, the closer to 0.

14 is the standard period, which means 14 days on a daily chart. It is considered a setting with reasonable sensitivity for swing trading.

## What it tells you

- Above 70 is treated as overbought and below 30 as oversold. These levels are used to watch for a short-term pullback or bounce. Readings above 80 or below 20 are extremes that show up in volatile markets, and are often checked against other indicators.
- The 50 line is the balance point between upward and downward strength. A move from below 50 to above it is read as a shift to upward momentum, and from above to below as a shift to downward momentum. It is said to be more reliable on daily charts and above.
- Divergence is a shape where price and RSI move in different directions. If price makes a higher high but the RSI high is lower, it points toward a bearish turn; if price makes a lower low but the RSI low is higher, it points toward a bullish turn. More detail is in the [divergence strategy](/guide/strategies/divergence).
- A failure swing is when RSI fails to exceed its prior high in the overbought zone and then breaks its prior low (the bearish type). In the oversold zone, holding above the prior low and then exceeding the prior high is the bullish type.

## How Siglens detects it

Siglens uses RSI 14, and flags overbought when the last bar's RSI is above 70 and oversold when it is below 30.

It looks for divergence within the last 20 bars. A high (or low) that is higher (or lower) than the 2 bars on each side counts as a peak, and the price and RSI of the two most recent peaks are compared. If price makes a lower low but the RSI low is higher, that is bullish divergence; if price makes a higher high but the RSI high is lower, that is bearish divergence. It only counts as a signal when the second peak falls within the last 5 bars. The 50-line cross and failure swings are looked at during interpretation.

Trend strength is read alongside. In a strong uptrend where [ADX](/guide/indicators/adx) is above 25, RSI in the overbought zone is interpreted as trend continuation rather than a reversal. Divergence is considered more reliable in sideways or weakening-trend stretches, and during a strong trend it is checked against [MACD](/guide/indicators/macd) or a Bollinger Band contraction. RSI below 30 with price near the lower Bollinger Band is seen as a combination with a high chance of mean reversion.

## Watch out for

- When the trend is strong, RSI can stay in the overbought or oversold zone for several bars. Expecting a decline just because it passed 70 tends to go wrong.
- Divergence that appears in a strong trend is often false. Check trend strength with ADX or the slope of the moving averages.
- Adding a signal line, such as a 9-day exponential moving average, on top of the indicator can reduce noise.
