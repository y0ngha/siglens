---
title: Elder-Ray
aliases: [Elder Ray, Bull Power, Bear Power, Elder-Ray Index]
summary: Measures how far the high and low sit from the 13-day EMA to track buyer and seller strength separately.
seoTitle: "Elder-Ray Index: Bull Power and Bear Power"
seoDescription: How Elder Ray's Bull Power and Bear Power are calculated, how to read the point where Bear Power starts rising, and why using it alone is risky.
demoCaption: Synthetic, illustrative bars. The 13-day EMA is drawn with Bull Power and Bear Power bars below it.
faq:
  - q: What are Elder-Ray's Bull Power and Bear Power?
    a: Bull Power is the high minus the 13-day EMA, and Bear Power is the low minus the same average. Bull Power shows how far buyers pushed above the average, and Bear Power shows how far sellers pressed below it.
  - q: Is Bull Power above 0 a bullish signal?
    a: No. It's normal for Bull Power to be above 0 and Bear Power below 0 most of the time, so watch for the moment the two change direction rather than the sign.
  - q: What is Elder-Ray used with?
    a: Its creator, Dr. Alexander Elder, said to use it inside "Triple Screen," which first checks the higher-timeframe trend. Many people also look at divergences with price, MACD and RSI.
---

## How it's calculated

Dr. Alexander Elder created this indicator and introduced it in "Trading for a Living" (1993). The name comes from the idea of looking at the buying and selling forces beneath price like an X-ray. The baseline is the 13-day [exponential moving average](/guide/indicators/ema), which Elder saw as the value market participants agree on.

- Bull Power = high - 13-day EMA
- Bear Power = low - 13-day EMA

The day's high is read as the most buyers could pull price up, and the low as the most sellers could push it down.

## What it tells you

Usually Bull Power is above 0 and Bear Power is below 0. So the signal is not whether a value is positive or negative, but how it moves from that usual position.

The best buying condition in Elder's view is an uptrend where Bear Power rises back up from negative territory. It means sellers are losing strength. In a downtrend, Bull Power that is positive and falling is read as selling pressure coming in during a bounce.

The reading known to be of the highest quality is the divergence. In an uptrend, that is price making lower lows while Bear Power makes higher lows, or price making higher highs while Bull Power makes lower highs.

## How Siglens detects it

Siglens calculates both values with a 13-bar exponential moving average and flags two shapes on the last bar. One is Bear Power that is negative but has risen from the previous bar (sellers weakening). The other is Bull Power that is positive but has fallen from the previous bar (selling pressure coming in during a bounce). It looks at the direction change compared with the previous bar, not at the sign of the value. Whether the shape matters is judged together with the slope of the 13-bar exponential moving average, that is, the trend direction.

When Siglens checked later returns from this signal alone, there was no clear difference. So the indicator is used only as a reference, and it gets more weight when a higher-timeframe trend and a divergence coincide.

## Watch out for

- If you judge only by crossing the zero line, false signals are frequent in a sideways market.
- Because the baseline is the 13-day exponential moving average, the two values can be temporarily distorted when the average suddenly changes direction. It's better to check the trend separately with another tool.
- Used alone, this indicator showed no clear effect. Check whether it overlaps with a divergence in another indicator such as [MACD](/guide/indicators/macd).
