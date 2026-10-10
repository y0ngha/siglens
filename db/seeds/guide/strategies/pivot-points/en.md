---
title: Pivot Points
aliases: [pivot point levels, pivot support and resistance, floor pivots, pivot point calculator, Pivot Points]
summary: "A day-trading tool that sets today's candidate support and resistance from yesterday's high, low and close."
seoTitle: "Pivot Points: Calculation and Support/Resistance"
seoDescription: What the pivot point PP, R1 to R3 and S1 to S3 mean, and how the Classic, Fibonacci, Woodie, Camarilla and DeMark methods differ.
demoCaption: Synthetic, illustrative candles. Shows the pivot line (PP) calculated from the high, low and close of the prior day's bars, shaded on the chart, with resistance R1 above and support S1 below.
faq:
  - q: How are pivot points calculated?
    a: In the classic method, the pivot (PP) is the prior day's high, low and close added together and divided by 3. R1 is twice PP minus the low, and S1 is twice PP minus the high. SIGLENS calculates these values and shows them.
  - q: Can I use them on daily charts?
    a: You can, but only as a secondary reference. On a daily chart the prior session is simply the previous bar, so the levels mean far less than swing structure (clearly turned highs and lows) or moving averages.
  - q: There are several pivot methods. Which do I look at?
    a: SIGLENS puts the classic and Fibonacci pivots first and treats Camarilla (for short-term trading), Woodie (weighted toward the close) and DeMark as secondary.
---

## What it is

A method that uses the prior session's high (H), low (L) and close (C) to work out, in advance, the lines today's price may react to. It began with exchange floor traders and is still widely watched by day traders.

- PP: a reference line that works like an average of the previous day's prices. If price opens above PP, the mood is read as leaning bullish; below it, bearish.
- R1, R2, R3: resistance candidates above PP. The higher the number, the farther away.
- S1, S2, S3: support candidates below PP. The higher the number, the farther away.

There are several ways to calculate them.

| Method | What it does |
|---|---|
| Classic | PP = (H+L+C)/3. The most basic. |
| Fibonacci pivot | Places lines above and below the classic PP at 0.382, 0.618 and 1 times the prior day's high-low range. |
| Woodie | Counts the close twice when computing PP, giving the close more weight. |
| Camarilla | Places lines tightly around the prior close; built for short-term trading. |
| DeMark | Uses a different formula depending on whether the prior close was above or below the prior open. |

## What it tells you

What follows is the traditional reading. SIGLENS uses pivots only as reference lines that show where price may react that day.

- A bounce off S1 on rising volume is often read as support, and a stall at R1 with a bearish candle as resistance.
- A close through R1 or S1 with volume is read as the move continuing in that direction.
- The band between R1 and S1 is where most of the day's activity happens.
- The first touch matters most; the more times price tests the same line, the weaker it gets.
- Where a pivot overlaps a moving average, [Bollinger Bands](/guide/indicators/bollinger-bands) or a [Fibonacci](/guide/strategies/fibonacci) line, it is read as a firmer level.
- A gap open makes the prior session's lines less relevant.

## How SIGLENS detects it

SIGLENS calculates the pivot values for all five methods and shows which line price is near. How the prior-session values are built depends on the chart's timeframe. On minute and hourly charts, it combines all of the previous trading day's bars into that day's high, low and close, because calculating from one short bar would put the lines right on top of the current price. On a daily chart, the previous bar already is the previous trading day, so it is used as is.

- On minute and hourly charts, pivots are a primary support and resistance reference. On daily and longer charts, they are only a secondary reference behind swing structure and moving averages.
- Classic and Fibonacci pivots come first; Woodie and DeMark are secondary.
- For Camarilla, only four lines are calculated: R3, R4, S3 and S4. R3 and S3 are the inner lines, a set fraction of the prior day's range away from the prior close; R4 and S4 are the outer lines, twice as far away.
- It states whether price is above or below PP and where the nearest pivot is above and below.
- It points out where pivots overlap moving averages, Bollinger Bands or Fibonacci lines.

## Watch out for

- On daily and longer charts they mean much less, because the lines come from a single previous bar.
- On a gap open that starts far from the prior day, the lines may not hold.
- Different methods draw different lines, so one price area can look crowded with lines.
- The reaction weakens when price keeps testing the same line.
- A pivot alone is weak evidence, so volume and candle shape are usually read alongside it.
