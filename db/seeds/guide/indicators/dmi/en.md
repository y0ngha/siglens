---
title: DMI
aliases: [Directional Movement Index, +DI -DI, directional movement, DMI indicator]
summary: Compares buying force (+DI) and selling force (-DI) to show the direction and dominance of a trend.
seoTitle: "DMI Indicator: How to Read +DI and -DI Crosses"
seoDescription: What +DI and -DI in the DMI are, how to filter their crossovers with an ADX of 20, and why ranging markets throw off so many small signals.
demoCaption: Synthetic, illustrative bars. The advance continues, +DI crosses above -DI, and ADX rises along with it.
faq:
  - q: Does +DI crossing above -DI mean a turn to an uptrend?
    a: It's an early sign that the upside has taken the lead. It is more reliable when ADX is above 20, and crossovers while ADX is low produce many small false signals.
  - q: Are DMI and ADX the same thing?
    a: They are a pair that come from the same calculation. +DI and -DI show direction and ADX shows the strength of that trend, so you need to read them together.
  - q: How far apart do the two lines need to be to matter?
    a: Within 3 to 5 points of each other, the market is balanced and the direction signal is weak. The wider the gap, the clearer the pressure on one side.
---

## How it's calculated

DMI (Directional Movement Index) was created by J. Welles Wilder in 1978 and reads direction with two lines. +DI is the force that moved up and -DI is the force that moved down. For each bar it measures how much the high rose above the previous bar and how much the low fell below it, averages that over 14 bars, and divides by the average range over the same period (the same ingredient as [ATR](/guide/indicators/atr)) to turn it into a percentage.

[ADX](/guide/indicators/adx) is the average of how far apart the two lines are. It shows how strong the trend is on a 0 to 100 scale, whatever its direction. DMI handles direction, and ADX handles the strength of that direction.

## What it tells you

- +DI above -DI: the upside, where buying force dominates. The bigger the gap, the clearer it is.
- -DI above +DI: the downside, where selling force dominates.
- The two lines within 3 to 5 points: balanced, so the direction signal is weak.

Crossovers are read like this.

- +DI crosses above -DI: an early sign of a turn to the upside. Trust goes up a lot if ADX is above 20 then.
- -DI crosses above +DI: an early sign of a turn to the downside. Likewise, confirm it with ADX above 20.
- Be careful with crossovers when ADX is below 20, because many are false.

Combining with ADX makes it more accurate. +DI dominant with ADX rising above 25 means an uptrend is forming and strengthening, and with -DI dominant, a downtrend is strengthening. If ADX peaks and comes down while the two lines are still far apart, the trend is running out of force.

## How Siglens detects it

Siglens looks at whether +DI and -DI have just crossed, and whether the trend had real force behind it at that moment. A cross during a forceless sideways stretch doesn't count.

- Crossover signal: in DMI(14), +DI crossing above -DI within the last 3 bars is an upside signal, and -DI crossing above +DI is a downside signal.
- It counts only when ADX on the crossover bar is at least 20. Below 20, the cross is treated as one inside a trendless sideways market and skipped.
- Even without a crossover, Siglens checks which of +DI and -DI is currently higher, and whether ADX is at least 25 (trending) or below 20 (weak).

The combinations it looks at are these.

- A [MACD](/guide/indicators/macd) crossover in the same direction as the dominant DI: read as several pieces of evidence lining up on one side.
- +DI dominant and price above the 60-bar EMA, a mid-term moving average: momentum (the force behind price moves) and trend structure point the same way.

## Watch out for

- Crossovers lag. They confirm a trend after it has started and don't warn you ahead of time.
- In a sideways market the two lines cross often, so the signals are hard to trust.
- ADX doesn't say direction, so you need to look at +DI and -DI together to know which way the trend runs.
- Above 40, ADX means a very strong trend, but the risk that it runs out of force grows too. In the rare cases above 60, a sharp reversal or a range sometimes follows.
