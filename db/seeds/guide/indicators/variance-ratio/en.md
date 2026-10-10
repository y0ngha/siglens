---
title: "Variance Ratio"
aliases: [Variance Ratio, Lo-MacKinlay Variance Ratio, VR Test, Variance Ratio Test]
summary: "Uses how widely returns are spread (their variance) to tell whether price moves randomly, keeps trending, or reverts."
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

In one line: it checks whether movement over several days is larger or smaller than one day's movement stacked up for that many days. Larger points to a trend that keeps going the same way; smaller points to price coming back.

The size of movement here is measured as variance (how widely returns are spread around their average).

VR(q) = variance of q-period returns ÷ (q × variance of 1-period returns)

If price is a random walk (random movement whose future cannot be predicted from the past), variance grows in proportion to the period, so VR comes out near 1. Above 1, returns tend to continue in the same direction, a trend; below 1, they tend to come back toward the average, such as rising and then falling (mean reversion).

It is a statistical test published by Andrew Lo and A. Craig MacKinlay in 1988, and it has long been used to check whether price follows a random walk.

## What it tells you

- If VR is clearly above 1, treat it as a trending stretch and give more weight to trend-following readings.
- If VR is clearly below 1, treat it as a mean-reverting stretch and give more weight to pullback signals such as [Bollinger %B](/guide/indicators/bollinger-percent-b).
- If VR is near 1, it looks like a random walk, and it commits to neither side.

It does not give direction. It only says the stretch is trending; whether price is rising or falling has to be read from other indicators.

## How Siglens detects it

Siglens compares one-day movement with two-day movement and marks the trend side or the pullback side as clear only when the value is far enough from 1.

- Range: per-bar returns over the last 60 bars (daily returns on a daily chart).
- Comparison: one bar versus two bars (q=2). On a daily chart, if two-day movement is more than twice one-day movement, it leans toward trend; if less, toward pullback.
- 1.2 or above: the trend side is read as clear.
- 0.8 or below: the pullback side is read as clear.

It is one of three indicators, with the [Hurst exponent](/guide/indicators/hurst) and [regression R²](/guide/indicators/regression-r2), for reading the market's state, and confidence is highest when all three point the same way. The variance ratio originally comes with a formal statistical test, so it gets heavy weight among the three, but Siglens uses a simplified fixed cutoff instead of that test. In the formal test, the cutoff changes with the comparison period and the sample size. It is not used to decide direction.

## Watch out for

- The value depends on how the comparison period (q) is chosen. It is better to look at several periods rather than relying on one.
- In real markets, high-movement days cluster for a while. A formal test uses a statistic that accounts for this (Z\*); otherwise it concludes too often that the series is not a random walk.
- A result of "not a random walk" is not a direction. It only says whether there is a trend.
- The fixed 0.2 cutoff is a rough value. Crossing it does not mean the result is statistically significant.
