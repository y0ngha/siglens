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

What follows is the traditional reading Elder set out. Siglens uses it as reference context, not as a standalone signal.

Usually Bull Power is above 0 and Bear Power is below 0. So the signal is not whether a value is positive or negative, but how it moves from that usual position.

Elder saw an uptrend in which Bear Power rises back up from negative territory as the strongest bullish signal. He read it as sellers losing strength. In a downtrend, Bull Power that is positive and falling is read as selling pressure coming in during a bounce.

The reading regarded as most reliable is the divergence (price and the indicator moving in different directions): price making lower lows while Bear Power makes higher lows (bullish), or price making higher highs while Bull Power makes lower highs (bearish).

## How Siglens detects it

Siglens looks not at the sign of the values but at whether, on the last bar, they turned compared with the previous bar. Both values are calculated with a 13-bar exponential moving average.

- Bear Power negative but higher than the previous bar: read as sellers weakening.
- Bull Power positive but lower than the previous bar: read as selling pressure coming in during a bounce.
- Whether the shape matters is judged together with the slope of the 13-bar exponential moving average, that is, the trend direction.

When Siglens checked later returns from this signal alone, there was no clear difference. So the indicator is used only as a reference, and it gets more weight when a higher-timeframe trend and a divergence coincide.

## Watch out for

- If you judge only by crossing the zero line, false signals are frequent in a sideways market.
- Because the baseline is the 13-day exponential moving average, the two values can be temporarily distorted when the average suddenly changes direction. It's better to check the trend separately with another tool.
- Checking whether another indicator such as [MACD](/guide/indicators/macd) shows a divergence too gives firmer grounds than looking at one indicator alone.
