---
title: Gap Analysis
aliases: [gap up, gap down, breakaway gap, runaway gap, exhaustion gap, gap trading]
summary: "A way to read gaps by sorting them into four types based on position and trend context."
seoTitle: "Gap Up and Gap Down: Types and Meaning"
seoDescription: How to tell common, breakaway, runaway and exhaustion gaps apart by context, how Siglens detects gaps, and why the saying that every gap gets filled can be wrong.
demoCaption: Synthetic, illustrative candles. Shows a gap-up bar above a range, the previous bar's high, and the empty price zone between them.
faq:
  - q: Do gaps always get filled?
    a: No. Breakaway and runaway gaps often stay open for a long time, and only exhaustion gaps tend to fill quickly. Siglens does not use gap-fill rates as evidence.
  - q: How big does a gap need to be?
    a: Siglens counts only gaps of at least 0.25 times ATR(14) (the average move of the last 14 bars) as meaningful. Smaller gaps are ignored.
  - q: How do I tell the gap types apart?
    a: By position, not by the gap itself. A gap out of a range or pattern boundary is a breakaway gap, one in the middle of a trend is a runaway gap, and one with a volume surge at the end of a long advance is an exhaustion gap candidate.
---

## What it is

A gap is a price zone where no trading took place between one bar and the next. A gap up is when the next bar's low is above the previous bar's high. A gap down is when the next bar's high is below the previous bar's low.

Edwards and Magee, authors of one of the classic books on technical analysis, sorted gaps into four types based on where they came from.

- **Common gap**: a gap inside a sideways range, on ordinary volume. It carries little meaning.
- **Breakaway gap**: a gap formed as price leaves a range, a base or a chart pattern boundary. The more clearly volume is above average, the more it is read as the start of a new move. It is the most meaningful of the four.
- **Runaway gap**: a gap in the trend direction in the middle of an established trend. The typical setting is a rising [ADX](/guide/indicators/adx), which measures trend strength, with moving averages lined up in the trend's direction. It is read as a sign that the trend is accelerating.
- **Exhaustion gap**: a gap with a sudden volume surge at the end of a long run. It is confirmed only if price then reverses back through the gap within a few bars. So on the bar where the gap appears, it can only be called a possibility.

## What it tells you

A gap of the same size means different things depending on where it came from. So the gap alone is not enough. The type is set from position, trend and volume, and the gap then serves as supporting evidence read alongside whether a [breakout](/guide/strategies/breakout) happened and trend indicators such as ADX.

Breakaway and runaway gaps are read as the move continuing in the direction of the gap. Common gaps and possible exhaustion gaps are read as neutral, with no direction. The edge of the gap, the previous bar's high (its low for a gap down), becomes a price to watch.

## How Siglens detects it

Siglens checks whether the last bar sits completely apart from the previous bar, with no overlapping prices. The gap has to stay open through the whole bar to count.

- Gap up: the last bar's low must be above the previous bar's high.
- Gap down: the last bar's high must be below the previous bar's low.
- The gap size must be at least 0.25 times [ATR](/guide/indicators/atr)(14) (the average move of the last 14 bars). Smaller gaps are ignored.

When a gap is found, Siglens calculates its direction, its size and how many ATRs that size is, and uses them when deciding the type. Assets that trade 24 hours rarely gap on daily bars, and on intraday bars gaps mostly form at the open.

Siglens does not use the idea that "gaps always fill", or set targets from gap size, because there is no sourced evidence for them.

## Watch out for

- An exhaustion gap can be confirmed only after the fact.
- The "gaps get filled" idea is not enough to expect a reversal.
- A gap caused by earnings or news reflects the event more than a technical signal.
- If the first bar after the gap has only average volume, it is hard to call it a breakaway gap.
- When price gaps, your order may fill far from the price you wanted.
