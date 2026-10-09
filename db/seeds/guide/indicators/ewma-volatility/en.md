---
title: EWMA Volatility
aliases: [Exponentially Weighted Moving Average volatility, RiskMetrics volatility, EWMA Volatility]
summary: A risk measure that weights recent returns more to track current volatility quickly. It gives no direction.
seoTitle: "EWMA Volatility: Meaning and Lambda 0.94"
seoDescription: What EWMA volatility is, what a lambda of 0.94 means, how to use it as a risk measure that carries no direction, and where it falls short.
demoCaption: Synthetic, illustrative bars. EWMA volatility jumps right after a large down bar and then slowly comes back down.
faq:
  - q: Does high EWMA volatility mean the price will fall?
    a: No. Volatility only says how widely price swings up and down, not which way. A high reading doesn't mean a fall or a rise.
  - q: What is lambda 0.94?
    a: It sets how much of yesterday's volatility estimate is kept and how much of today's return is counted. Using 0.94 for daily data is the RiskMetrics convention.
  - q: How is it different from ATR?
    a: ATR measures the range of movement from the price range of each bar. EWMA volatility weights the squared close-to-close returns. Both measure the size of risk, but the inputs to the calculation differ.
---

## How it's calculated

This is the volatility estimation method used in the RiskMetrics technical document (1996) from J.P. Morgan and Reuters. It is widely used in Value at Risk (VaR) calculations, which estimate how large a loss could be over a given period.

The variance, which is the square of volatility, is computed recursively like this.

new variance = λ × yesterday's variance + (1 − λ) × today's return squared

For daily data λ (lambda) is 0.94, and with that it takes about 11 days for one day's return to lose half its influence. For monthly data, 0.97 is used. It uses only past returns, so no future information leaks in. The square root of the variance is the volatility.

Compared with a simple average of squared returns, it reacts faster to a big shock, and the shock's effect fades gradually. A simple average has the problem that the estimate suddenly drops on the day a big return leaves the calculation window.

## What it tells you

EWMA volatility is a measurement with no direction. A high value doesn't mean a rise or a fall.

- Use it as a ruler for the size of current risk. Typical uses are sizing positions and calculating VaR.
- Whether it is rising or falling tells you whether the market is calm now or has just taken a shock.
- When another directional signal appears, it shows how volatile the backdrop to that signal is.

## How Siglens detects it

Siglens calculates EWMA volatility with a lambda of 0.94. When the latest value grows to 1.5 times the recent 20-bar average or more, or shrinks to half or less, it flags volatility as having risen sharply or being suppressed. It doesn't consider whether price is rising or falling.

It isn't used as a signal that sets direction. It's used as an input for gauging the size of risk in other signals, and it's compared with [Yang-Zhang volatility](/guide/indicators/yang-zhang) to see how much intraday swings and close-based movement differ.

## Watch out for

- 0.94 is a convention set from data. RiskMetrics found the best-fitting value for each of 480 time series and averaged them, so there's no guarantee it fits any single stock best.
- The formula has no tendency to return to a long-run average level, so volatility that has risen after a shock can linger longer than it should.
- It assumes returns follow a normal distribution, so it can understate the risk of an extreme crash.
- Treat it as a reactive measure of risk right now, not as a tool for predicting the regime ahead.
