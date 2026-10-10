---
title: Rising Wedge
aliases: [Ascending Wedge, Rising Wedge Pattern]
summary: Highs and lows both rise, but the range narrows. A break below the lower line is read as a reversal down.
seoTitle: "Rising Wedge Pattern: Meaning and Reliability"
seoDescription: Why a rising wedge at the end of an uptrend is read as a bearish signal, how to confirm a break below its lower line, and where false signals come from.
demoCaption: Synthetic, illustrative bars. Shows two rising, converging trendlines and a bar closing below the lower line.
faq:
  - q: Why is a rising wedge a bearish signal?
    a: Price keeps rising, but highs rise by less than lows do, so upward momentum fades as price climbs. That is why a break of the lower line is read as a reversal down.
  - q: How do I tell a rising wedge from an ascending channel?
    a: In a rising wedge the two lines converge; in an ascending channel they run nearly parallel. Siglens treats a width ratio of 0.85 to 1.15 as a channel.
  - q: How reliable is a rising wedge?
    a: Not very. In Thomas Bulkowski's tabulation, only 32% of rising wedges that broke downward reached their target.
---

## How it looks

Highs and lows both rise, and the upper and lower trendlines converge toward a single point. Both slope upward, but the lower line is steeper, so the range narrows into a wedge.

## What it tells you

Price is rising, but the range of movement shrinks as it climbs. That signals fading upward momentum, so a close below the lower line is read as a turn down. For this reason it is known as a reversal pattern at the end of an uptrend.

Its track record is poor, though. In the tabulation of Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in his books, 60% broke downward. Yet in the performance ranking, which orders patterns by how far price went after the breakout, its downside breaks came last among 36 bearish patterns. Shrinking volume during the narrowing and rising volume as the lower line breaks give the signal more weight.

## How it differs from a falling wedge

The two wedges are mirror images in shape, but their records differ a lot. In Bulkowski's tabulation, rising wedges that broke downward had a break-even failure rate (the share that did not travel far enough after the breakout) of 51%, and only 32% reached their target. A target is the price reached if the move extends by the pattern's height: a reference value drawn from past cases, not a promise. [Falling wedges](/guide/chart-patterns/descending-wedge) that broke upward had a 26% failure rate and a 62% target rate. Direction is also less lopsided: 68% of falling wedges went up, while only 60% of rising wedges went down.

So a rising wedge is better read as a warning that the advance is tiring than as a sure sell signal. A rising wedge that forms during strong news, such as an earnings season or a sector rotation (money moving from one industry group to another), can break upward instead. A bearish divergence (price and indicator moving apart), where price keeps rising inside the wedge while the peaks of [RSI](/guide/indicators/rsi) or [MACD](/guide/indicators/macd) get lower, adds weight to the downside. A break within the first two-thirds of the distance from the wedge's start to its apex is considered to carry more force.

## How Siglens detects it

Siglens connects clearly turning highs and lows (swings: turning points where price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average range of recent bars) to draw the upper and lower boundaries. When both lines rise and gradually converge, it treats the shape as a rising wedge.

- Both lines must rise at least 1.5 times ATR over the pattern.
- Swings must touch each line at least 3 times. A swing within 0.35 times ATR of a line counts as a touch.
- No bar may poke out past a line by more than 0.25 times ATR.
- The final width must be 0.7 times the starting width or less. If the lines stay parallel at 0.85 to 1.15 times, it is a channel rather than a wedge; anything in between (0.7 to 0.85) is not shown as either.
- It must last at least 15 bars.
- The width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Following the textbook, the direction is set downward for the calculation. The measured target is the lower line minus the starting width (the pattern's height), and the conservative target subtracts half the height. The invalidation level, the price at which the pattern is considered broken, is the last swing high that touched the upper line. A close above it means the bearish pattern has failed.

If the close breaks below the lower line by more than 0.25 times ATR and the last close then returns inside the wedge, Siglens marks it as a "failed breakout".

## Watch out for

- With fewer than 3 touches, it is hard to call it a wedge.
- A break near the apex leaves little width to project, so the move tends to be weak.
- If volume does not shrink during the narrowing, it is considered less reliable.
- If the two lines are nearly parallel, it may be an [ascending channel](/guide/chart-patterns/ascending-channel) rather than a wedge.
- Trendlines vary a little from person to person, so interpretations by eye can differ.
