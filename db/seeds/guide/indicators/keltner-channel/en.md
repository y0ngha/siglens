---
title: "Keltner Channel"
aliases: [Keltner Channel, Keltner Bands, KC, Keltner Squeeze]
summary: "ATR-based bands drawn above and below a 20-day EMA, used to read the volatility range, trend and squeezes."
seoTitle: "Keltner Channel: How to Read It and the Squeeze"
seoDescription: How the Keltner Channel is built from a 20-day EMA and ATR, how to read channel breakouts and returns, and how to spot a squeeze together with Bollinger Bands.
demoCaption: "Synthetic, illustrative bars. The marked stretch is where price closes outside the upper Keltner band."
faq:
  - q: "How is a Keltner Channel different from Bollinger Bands?"
    a: "Bollinger Bands set their width with standard deviation; the Keltner Channel uses ATR. ATR changes more gradually than standard deviation, so the channel is smoother and less shaken by sudden spikes."
  - q: "What is a squeeze?"
    a: "A squeeze is when volatility has dropped enough that the Bollinger Bands (20, 2) sit inside the Keltner Channel. A larger move may follow, but the direction is confirmed by which band price breaks out of."
  - q: "What are the default Keltner Channel settings?"
    a: "The center line is a 20-day EMA and the bands sit 2 times the 10-day ATR away. On shorter timeframes some traders use a 10-period EMA with a 1.5 multiplier."
---

## How it's calculated

Chester Keltner created the channel in the 1960s, and Linda Bradford Raschke modernized it. It has three lines.

- Center line: 20-day [exponential moving average](/guide/indicators/ema)
- Upper band: center line + 2 times the 10-day [ATR](/guide/indicators/atr)
- Lower band: center line − 2 times the 10-day ATR

ATR is the average distance a single bar moves. The bands move more smoothly than [Bollinger Bands](/guide/indicators/bollinger-bands), which set their width with standard deviation.

## What it tells you

- Breakout: a close outside the upper band means strong upward momentum beyond the usual range. In a trending market it reads as continuation; in a range it reads as a breakout attempt. Two or more consecutive closes outside the band make a false signal less likely.
- Re-entry: when price that had moved outside the band comes back inside, momentum is fading and price may drift back toward the center line. This works best when the trend is weak (ADX below 25).
- Center line: with price above it, pullbacks tend to find support there; with price below it, rallies tend to meet resistance.
- Channel width: widening means volatility is expanding, narrowing means it is contracting.
- Squeeze: when the Bollinger Bands (20, 2) move inside the channel, volatility has contracted to an extreme. When they move back outside, a breakout is considered to have started, and the direction depends on which band price crosses.

## How Siglens detects it

Siglens uses the standard settings: 20-day EMA center line, 10-day ATR, multiplier 2.0. If the previous bar closed inside the upper band and the current bar closes outside it, that is an upper breakout; the same thing on the downside is a lower breakdown. It also interprets the position separately when the current price is outside a band or within 0.5 times ATR(14) of one.

Read together with Bollinger Bands, it shows whether a squeeze is on, and the direction is checked by which way the [MACD](/guide/indicators/macd) histogram grows. With ADX above 25 and price outside the band, it reads as trend continuation; with ADX below 20 and price at the band edge, it reads as a pullback candidate.

## Watch out for

- ATR changes slowly, so the channel reacts late to sudden moves. You get fewer false signals but slower adaptation.
- A squeeze cannot be built from the Keltner Channel alone. It needs the Bollinger Bands alongside.
- In a strong trend, price can ride along outside the band for a long time (a band walk). Betting on a pullback then is risky.
- The defaults are tuned for daily charts. On shorter timeframes some traders shorten the settings.
