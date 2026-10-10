---
title: "Regression R² (Coefficient of Determination)"
aliases: [R-squared, R2, Regression R2, Coefficient of Determination, Trend Cleanliness]
summary: "A 0 to 1 reading of how closely recent prices followed a straight line. It says nothing about direction."
seoTitle: "Regression R²: Checking How Clean a Trend Is"
seoDescription: What the R² of a price regression line means, the 0.3 threshold, and why it tells you how clean a trend is but not which way it runs.
demoCaption: "Synthetic, illustrative bars. One side rises close to a straight line and the other zigzags, so the R² difference can be compared."
faq:
  - q: "Does a high regression R² mean the stock will rise?"
    a: "No. R² only shows how clean the trend is, not whether it is rising or falling. Direction has to be checked separately from the sign of the regression line's slope."
  - q: "What R² counts as a clear trend?"
    a: "On the last 20 bars, SIGLENS marks a trend as clear at 0.3 or above. 0.3 is a rough guide tuned to 20 bars, so the threshold has to change when the number of bars changes."
---

## How it's calculated

In one line: it scores, from 0 to 1, how closely recent price moved along a ruler-straight line.

Line up the closes of a recent window in time order and fit the straight line that best matches those points (a linear regression line). The coefficient of determination, R², is a number from 0 to 1 that says how much of the price movement that line explains. It equals the square of the correlation between price and time.

Near 0, price moved up and down with no relation to a straight line; near 1, it moved almost along a straight line.

## What it tells you

R² shows how clean the trend is, but not its direction. A steep rise and a steady decline both score high if they are close to a straight line. Direction comes from the sign of the regression slope. High R² with a positive slope is a clean uptrend; with a negative slope it is a clean downtrend.

- When R² is high, give more weight to trend-following readings and be careful with readings that bet against the move.
- When R² is low, treat the market as a range (price moving up and down within a set band) or one with a lot of small waves, give more weight to mean-reversion signals such as [Bollinger %B](/guide/indicators/bollinger-percent-b), and trust breakout signals less.

## How SIGLENS detects it

SIGLENS flags a clear trend when the closes of the last 20 bars moved close enough to a straight line.

- Range: it fits a regression line to the closes of the last 20 bars and calculates the slope and R² on every bar.
- 0.3 or above: the trend is marked as clear. On 20 bars, even about 0.2 is said to be hard to attribute to chance, but it leaves some margin and uses 0.3.

Shorter windows come out high by chance more easily, so the 0.3 set for 20 bars is not carried over to other lengths.

This indicator is used only as supporting evidence for whether the market is trending now, not as a directional signal, and no conclusion is drawn from it alone. When the [Hurst exponent](/guide/indicators/hurst) and the [variance ratio](/guide/indicators/variance-ratio) point the same way, confidence goes up.

## Watch out for

- R² in other charting tools may use a different window. Do not compare values from different windows against the same 0.3 threshold.
- It says nothing about direction. Do not judge up or down from R² alone.
- It assumes a straight-line trend, so a parabolic move that accelerates and curves upward gets a lower R² than its actual strength.
- The value can differ depending on whether it is computed on raw prices or log prices. SIGLENS computes it on raw closes.
