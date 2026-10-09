---
title: "MACD"
aliases: [MACD, Moving Average Convergence Divergence, MACD Histogram, MACD Crossover]
summary: "Compares the gap between the 12- and 26-day EMAs with its 9-day average to read trend and momentum shifts."
seoTitle: "How to Read MACD: Crossovers and Histogram"
seoDescription: "How to read MACD and signal line crossovers, the histogram, zero-line crosses and divergence, and why choppy markets produce false signals."
demoCaption: "Synthetic, illustrative bars. The marked stretch is where the MACD line crosses above the signal line and the histogram grows."
faq:
  - q: "What do the default MACD settings 12, 26, 9 mean?"
    a: "The 12-day EMA minus the 26-day EMA is the MACD line, and the 9-day EMA of that value is the signal line. This is the standard setting tuned for daily charts."
  - q: "What is a MACD golden cross?"
    a: "It is when the MACD line crosses above the signal line. It means short-term momentum has strengthened, and it is often given more weight when it happens below the zero line. A cross from above to below is a death cross."
  - q: "What does the histogram show?"
    a: "It plots the gap between the MACD line and the signal line as bars. Growing bars mean momentum in that direction is strengthening; shrinking bars mean it is fading."
---

## How it's calculated

Gerald Appel created it in the late 1970s. It uses the difference between a short-period and a long-period [exponential moving average](/guide/indicators/ema) as momentum. Thomas Aspray added the histogram in 1986. The standard setting is 12, 26, 9, and it has three parts.

- MACD line: 12-day EMA − 26-day EMA
- Signal line: 9-day EMA of the MACD line
- Histogram: MACD line − signal line

## What it tells you

- Signal line cross: the MACD line crossing above the signal line means short-term momentum has strengthened (golden cross); crossing below means it has weakened (death cross). A golden cross rising from below the zero line, or a death cross falling from above it, is often given more weight.
- Histogram: growing positive bars mean upward momentum is building, and bars shrinking from a peak mean it is fading. The same applies on the negative side. The peaks and troughs of the bars sometimes show up before the actual turn in price.
- Zero line: when the MACD line crosses above 0, the short EMA has moved above the long EMA, which is read as a sign of a medium-term trend change.
- Divergence: if price makes higher highs while MACD makes lower highs, momentum is weakening; if price makes lower lows while MACD makes higher lows, selling pressure is easing. Along with [RSI](/guide/indicators/rsi), it is regarded as a major reversal signal.

## How Siglens detects it

Siglens calculates it with the 12, 26, 9 settings and flags four situations as signals.

- Golden cross and death cross: the MACD line crossed the signal line from below or from above within the last 3 bars.
- Histogram convergence: if the last 5 histogram bars are all negative and shrink bar after bar, it is a bullish signal that selling pressure is fading; if they are all positive and shrink bar after bar, it is a bearish signal that buying pressure is fading. It is an early warning before a cross appears.

A cross is trusted more when [ADX](/guide/indicators/adx) is above 25 and given less weight when it is below 20. It is also read together with a trend filter: above the 20-day or 60-day EMA, bullish signals count for more; below it, bearish signals do.

## Watch out for

- MACD is a lagging indicator by nature. It does not suit pinpointing exact entries in a fast market.
- In a ranging market, signal line crosses are frequent and mostly noise. Check the market's character first with ADX or Bollinger Band width.
- 12, 26, 9 is tuned for daily charts. On short timeframes like 1-minute or 5-minute, some traders use shorter settings such as 6, 12, 5.
