---
title: Buy/Sell Volume
aliases: [Buy/Sell Volume, buy and sell volume split, buy ratio]
summary: Splits a bar's volume into buy and sell shares by close position, showing who had the edge in that bar.
seoTitle: "Buy/Sell Volume Indicator: How to Read It"
seoDescription: How a bar's volume is split into buy and sell parts by close position, the 60% and 40% buy-ratio levels, how to use it to confirm breakouts, and its limits.
demoCaption: Synthetic, illustrative bars. The buy share grows on bars that close near the high, and the sell share grows on bars that close near the low.
faq:
  - q: Is buy volume the number of actual buy orders?
    a: No. It is an estimate that splits volume in proportion, treating buyers as stronger the closer the close is to the high. It doesn't tell individual trades apart.
  - q: What buy ratio counts as buyers dominating?
    a: Above 60% the bar is read as buy-dominant, below 40% as sell-dominant, and in between as balanced.
  - q: Does it work well on gap days?
    a: Not well. If a bar ends near its low after a gap up, the sell ratio can come out high even though the move is up.
---

## How it's calculated

Each bar's volume is split by where the close sits between the high and the low. This is the same method as TradingView's "BS" indicator.

- Buy volume = volume × (close - low) ÷ (high - low)
- Sell volume = volume × (high - close) ÷ (high - low)
- A bar with no range, where the high equals the low, has 0 for both.

If the close is near the high, buyers are assumed to have led the bar, and if it is near the low, sellers. The split is a proportion rather than a hard cut into two halves, so you can see differences in strength within a bar as a continuous value.

## What it tells you

- Buy volume much larger: buyers led that bar.
- Sell volume much larger: sellers led that bar.
- About equal: the bar couldn't pick a direction, so watch the next bar.

As a buy ratio (buy ÷ total), above 60% is buy-dominant, below 40% is sell-dominant, and in between is balanced. If the buy ratio rises when summed over several bars, buying is building up.

It's most useful alongside a breakout. If the bar that breaks resistance has a high buy ratio, the breakout carries buyers' conviction. A high sell ratio makes the breakout doubtful. If price makes lower lows while the lows in the buy ratio rise, that is sometimes read as selling pressure easing.

## How Siglens detects it

Siglens calculates buy and sell volume for each bar with the formulas above. If the last bar's buy ratio is heavily one-sided, at 65% or more or 35% or less, that bar is singled out for interpretation. The trend in recent bars' buy ratio is used to judge whether buying or selling is accumulating. It isn't used as a signal that sets direction. It is used to check whether price movement is backed by volume.

When overlapped with other indicators, it is read like this.

- [OBV](/guide/indicators/obv) rising and buy ratio also high: an accumulation flow is clear.
- [CMF](/guide/indicators/cmf) positive and buy ratio rising: buying pressure is continuing.
- [RSI](/guide/indicators/rsi) oversold and a high buy ratio on the same bar: selling has run dry and buyers absorbed the supply.

## Watch out for

- When a bar's range is narrow, the buy and sell values come out small even if volume is large. Look at them together with the total volume.
- Gaps aren't reflected. The market open and gap days are the most common source of false signals.
- On bars with low volume, the split has little meaning. Give more weight to signals on high-volume bars.
- It is an estimate from close position. You can't tell who actually placed orders first, and it isn't a method independently validated in academic research. Treat it only as a rough read on which side had the edge.
