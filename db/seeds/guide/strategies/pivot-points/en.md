---
title: Pivot Points
aliases: [pivot point levels, pivot support and resistance, floor pivots, pivot point calculator, Pivot Points]
summary: "A day-trading tool that sets today's candidate support and resistance from yesterday's high, low and close."
seoTitle: "Pivot Points: Calculation and Support/Resistance"
seoDescription: What the pivot point PP, R1 to R3 and S1 to S3 mean, and how the Classic, Fibonacci, Woodie, Camarilla and DeMark methods differ.
demoCaption: Synthetic, illustrative candles. Shows the pivot line (PP) calculated from the high, low and close of the prior day's bars, shaded on the chart, with resistance R1 above and support S1 below.
faq:
  - q: How are pivot points calculated?
    a: In the classic method, the pivot (PP) is the prior day's high, low and close added together and divided by 3. R1 is twice PP minus the low, and S1 is twice PP minus the high. Siglens calculates and shows these values.
  - q: Can I use them on daily charts?
    a: You can, but only as a secondary reference. On a daily chart the "prior trading day" is just the previous bar, so they carry much less meaning than swing structure or moving averages.
  - q: There are several pivot methods. Which do I look at?
    a: Siglens looks at the classic and Fibonacci pivots first, and treats Camarilla (for short-term trading), Woodie (weighted toward the close) and DeMark as secondary.
---

## What it is

From the prior trading day's high (H), low (L) and close (C), you calculate one reference line for today (PP) and candidate resistance (R1 to R3) and support (S1 to S3) lines above and below it. It was originally used by floor traders, and day traders still watch it closely.

PP is the day's balance line. When price opens above PP, the mood is read as bullish, and below it, bearish.

| Method | Feature |
|---|---|
| Classic | PP = (H+L+C)/3, the most basic |
| Fibonacci pivot | Adds or subtracts 0.382, 0.618 and 1.0 times the prior day's range from the classic PP |
| Woodie | Gives the close double weight |
| Camarilla | Levels sit tightly around the close, for short-term trading |
| DeMark | The calculation changes depending on the relationship between the open and the close |

## What it tells you

They work as a map of price zones where price may react that day.

- Many traders read a bounce with rising volume at S1 as support, and a stall with a bearish candle at R1 as resistance.
- A close beyond R1 or S1 with volume is read as the direction continuing.
- The zone between R1 and S1 is where the day's most active movement happens.
- The first touch matters most, and the more times the same line is touched, the weaker it gets.
- A line that overlaps a moving average, the [Bollinger Bands](/guide/indicators/bollinger-bands) or a [Fibonacci](/guide/strategies/fibonacci) line is treated as stronger.
- If the day opens with a gap, the prior-day reference lines lose some of their meaning.

## How Siglens detects it

Siglens calculates the pivot values for all five methods. The "prior trading day" it bases them on depends on the timeframe. On daily bars it uses the one previous bar. On minute and hourly bars it gathers all bars from the prior trading day and builds that day's high, low and close. Using a single previous bar would put the pivots almost on top of the current price.

- It first checks the chart timeframe. On minute and hourly charts it mentions pivots as a main reference for support and resistance. On daily and above, it mentions them only as a secondary reference behind swing structure and moving averages.
- It prioritizes the classic and Fibonacci pivots, and treats Camarilla (only R3, R4, S3 and S4 are calculated), Woodie and DeMark as secondary.
- It tells you whether the current price is above or below PP, and which pivots are nearest above and below.
- It points out separately where pivots overlap a moving average, the Bollinger Bands or a Fibonacci line.

## Watch out for

- On daily and larger timeframes the meaning shrinks a lot, because the lines come from a single previous bar.
- When the day opens with a gap far from the prior day, the lines may not fit.
- Different methods draw different lines, so many lines can appear in one price zone.
- Reactions weaken when the same line is touched repeatedly.
- A pivot alone is weak evidence, so many traders look at volume and candle shape too.
