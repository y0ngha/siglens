---
title: How to Read Candlestick Charts
aliases: [Candlestick Chart, Candlesticks, OHLC, Bullish and Bearish Candles, Candle Body and Wick]
summary: One candle holds the open, high, low and close for a set period. Here is what the body and wicks mean.
seoTitle: "How to Read Candlestick Charts: Body and Wicks"
seoDescription: A step-by-step guide to bullish and bearish candles, what the body and wicks mean, and how the same shape reads differently on daily and intraday charts.
demoCaption: Synthetic, illustrative bars made for this explanation. The open, close, high and low are marked on a bullish and a bearish candle.
faq:
  - q: How do I tell a bullish candle from a bearish one?
    a: If the close is above the open, it is bullish; if below, bearish. Korean stock charts usually draw bullish candles red and bearish ones blue, while US charts often use green and red.
  - q: What does a long wick mean?
    a: Price moved a long way in that direction during the period, then came back. A long upper wick means price rose and was pushed back; a long lower wick means it fell and recovered.
  - q: Are daily and intraday candles read the same way?
    a: The method is the same, but each candle covers a different span of time. The shorter the period, the more random movement it holds, so the same shape carries less weight.
---

## What one candle holds

A single candle shows four prices for a set period at once: the open (first trade), the high (highest price), the low (lowest price) and the close (last price).

If the close is above the open, the candle is bullish; if below, bearish. The color shows at a glance whether buyers or sellers won that period. Korean stock charts usually draw bullish candles red and bearish ones blue.

## Body and wicks

The thick part between the open and close is the body. The thin lines above and below it are the wicks (shadows). The tip of the upper wick marks the high, and the tip of the lower wick marks the low.

- A long body means one side pushed the whole period.
- A short body means the open and close were near each other and the two sides were evenly matched.
- A long wick is a trace of price reaching that level and being pushed back.

## Reading several in a row

The same shape means different things depending on where it appears. A long lower wick at the end of a long decline and one in the middle of a sideways range are not the same signal. So look at the preceding trend and nearby support and resistance too.

One candle is only a clue. Many traders check whether the next candle's close, volume or other indicators point the same way.

The period each candle covers matters as well, whether daily, weekly or intraday. The shorter the period, the more random movement is mixed in, so the same pattern is less reliable.

## How Siglens uses candlestick patterns

Siglens looks for candlestick patterns within the latest 15 bars using fixed rules. Multi-bar patterns are matched longest first: five-bar patterns, then four, three and two. Bars already used in a multi-bar pattern are not counted again as single-bar patterns. Ordinary bullish or bearish bars and the very common spinning top are not listed as patterns.

Body size is judged as a ratio of the high-to-low range. For example, a body at most 10% of that range is a [doji](/guide/candlesticks/doji), at least 90% is a [marubozu](/guide/candlesticks/marubozu), and at least 60% is the "long body" used in multi-bar patterns.

Detected patterns fall into three groups.

- Reversal: hints that the prior trend may turn, such as hammers, engulfing patterns and morning stars
- Continuation: hints that the trend may carry on, such as marubozu and the three methods
- Wait-and-see: a state with no direction and evenly matched forces, such as a doji

For most patterns Siglens checks bar shape only, not the preceding trend. So don't rely on the pattern name; also check on the chart what came before. For a few patterns the name and the actual measured direction are opposite, and Siglens follows the measured direction. The [three-line strike](/guide/candlesticks/three-line-strike) is the main example.

## Watch out for

Patterns in a sideways range are mostly noise. Thinly traded stocks and very short timeframes also distort shapes easily. A pattern name is a starting point for interpretation, and conclusions come after a confirming signal.
