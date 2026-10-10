---
title: Hurst Exponent
aliases: [Hurst Exponent, Hurst H, R/S analysis, trending or mean-reverting indicator]
summary: A single number between 0 and 1 that measures whether price moves tend to continue or tend to reverse.
seoTitle: "Hurst Exponent: Trend vs Mean Reversion"
seoDescription: A Hurst exponent above 0.5 points to trending, below 0.5 to mean reversion. Learn how R/S analysis works and its limits, such as small-sample bias.
demoCaption: Synthetic, illustrative bars. Shows the Hurst exponent splitting above and below the 0.5 line in a trending stretch and a mean-reverting stretch. It uses the last 100 bars, so the value lags for a while after the regime changes.
faq:
  - q: What does a Hurst exponent above 0.5 mean?
    a: Price tends to keep going in the direction it has moved, which means there is a trend. Below 0.5 it tends to revert to the mean, and near 0.5 it is close to random.
  - q: Does the Hurst exponent give a buy signal?
    a: No. It isn't about direction; it tells you which kind of strategy fits the market right now. It is used to decide how much to trust other signals.
  - q: How accurate is the Hurst exponent?
    a: In small samples, the value tends to come out higher than the true one, and it is sensitive to the period used in the calculation. Treat values close to 0.5 as noise, and read it as a reference, not a definitive verdict.
---

## How it's calculated

In one line: it measures how fast the range of price movement widens as you look over longer periods. If it widens faster than it would under random movement, the market leans toward trend; if slower, toward pullback.

The calculation is R/S (rescaled range) analysis. Returns are split into segments of length n. For each segment, take the running sum of deviations from the mean, and divide how widely it swings (R) by the standard deviation (S). Vary n and fit a straight line, on a log scale, to how fast this value grows. The slope of that line is H.

H lies between 0 and 1, and for actively traded stocks it usually hovers around 0.5.

- H > 0.5: the direction of a move tends to continue. There is a trend.
- H < 0.5: price tends to come back, rising then falling and falling then rising.
- H ≈ 0.5: similar to random movement.

The name comes from hydrologist Harold Edwin Hurst (1951), who studied records of Nile River water levels; Mandelbrot and Van Ness (1968) later formalized it in a mathematical model called fractional Brownian motion.

## What it tells you

It tells you the character of the market, not direction. When H is above 0.5, trend-following signals carry more weight and signals that bet on a pullback are less reliable. When it is below 0.5, mean-reversion signals (bets on price returning toward its average) such as [Bollinger %B](/guide/indicators/bollinger-percent-b) work relatively well, and the case for a trend continuing is weaker. Near 0.5, it is hard to be confident in either direction.

## How SIGLENS detects it

SIGLENS computes the Hurst exponent from price changes over the last 100 bars and points out which kind of market it is closer to only when the value is far enough from 0.5.

- Range: the last 100 bars. It finds the slope while varying the segment length over 25, 50 and 100 bars.
- 0.6 or higher: read as closer to a trending market, where moves continue.
- 0.4 or lower: read as closer to a market where moves come back.
- Between 0.4 and 0.6: treated as noise and skipped.

When [variance ratio](/guide/indicators/variance-ratio) and [regression R²](/guide/indicators/regression-r2) point the same way, confidence goes up; when they disagree, the reading is held with less confidence.

## Watch out for

- Classical R/S makes H come out higher than the true value in small samples, and it is sensitive to the calculation period. The shorter the period, the more H is inflated.
- Classical R/S can't tell a real long-lasting tendency from short-lived persistence of a few days. When economist Andrew Lo (1991) corrected for this and recalculated, much of the long-range tendency seen in stocks disappeared.
- Treat boundary values close to 0.5 as noise.
- It is a reference tool for adjusting the weight of other signals, not a definitive verdict.
