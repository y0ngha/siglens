---
title: ADX
aliases: [Average Directional Index, ADX indicator, trend strength indicator]
summary: Shows how strong the current trend is on a 0 to 100 scale, without saying whether it points up or down.
seoTitle: "ADX Indicator: How to Read the 25 Level"
seoDescription: How to read ADX levels like 20, 25 and 40, why ADX alone tells you nothing about direction, and how to read it alongside DMI.
demoCaption: Synthetic, illustrative bars. They show ADX rising as price moves sideways and then runs in one direction.
faq:
  - q: Does ADX above 25 mean price is going up?
    a: No. ADX measures only the strength of a trend, regardless of direction. A downtrend above 25 reads just as high, so check +DI and -DI separately for direction.
  - q: What ADX level counts as a sideways market?
    a: Below 20 is usually read as a range with no clear trend. The 20 to 25 zone is often read as a trend just starting to form.
  - q: Does a falling ADX mean the trend is over?
    a: Not necessarily. It means the trend is losing strength, not that its direction has changed. It can signal that price is drifting into a range.
---

## How it's calculated

ADX (Average Directional Index) was introduced by J. Welles Wilder in 1978 together with [DMI](/guide/indicators/dmi). DMI measures upward force (+DI) and downward force (-DI) separately. ADX takes the gap between the two as a share of their sum and averages it. The more one side outweighs the other, the higher the number. It moves between 0 and 100, and the default period is 14 bars.

The averaging uses Wilder smoothing (each new value gets a weight of 1/N). That reacts more slowly than a regular [EMA](/guide/indicators/ema), so a trend only shows up in the number several bars after it starts.

## What it tells you

ADX measures force with no direction. A strong uptrend and a strong downtrend both push it up.

- 0 to 20: sideways, no clear trend
- 20 to 25: a trend is just starting to form
- 25 to 40: a clear trend is under way
- 40 to 60: a strong, established trend
- Above 60: a very strong trend. It can overheat and then reverse sharply or slip into a range

Look at the slope as well as the level. A rising ADX means the trend is strengthening. An ADX coming down from a peak means the force is fading even if direction hasn't changed. Flattening near 20 to 25 can mean the market is turning sideways. If price keeps moving the same way but the second ADX peak is lower than the first, read it as an early warning that the trend is cooling.

## How Siglens detects it

Siglens calculates ADX(14) together with DMI. ADX at or above 25 is classified as a trending market and below 20 as a weak-trend market. The 20 to 25 zone is not called either way. The 40 and 60 zones and the slope give a sense of how strong the trend is and whether force is building or fading.

ADX is never used alone to set direction. Siglens always reads it with which of +DI and -DI is higher. A DMI crossover between +DI and -DI also counts as a signal only when ADX on the crossover bar is at least 20.

When combined with other indicators, it is read like this.

- ADX above 25 with price above a mid-term moving average such as the 50-bar EMA: the uptrend is confirmed by both momentum and the moving average.
- ADX above 25 with RSI overbought: in a trending market this is read as trend continuation rather than a reversal.
- ADX below 20: [MACD](/guide/indicators/macd) crossovers produce many small false signals, so they get less trust.

## Watch out for

- A high ADX alone doesn't tell you whether the trend is up or down.
- By construction it rises only after a trend has started. It describes what state the market is in now, not when to enter.
- Readings above 60 are rare, and a sharp reversal or a range sometimes follows.
- Below 20, ADX is often used as a filter to drop trend-following signals. It helps cut the frequent false signals of sideways markets.
