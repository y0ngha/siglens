---
title: "Parabolic SAR"
aliases: [Parabolic SAR, PSAR, Stop and Reverse, SAR]
summary: "Dots above or below price show trend direction, reversal points and a trailing stop level in one view."
seoTitle: "Parabolic SAR: How to Read the Dot Flip"
seoDescription: "How Parabolic SAR dots are placed above and below price, how to read reversal signals, and why it gets whipsawed in sideways markets."
demoCaption: "Synthetic, illustrative bars. The dots sit below the bars during the uptrend and above them after the trend turns."
faq:
  - q: "What does it mean when the Parabolic SAR dots move above price?"
    a: "When the dots switch from below price to above it, that is read as the end of the uptrend. When they switch from above to below, it means the downtrend has ended. In sideways markets these flips happen often, so they are easy to be fooled by."
  - q: "What are the default Parabolic SAR settings?"
    a: "The acceleration factor starts at 0.02, steps up by 0.02 and caps at 0.20. These are the values set by J. Welles Wilder, who created the indicator, and Siglens uses them too."
---

## How it's calculated

Parabolic SAR (Stop and Reverse) was introduced by J. Welles Wilder in 1978. It puts one dot above or below price on each bar, and that dot acts as the direction of the current trend and as a stop level.

The dot moves a little closer each bar toward the extreme point, the furthest price reached in the current trend. The acceleration factor (AF) decides how much closer. AF starts at 0.02 and rises by 0.02 each time a new extreme point is made, up to 0.20. So the longer the trend runs, the faster the dot closes in on price. When a bar's low falls below the dot in an uptrend (or its high rises above the dot in a downtrend), the trend flips and the dot jumps to the other side of price. After a flip, AF goes back to 0.02.

## What it tells you

- Dots below price mean an uptrend; dots above price mean a downtrend. The position of the dot gives the direction at once, which makes it easy to read.
- The bar where the dot moves from below price to above signals the end of the uptrend, and the bar where it moves from above to below signals the end of the downtrend.
- A widening gap between dot and price means the trend is gaining strength; a narrowing gap means it is losing steam and a turn is near.
- Using the dot value itself as a trailing stop is common. In an uptrend, for example, a close below the dot counts as a breakdown.

## How Siglens detects it

Siglens uses Wilder's standard values as they are: AF start 0.02, increment 0.02, max 0.20. A dot moving from below price to above is a bearish reversal, and from above to below is a bullish reversal, and the signal is marked when that flip happened within the last 3 bars.

In interpretation, the dot's position gives the trend direction and the gap between dot and price gives the trend's strength. A stretch where the gap is narrowing is read as a turn getting close.

Reversal signals are considered more reliable in trending markets. So Siglens gives weight to reversals that occur when [ADX](/guide/indicators/adx) is above 25, and discounts reversals in sideways stretches where ADX is below 20.

## Watch out for

- In sideways or choppy markets the dots keep flipping, and repeated losses are easy to run into. It helps to read it alongside a trend-strength indicator such as ADX.
- It follows price, so it cannot warn of a reversal in advance; it confirms one after it has started.
- The standard values are for daily charts. On shorter timeframes, people raise the AF start; on longer ones, they lower it. For volatile stocks, some check [ATR](/guide/indicators/atr) and lower the start to 0.01 to reduce false reversals.
- The first few bars after a reversal are the riskiest. AF is back at 0.02 and the dot is close to price, so even a small pullback can flip it again. One approach is to check whether the new trend holds for 2–3 bars and whether volume or momentum supports it.
- If a bar opens with a gap, the dot can flip right away even though the trend is unchanged.
