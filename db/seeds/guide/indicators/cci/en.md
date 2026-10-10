---
title: CCI
aliases: [Commodity Channel Index, CCI indicator]
summary: Shows how far price has strayed from its average, using +100 and -100 as reference lines. It has no upper or lower limit.
seoTitle: "CCI Indicator: How to Read +100 and -100"
seoDescription: How to read CCI crossing +100, -100 and the zero line, and why you shouldn't take its overbought signals at face value in a trending market.
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

CCI (Commodity Channel Index) was introduced by Donald Lambert in 1980. First, find the typical price ((high + low + close) ÷ 3), and see how far it has strayed from its 20-bar simple moving average. CCI expresses that difference as a multiple of how far price usually strays from the average (the mean absolute deviation). In the calculation, the difference is divided by that usual distance times 0.015; the 0.015 is a constant chosen so that most values fall within ±100. The standard period is 20 bars.

Unlike RSI or the stochastic, its values have no fixed range. When price moves a lot, it goes past ±100 and can exceed ±200.

## What it tells you

- CCI above +100 means price is well above its average. It can be overbought (up a lot in a short time, so a pullback may come) or the start of a strong trend.
- Below -100 means price is well below its average. It can be oversold (the reverse: down a lot) or a strong downtrend.
- Crossing -100 from below is read as downward force (momentum) weakening and price moving back toward the average.
- Crossing +100 from above is read as upward force cooling.
- Crossing above the zero line is read as an early sign that the force is turning up; crossing below it, the reverse.

Staying above +100 for several bars is read as a strong uptrend. A pullback (a brief dip) to around +100 within that stretch is read as a correction inside the trend, not a sell signal. If price makes higher highs while CCI makes lower highs, that is a divergence (price and indicator moving in different directions) showing upward strength fading. A reading above +200 is a very rare extreme. A pullback tends to follow, but when it will come can't be known.

## How SIGLENS detects it

SIGLENS checks whether CCI has just crossed a reference line. It calculates CCI(20) and flags only crossings within the last 3 bars as signals.

- Upward side: CCI crosses -100 from below (leaving oversold), or crosses +100 from below (upward momentum).
- Downward side: CCI comes down through +100 from above (leaving overbought), or comes down through the zero line from above (downward momentum).

For the downward side, it watches for the moment CCI comes down through the zero line, not the moment it drops below -100. Dropping below the zero line means the typical price has fallen below its average. Not mirroring the +100 level used on the upward side is a deliberate choice. A crossing is not used on its own as a trading signal. Since this indicator has no upper or lower limit, the trend context comes first.

It gives a signal more weight when other indicators line up like this.

- Price near the upper Bollinger Band with CCI above +100 means overbought readings coincide. Near the lower band with CCI below -100, oversold readings coincide. See [Bollinger Bands](/guide/indicators/bollinger-bands).
- A CCI zero-line cross and a [MACD](/guide/indicators/macd) crossover in the same direction amount to an early confirmation of a trend change.
- Volume piling up at an extreme CCI value may mark a spot where a reversal comes.

## Watch out for

- With no fixed upper or lower limit, it is hard to cut overbought and oversold mechanically.
- In a trending market, being above +100 means the trend is strong. It is not read as a sell signal without other evidence.
- Around gaps or earnings releases, values beyond ±300 are common.
- A short period is fast but gives many noise signals, and a long one is smooth but late.
