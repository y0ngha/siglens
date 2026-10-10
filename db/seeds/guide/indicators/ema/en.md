---
title: Exponential Moving Average (EMA)
aliases: [EMA, Exponential Moving Average, exponential moving average line, EMA indicator]
summary: A moving average that weights recent prices more, so it follows price faster than a simple moving average.
seoTitle: "EMA Explained: Crossovers and Alignment"
seoDescription: How the exponential moving average (EMA) differs from a simple moving average, how to read the 9-, 20- and 60-day lines, and why crossovers often fool you in ranging markets.
demoCaption: Synthetic, illustrative bars. The 9-, 20- and 60-day EMAs are shown stacked in rising order.
faq:
  - q: How is EMA different from a simple moving average (MA)?
    a: A simple moving average weights every close in the window equally, while EMA gives more weight to recent closes. That makes EMA react faster to price changes, but it also gives more false signals from small wiggles.
  - q: Which EMA lengths are used most?
    a: The 9-day is common for short-term momentum, the 20- or 21-day for pullback support and resistance, and the 60-day for mid-term trend structure. Siglens also calculates the 9, 20, 21 and 60-day lines.
  - q: Can I trust EMA crossovers?
    a: When a trend is clear, they signal a change of direction. In a sideways market, crossovers happen often and are noisy. Many people filter first with a trend-strength indicator such as ADX, or with price structure.
---

## How it's calculated

An exponential moving average puts more weight on recent values. Today's EMA is a mix of today's close and yesterday's EMA in a fixed ratio. Today's close usually gets a weight of 2 ÷ (period + 1), so for a 20-day EMA that is about 9.5%. The shorter the period, the more weight today's close gets, and older prices fade in influence without ever disappearing entirely.

That is why it reacts faster to price changes than a [simple moving average](/guide/indicators/ma) of the same period. It is also less prone to the jump an average makes when an old value drops out of the window.

## What it tells you

- Support and resistance: in an uptrend, price that drops to the 20- or 21-day line and then rises again is read as pullback support (a pullback being a brief dip within a rising trend). In a downtrend, the same line acts as resistance. The 60-day line is the backbone of the mid-term trend, and when closes settle above or below it, rather than poking through and coming back, it is read as a change of phase. The 9-day line is for checking short-term momentum (the force behind price moves) rather than acting as support.
- Slope: a steep rise means the uptrend is gaining strength, and a gentle or flat slope means it is losing force.
- Crossovers: the 9-day line moving above the 20-day line means short-term momentum has strengthened, and the 20-day moving above the 60-day line is seen as a more structural turn.
- Alignment: stacked in the order 9-day > 20-day > 60-day is a bullish alignment, and the reverse is a bearish alignment. Lines tangled together mean there is no trend.

## How Siglens detects it

Siglens uses EMAs to read the direction of the trend and where price sits relative to each line. The 9, 20, 21 and 60-day EMAs always go into the analysis: it works out how many percent the current price is above or below each line, and whether the lines are in a bullish alignment, a bearish alignment or tangled. It also reads the pullback support and resistance, the slope and the crossovers described above.

The trend is judged with the 20-day EMA.

- Uptrend: the 20-day EMA is up 3% or more from 20 bars ago and the close is above it
- Downtrend: the 20-day EMA is down 3% or more from 20 bars ago and the close is below it
- Sideways: everything else

When price sits between the 20-day and 60-day lines, it's treated as a transition zone, and Siglens watches whether price leaves it in either direction and settles there. When [ADX](/guide/indicators/adx) (a gauge of trend strength) is above 25 and price is above the 60-day line, that is taken as one more piece of evidence for reading the trend direction.

## Watch out for

- EMA reflects what has already happened. It isn't suited to calling exact highs and lows.
- In a market that moves little and just goes up and down, crossovers are noise. It's better to filter first with ADX or price structure.
- Even with a long line such as the 60-day, when price moves up and down around the line, false signals that cross the line and come back are common.
