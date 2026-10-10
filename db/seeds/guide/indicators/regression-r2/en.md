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
    a: "On the last 20 bars, Siglens marks a trend as clear at 0.3 or above. The threshold has to change when the number of bars changes, so 0.3 is a rough guide."
---

## How it's calculated

Line up the closes of a recent window in time order and fit the straight line that best matches those points (a linear regression line). The coefficient of determination, R², is a number from 0 to 1 that says how much of the price movement that line explains. It equals the square of the correlation between price and time.

Near 0, price moved up and down with no relation to a straight line; near 1, it moved almost along a straight line.

## What it tells you

R² shows how clean the trend is, but not its direction. A steep rise and a steady decline both score high if they are close to a straight line. Direction comes from the sign of the regression slope. High R² with a positive slope is a clean uptrend; with a negative slope it is a clean downtrend.

- When R² is high, give more weight to trend-following readings and be careful with readings that bet against the move.
- When R² is low, treat the market as a range or one with a lot of small waves, give more weight to mean-reversion signals such as [Bollinger %B](/guide/indicators/bollinger-percent-b), and trust breakout signals less.

## How Siglens detects it

Siglens fits a regression line to the closes of the last 20 bars and calculates the slope and R² on every bar. If every price in the window is identical, there is no variation and R² is undefined, so the value is left empty.

If R² is 0.3 or above, the trend is marked as clear. On 20 bars, an R² of even about 0.2 is said to be hard to attribute to chance, but Siglens leaves some margin and sets 0.3.

This threshold depends on the number of bars. With fewer bars, a straight-looking line appears by chance more easily, so a higher R² is needed. With 5 bars it must exceed 0.77, while with 60 bars it only needs to exceed 0.06. So 0.3 is a threshold for 20 bars only and should not be carried over to other window lengths.

Siglens uses this indicator only as supporting evidence for whether the market is trending now, not as a directional signal, and never draws a conclusion from it alone. It trusts it more when it points the same way as the [Hurst exponent](/guide/indicators/hurst) and the [variance ratio](/guide/indicators/variance-ratio).

## Watch out for

- The shorter the window, the higher R² gets on its own. Do not compare values from different window lengths against the same threshold.
- It says nothing about direction. Do not judge up or down from R² alone.
- It assumes a straight-line trend, so a parabolic move that accelerates and curves upward gets a lower R² than its actual strength.
- The value can differ depending on whether it is computed on raw prices or log prices. Siglens computes it on raw closes.
