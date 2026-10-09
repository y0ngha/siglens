---
title: Descending Channel
aliases: [Falling Channel, Downward Channel, Downtrend Channel, Descending Trend Channel]
summary: Price moves between two parallel falling trendlines. It maps the trend more than it signals a direction.
seoTitle: "Descending Channel Pattern: Meaning and Breakouts"
seoDescription: What a descending channel looks like, how price moves inside it, what a close beyond either line means, and how to tell it from a falling wedge.
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

Price moves between two parallel falling trendlines, like a pipe tilted downward with price inside. Highs form near the upper line and lows near the lower line. If both lines are horizontal, it is a [rectangle](/guide/chart-patterns/rectangle).

## What it tells you

The downtrend is continuing within a steady range. While rebounds stall near the upper line, the trend is considered intact; a close above the upper line is read as a sign the decline has weakened.

It has limits as a directional signal. Thomas Bulkowski did not tabulate channel performance separately and said only that it is probably similar to a rectangle. He also noted the breakout can go either way. For that reason, a channel is often used less as a buy or sell signal and more as a way to see the range the current trend is moving in.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). It draws the upper and lower boundaries through the 5 to 8 most recent swings, then extends back to earlier swings (up to 16) as long as the same lines still hold. Each line passes through actual swing extremes.

- Both lines must fall at least 1.5 times ATR over the span and be touched at least twice (a swing counts as a touch if it is within 0.35 times ATR of the line). No bar in the span may poke out past a line by more than 0.25 times ATR.
- The final width must be 0.85 to 1.15 times the starting width for the lines to count as parallel.
- If the two separately fitted lines fail the conditions, Siglens takes one line as the base and draws a parallel through the farthest swing on the opposite side, then checks again.
- If the final width is 0.7 times or less and each side has at least 3 touches, it is a [falling wedge](/guide/chart-patterns/descending-wedge). Ratios between 0.7 and 0.85 are not drawn.
- It must span at least 15 bars, and the width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Direction follows the prior trend: the side toward which the close moved at least 2 times ATR over the 20 bars before the pattern. If there is no such trend, Siglens sets no direction and calculates no target. Once a direction is set, the measured target is the channel width projected from the line on that side, and the conservative target is half of that. The invalidation level is the price of the last swing that touched the opposite line.

If the close moves beyond a line by more than 0.25 times ATR and the last close then returns inside the channel, Siglens marks it as a "failed breakout".

## Watch out for

- If price often comes near a line without touching it, the channel is loose.
- If the channel is narrow relative to price, moving outside the lines is often just noise.
- If price hugs one side instead of moving across the full width, the pattern means less.
- A close above the upper line that quickly returns inside the channel may be a false breakout, not a reversal.
- A close below the lower line suggests the decline has accelerated.
