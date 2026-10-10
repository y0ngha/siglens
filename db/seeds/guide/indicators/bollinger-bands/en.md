---
title: Bollinger Bands
aliases: [BB, Bollinger Bands indicator, Bollinger Band squeeze]
summary: Bands drawn 2 standard deviations above and below the 20-day moving average, showing how far price has strayed from its recent trend and how large volatility is.
seoTitle: "How to Read Bollinger Bands: Squeeze and Band Walk"
seoDescription: How Bollinger Bands are calculated and how to read band touches, squeezes and band walks, plus why touching the upper band is not automatically a sell signal.
demoCaption: Synthetic, illustrative bars. The bands narrow, then widen upward as price climbs along the upper band.
faq:
  - q: Should I sell when price touches the upper Bollinger Band?
    a: Not automatically. In a sideways market it can be a pullback candidate, but in a strong uptrend price often rides the upper band in what is called a band walk.
  - q: What does a Bollinger Band squeeze mean?
    a: The bands have narrowed sharply, so volatility is compressed. It suggests a big move may be coming soon, but it doesn't say in which direction.
  - q: What settings should I use?
    a: (20, 2) is the standard on daily charts. Shortening it on short-term charts, for example (10, 2), makes it more sensitive but adds noise signals.
---

## How it's calculated

Bollinger Bands have three lines.

- Middle band: 20-bar simple moving average
- Upper band: middle band + 2 standard deviations
- Lower band: middle band - 2 standard deviations

Standard deviation is how widely prices are scattered around the average. When volatility grows, the bands widen, and when it calms, they narrow. So the indicator shows price position and volatility at once. The number that expresses where price sits inside the bands is [%B](/guide/indicators/bollinger-percent-b).

## What it tells you

When price touches or breaks above the upper band, it is statistically high compared with the recent run. In a sideways market that is an overbought candidate, but in a strong uptrend a band walk can form, with price climbing along the upper band. The lower band works the same way: in a downtrend, price can keep sliding along it. A band touch has to be read in context; by itself it is not an entry or exit signal.

- Squeeze: the band width has narrowed sharply. A big move is close, but the direction isn't set. Judge direction separately with [MACD](/guide/indicators/macd), ADX, or price structure such as rising lows.
- Middle band break: a close that crosses the middle band from below is read as an early sign of upward momentum. The reverse is a sign of downward momentum.
- Band walk: closes staying near the upper band for 3 or more bars point to a strong uptrend. Trades that bet on a pullback to the middle band don't fit here. Three or more bars at the lower band point to a strong downtrend.
- Pullbacks in a sideways market: look for a pullback toward the middle band from the upper band, and a bounce from the lower band. It is more reliable when [RSI](/guide/indicators/rsi) agrees by being above 70 or below 30.

## How Siglens detects it

Siglens calculates the bands with the (20, 2) setting and flags these situations as signals.

- Lower-band bounce: the previous bar's low touched or went below the lower band, and this bar closes higher than the previous close.
- Upper-band breakout: the close finishes above the upper band. It is classified as an overbought signal, but in a trending market it is read as continuation, as described below.
- Squeeze: band width is within the narrowest 10% of the last 120 bars. If the close is above the middle of the bands (%B 0.5) and the 20-bar EMA is not falling, it counts as a squeeze leaning up. If the close is below the middle and the EMA is not rising, it leans down.

When price sits right at a band edge (%B of 0.98 or above, or 0.02 or below, on daily bars), that position is interpreted separately. Even for the same upper-band touch, Siglens first sorts out the market regime. If ADX is above 25 and MACD also points to a trend, the touch is read as trend continuation rather than a reversal. In a market with weak direction, it is treated as a pullback candidate.

If the lower-band bounce overlaps with the price where the most trading took place (the POC) in the [volume profile](/guide/indicators/volume-profile), the support is judged to be stronger.

## Watch out for

- An upper-band touch is not an automatic sell signal. Trend trades often start at exactly that spot.
- A squeeze only warns that volatility will grow. It doesn't set direction. Get a sense of direction first with a trend filter.
- (20, 2) is tuned for daily bars. Shortening the period makes it more sensitive and adds noise signals along with it.
