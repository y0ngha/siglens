---
title: "Variance Ratio"
aliases: [Variance Ratio, Lo-MacKinlay Variance Ratio, VR Test, Variance Ratio Test]
summary: "Uses the variance of returns to tell whether price moves like a random walk, keeps trending, or reverts."
seoTitle: "Variance Ratio: How to Tell Trending from Ranging"
seoDescription: A variance ratio above 1 points to trending, below 1 to mean reversion. See how it separates trending from ranging markets, Siglens' thresholds, and its limits.
demoCaption: "Synthetic, illustrative bars. Shows the variance ratio splitting above and below the 1.0 line in a trending stretch and a mean-reverting stretch."
faq:
  - q: "What does a variance ratio above 1 mean?"
    a: "It means returns tend to continue in the same direction, a trending tendency. Below 1 means a tendency to reverse, such as rising and then falling. It does not tell you which way price goes."
  - q: "Who created the variance ratio?"
    a: "It is a random walk test that Andrew Lo and A. Craig MacKinlay published in the Review of Financial Studies in 1988."
---

## How it's calculated

The variance ratio is a statistical test published by Andrew Lo and A. Craig MacKinlay in 1988. It has long been used to check whether price follows a random walk (random movement whose future cannot be predicted from the past). It compares the variance of one-day returns with the variance of multi-day returns.

VR(q) = variance of q-period returns ÷ (q × variance of 1-period returns)

If price is a random walk, variance grows in proportion to the period, so VR comes out near 1. Above 1, returns tend to continue in the same direction (positive autocorrelation, trending); below 1, they tend to reverse, such as rising and then falling (negative autocorrelation, mean reversion).

## What it tells you

- If VR is clearly above 1, treat it as a trending stretch and give more weight to trend-following readings.
- If VR is clearly below 1, treat it as a mean-reverting stretch and give more weight to pullback signals such as [Bollinger %B](/guide/indicators/bollinger-percent-b).
- If VR is near 1, it looks like a random walk, and it commits to neither side.

It does not give direction. It only says the stretch is trending; whether price is rising or falling has to be read from other indicators.

## How Siglens detects it

Siglens calculates it from the per-bar log returns of the last 60 bars (daily returns on a daily chart), and gets the variance by grouping overlapping 2-bar (q=2) returns. If every price in the window is the same, the value is left empty.

If VR is 0.2 or more away from 1, meaning 1.2 or above or 0.8 or below, it marks a clear state. This threshold is not a formal statistical test; it is a simplification with a fixed cutoff. A formal test uses different cutoffs depending on q and the sample size.

It is one of three indicators, with the [Hurst exponent](/guide/indicators/hurst) and [regression R²](/guide/indicators/regression-r2), for reading the market's state. It trusts them most when all three point the same way. The variance ratio has a formal significance test, so it gets the most weight of the three, but it is not used to decide direction.

## Watch out for

- The value depends on how q is chosen. It is better to look at several values of q rather than relying on one.
- Real markets show volatility that clusters for a while. A formal test also has to use a statistic that accounts for this (Z\*); otherwise it concludes too often that the series is not a random walk.
- A result of "not a random walk" is not a direction. It only says whether there is a trend.
- The fixed 0.2 cutoff is a rough value and does not guarantee statistical significance.
