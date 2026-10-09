---
title: CCI
aliases: [Commodity Channel Index, CCI indicator]
summary: Shows how far price has strayed from its average, using +100 and -100 as reference lines. It has no upper or lower limit.
seoTitle: "CCI Indicator: How to Read +100 and -100"
seoDescription: How CCI is calculated, how to read the +100, -100 and zero-line crosses, and why an overbought reading shouldn't be taken at face value in a trending market.
demoCaption: Synthetic, illustrative bars. Price strays far from its average, CCI rises above +100, and then comes back down.
faq:
  - q: Is CCI above +100 overbought?
    a: It can be overbought, or it can be the start of a strong trend. If CCI stays above +100 for several bars, it points more to an uptrend in progress, so it isn't treated as an immediate sell signal.
  - q: How is CCI different from RSI?
    a: RSI is confined between 0 and 100, but CCI has no upper or lower limit and can reach values like +200 or -300. It shows the degree of deviation from the average as it is.
  - q: What period works best for CCI?
    a: The standard is 20. Shortening it to 10 to 14 makes it faster but adds noise signals, and lengthening it to 25 to 50 makes it smoother but later.
---

## How it's calculated

CCI (Commodity Channel Index) was introduced by Donald Lambert in 1980. First, find the typical price ((high + low + close) ÷ 3), and see how far it has strayed from its 20-bar simple moving average. Divide that difference by the mean absolute deviation (the usual size of deviation from the average) multiplied by 0.015, and you get CCI. The 0.015 is a constant chosen so that most values fall within ±100. The standard period is 20 bars.

Unlike RSI or the stochastic, its values have no fixed range. When price moves a lot, it goes past ±100 and can exceed ±200.

## What it tells you

- Above +100: well above the average. It can be overbought or the start of a strong trend.
- Below -100: well below the average. Oversold, or a strong downtrend.
- Crossing -100 from below: downward momentum is weakening and price is moving back toward the average.
- Crossing +100 from above: upward momentum is cooling.
- Crossing above the zero line: an early sign that momentum is turning up. Crossing below the zero line is the reverse.

Staying above +100 for several bars means a strong uptrend. A pullback to around +100 within that stretch is read as a correction inside the trend, not a sell signal. If price makes higher highs while CCI makes lower highs, that is a divergence showing upward strength fading. A reading above +200 is a very rare extreme, and a pullback tends to follow, but the timing can't be known.

## How Siglens detects it

Siglens calculates CCI(20) and flags a reference-line crossing within the last 3 bars as a signal.

- Upward side: CCI crosses -100 from below (leaving oversold), or crosses +100 from below (upward momentum).
- Downward side: CCI comes down through +100 from above (leaving overbought), or comes down through the zero line from above (downward momentum).

For the downward side, it watches for the moment CCI comes down through the zero line, not the moment it drops below -100. A crossing is not used on its own as a trading signal. Since this indicator has no upper or lower limit, the trend context comes first.

When overlapped with other indicators, it goes like this.

- Price near the upper Bollinger Band and CCI above +100: overbought readings coincide. Near the lower band and below -100, oversold readings coincide. See [Bollinger Bands](/guide/indicators/bollinger-bands).
- A CCI zero-line cross and a [MACD](/guide/indicators/macd) crossover in the same direction: an early confirmation of a trend change.
- Volume piling up at an extreme CCI value: it may be a spot where a reversal comes.

## Watch out for

- With no fixed upper or lower limit, it is hard to cut overbought and oversold mechanically.
- In a trending market, being above +100 means the trend is strong. Don't use it as a sell signal without other evidence.
- Around gaps or earnings releases, values beyond ±300 are common.
- A short period is fast but gives many noise signals, and a long one is smooth but late.
