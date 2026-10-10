---
title: Moving Average Grand Cycle Analysis
aliases: [grand cycle analysis, moving average grand cycle, Granville's law, golden cross and death cross, Granville's rules]
summary: "Sorts the market into one of six stages by the order of the short, medium and long moving averages."
seoTitle: "Moving Average Grand Cycle: Reading the 6 Stages"
seoDescription: The six stages of the moving average cycle read from the order of the 5-, 20- and 60-day lines, the eight signals of Granville's rules, and how SIGLENS assigns the stage.
demoCaption: Synthetic, illustrative candles. Shows stage 1, with the 5-, 20- and 60-day moving averages in short, medium, long order from the top, and the points where the lines cross.
faq:
  - q: What are the six stages of the grand cycle?
    a: With the short, medium and long lines in that order from the top, it is stage 1 (stable uptrend). Medium, short, long is stage 2. Medium, long, short is stage 3. Long, medium, short is stage 4 (stable downtrend). Long, short, medium is stage 5. Short, long, medium is stage 6. Each time two lines cross, the market usually moves to the next stage.
  - q: Does a golden cross mean price will rise?
    a: If the long line is still falling, it may be a false signal. What matters most is whether the direction of the long line has changed, more than the cross itself. One study also found that the effect of simple moving average crossovers disappeared when tested on new data from after 1986.
  - q: Which moving averages does it use?
    a: SIGLENS uses simple moving averages of 5 days (short), 20 days (medium) and 60 days (long).
---

## How it looks

The market is split into six stages by the order, top to bottom, of the 5-day (short), 20-day (medium) and 60-day (long) moving averages. The stage changes when lines cross each other, and usually runs 1 to 2 to 3 to 4 to 5 to 6 and back to 1. Moving in this order is called forward progression; stepping back to an earlier stage is called reverse.

| Stage | Name | Order (top to bottom) |
|---|---|---|
| 1 | Stable uptrend | Short > Medium > Long |
| 2 | Turning down, phase 1 | Medium > Short > Long |
| 3 | Turning down, phase 2 | Medium > Long > Short |
| 4 | Stable downtrend | Long > Medium > Short |
| 5 | Turning up, phase 1 | Long > Short > Medium |
| 6 | Turning up, phase 2 | Short > Long > Medium |

Usually stages 1 and 4 are long and the others are short. If stages 1 and 4 become short while the others repeat for long, it may be a sideways market.

## What it tells you

What follows is the traditional way to read this analysis. SIGLENS uses it as context for describing what state the market is in.

You look at three things. The order shows the current situation, the gaps between lines show how likely the next stage is, and the slope helps screen out false signals.

- Order: which stage the market is in
- Gaps: widening means the trend is gaining strength, and narrowing means it is losing strength
- Slope: if the medium and long lines are still rising, a fall in the short line may be a temporary pullback (a brief dip within an uptrend)

If the medium and long lines are still rising in stage 2, the trend may not be over and this may be a pullback. The traditional reading treats a return to stage 1 after such a pullback as a sign that the rise is continuing. A temporary bounce in a downtrend is read by the same logic in reverse.

Granville's law lists four bullish and four bearish signals, based on the relationship between the short line and a base line (the medium or long line). Examples are a golden cross, a recross of a rising line, a bounce after a pullback, and a large gap from the moving average (roughly 10% or more as a reference).

## How SIGLENS detects it

SIGLENS looks at the order of the three moving averages on the last bar and sets the stage from the table above.

- It sorts the 5-, 20- and 60-day simple moving average (SMA) values by size.
- If two lines have exactly the same value, it does not set a stage. It does not use exponential moving averages (EMA). The [MACD grand cycle analysis](/guide/strategies/macd-cycle) uses EMA 9, 21 and 60, so its results differ.

What brings this analysis up is separate from the six stages: the widely used 20-day/50-day crossover. When the 20-day line crosses above the 50-day line (golden cross) or below it (death cross) within the last 3 bars, SIGLENS looks at this analysis too. It also checks:

- Whether the market arrived from the previous stage in forward order or came back in reverse
- The order, gaps and slope
- Whether a Granville signal applies
- Whether it is a sideways pattern where stages 1 and 4 are short and stages 2, 3, 5 and 6 repeat

SIGLENS does not use a crossover as grounds for when to buy or sell. A study found that the edge simple moving average crossovers once had disappeared when tested on new data from after 1986 (Sullivan, Timmermann & White, 1999).

## Watch out for

- If the long line is still falling, even a golden cross can be a false signal.
- In a sideways market the three lines tangle and keep crossing.
- Right after a sharp price move, the order may flip briefly and then return.
- Late in a trend, when the lines are far apart, the direction can change suddenly.
- The daily stage can disagree with the direction on larger timeframes such as weekly and monthly.
