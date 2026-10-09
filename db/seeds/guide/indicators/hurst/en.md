---
title: Hurst Exponent
aliases: [Hurst Exponent, Hurst H, R/S analysis, trending or mean-reverting indicator]
summary: A single number between 0 and 1 that measures whether price moves tend to continue or tend to reverse.
seoTitle: "Hurst Exponent: Trend vs Mean Reversion"
seoDescription: How the Hurst exponent separates trending from mean-reverting markets around 0.5, how R/S is calculated, and limits such as small-sample bias.
demoCaption: Synthetic, illustrative bars. A stretch that keeps running one way and a stretch that swings back up and down are marked separately.
faq:
  - q: What does a Hurst exponent above 0.5 mean?
    a: Price tends to keep going in the direction it has moved, which means there is a trend. Below 0.5 it tends to revert to the mean, and near 0.5 it is close to random.
  - q: Does the Hurst exponent give a buy signal?
    a: No. It isn't about direction. It identifies the regime, telling you which kind of strategy fits the market. Its role is to set conditions on how much to trust other signals.
  - q: How accurate is the Hurst exponent?
    a: In small samples, the value tends to come out higher than the true one, and it is sensitive to window length. Treat values close to 0.5 as noise, and read it as a reference, not a definitive verdict.
---

## How it's calculated

Hydrologist Harold Edwin Hurst studied records of Nile River water levels and published the value in a 1951 paper. Later, Mandelbrot and Van Ness (1968) formalized it in a mathematical model called fractional Brownian motion.

The basic calculation is R/S (rescaled range) analysis. Returns are split into segments of length n. For each segment, take the running sum of deviations from the mean, and divide how widely it swings (R) by the standard deviation (S). Vary n and watch how fast this value grows. Fitting a straight line to that growth rate on a log scale gives the slope H.

H lies between 0 and 1.

- H > 0.5: the direction of a move tends to continue. There is a trend.
- H < 0.5: price tends to come back, rising then falling and falling then rising.
- H ≈ 0.5: similar to a random walk.

## What it tells you

It tells you the character of the market, not direction. When H is above 0.5, trend-following signals are more reliable and signals that bet on a pullback are lower in quality. When it is below 0.5, mean-reversion signals such as [Bollinger %B](/guide/indicators/bollinger-percent-b) work relatively well and the case for a trend continuing is weaker. Near 0.5, it is hard to be confident in either direction.

## How Siglens detects it

Siglens finds R/S from the log returns of the last 100 bars and calculates the slope while varying the segment length over 25, 50 and 100. The result is clipped to a 0 to 1 range, and if price barely moves and there are too few points to calculate, that bar produces no value.

It points out which kind of market the reading is closer to only when H is at least 0.1 away from 0.5, that is, 0.6 or higher or 0.4 or lower. Values in between are treated as noise and skipped.

It trusts the reading more when it points the same way as [variance ratio](/guide/indicators/variance-ratio) and [regression R²](/guide/indicators/regression-r2), and reads it with less confidence when they disagree.

## Watch out for

- Classical R/S has a bias that makes H come out higher than the true value in small samples, and it is sensitive to window length. The shorter the window, the more H is inflated.
- As Andrew Lo (1991) showed, classical R/S can't tell a real long-lasting tendency from short-lived persistence of a few days. Much of the long-range tendency seen in stocks disappeared in calculations that corrected for this.
- In liquid markets, H hovers around 0.5. Treat values at the boundary as noise.
- It is a reference tool for adjusting the weight of other signals, not a definitive verdict.
