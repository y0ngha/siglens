---
title: Descending Channel
aliases: [Falling Channel, Downward Channel, Downtrend Channel, Descending Trend Channel]
summary: Price moves between two parallel falling trendlines. It maps the trend more than it signals a direction.
seoTitle: "Descending Channel Pattern: Meaning and Breakouts"
seoDescription: How bounces and declines repeat inside a descending channel, what a break above the upper line or below the lower line means, and how to tell it from a falling wedge.
demoCaption: Synthetic, illustrative bars. Shows two parallel falling trendlines, bars moving between them, and a bar closing above the upper line.
faq:
  - q: How do I tell a descending channel from a falling wedge?
    a: If the two lines run parallel it is a channel; if they converge it is a wedge. Siglens treats the lines as parallel when the final width is 0.85 to 1.15 times the starting width, and calls it a falling wedge when the width narrows to 0.7 times or less with at least 3 touches on each line.
  - q: Is a move above the upper line of a descending channel a reversal?
    a: A close above the upper line is often read as a sign the downtrend has broken, but a turn upward is not confirmed. Thomas Bulkowski also said a channel breakout can go in either direction.
  - q: Is a channel a buy or sell signal?
    a: A channel is closer to a trend-mapping tool. Bulkowski did not tabulate channel performance separately and only said it is probably similar to a rectangle.
---

## How it looks

Highs and lows fall together, and price stays boxed in between two parallel trendlines heading down. Rallies stall at the upper line and drops pause near the lower line, over and over. If the lines are flat instead of sloped, it is treated separately as a [rectangle](/guide/chart-patterns/rectangle).

## What it tells you

Sellers keep the upper hand, but the decline is orderly and holds a steady width. As long as rallies turn down near the upper line, the downtrend is considered intact; a close above the upper line suggests the decline may have broken.

There is no scorecard for channels themselves. Thomas Bulkowski did not measure channel performance and only guessed it is similar to a rectangle. He also saw no set breakout direction. So a descending channel is used less as a signal of when to buy or sell and more as a gauge of how wide the decline is running.

## How it differs from an ascending channel

In an [ascending channel](/guide/chart-patterns/ascending-channel) the key event is a break of the lower line, but in a descending channel the break above the upper line matters more. Bulkowski says that if you shorted inside a down-sloping channel, you should cover when price breaks out upward. A close below the lower line, by contrast, is not a bottom; it means the decline is speeding up.

In a falling market, price can look cheap every time it touches the lower line, which makes buying tempting. But while the channel holds, the lower line is not a floor; it is one wall of a pipe that keeps heading down. Bulkowski also advises avoiding longs inside a down-sloping channel and trading it from the short side.

Reading the breakout direction ahead of time works the same way as in an ascending channel. When price turns up before reaching the lower line (a partial decline), expect an upward break; when it turns down before reaching the upper line (a partial rise), expect a downward break. Because the upper-line break is the key event here, a partial decline is worth watching as a possible early warning of it.

## How Siglens detects it

A swing high or low is confirmed once price has reversed from that point by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). The boundaries are drawn through the 5 to 8 most recent swings and, as long as the same lines hold, extended back up to 16 swings. They are not averaged regression lines; they pass through actual swing extremes.

- Both lines must fall at least 1.5 times ATR over the span and be touched at least twice (a swing counts as a touch if it is within 0.35 times ATR of the line). No bar in the span may poke out past a line by more than 0.25 times ATR.
- The final width must be 0.85 to 1.15 times the starting width for the lines to count as parallel.
- If the two separately fitted lines fail the conditions, Siglens takes one line as the base and draws a parallel through the farthest swing on the opposite side, then checks again.
- If the final width is 0.7 times or less and each side has at least 3 touches, it is a [falling wedge](/guide/chart-patterns/descending-wedge). Ratios between 0.7 and 0.85 are not drawn.
- It must span at least 15 bars, and the width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Direction follows the prior trend: the side toward which the close moved at least 2 times ATR over the 20 bars before the pattern. If there is no such trend, Siglens sets no direction and calculates no target. Once a direction is set, the measured target is the channel width projected from the line on that side, and the conservative target is half of that. The invalidation level is the price of the last swing that touched the opposite line.

If the close moves beyond a line by more than 0.25 times ATR and the last close then returns inside the channel, Siglens marks it as a "failed breakout".

## Watch out for

- If price often comes close to a line and turns away without touching it, the lines were drawn loosely.
- In a channel that is narrow relative to price, a move outside the lines is often noise.
- If price stays on one side and does not travel across the full width, the channel means less.
- A close above the upper line that quickly returns inside the channel may be a false breakout, not a reversal.
