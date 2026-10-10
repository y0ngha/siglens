---
title: Descending Channel
aliases: [Falling Channel, Downward Channel, Downtrend Channel, Descending Trend Channel]
summary: Price moves between two parallel falling trendlines. It maps the trend more than it signals a direction.
seoTitle: "Descending Channel Pattern: Meaning and Breakouts"
seoDescription: How bounces and declines repeat inside a descending channel, what a break above the upper line or below the lower line means, and how to tell it from a falling wedge.
demoCaption: Synthetic, illustrative bars. Shows two parallel falling trendlines, bars moving between them, and a bar closing above the upper line.
faq:
  - q: How do I tell a descending channel from a falling wedge?
    a: If the two lines run parallel it is a channel; if they converge it is a wedge. SIGLENS treats the lines as parallel when the final width is 0.85 to 1.15 times the starting width, and calls it a falling wedge when the width narrows to 0.7 times or less with at least 3 touches on each line.
  - q: Is a move above the upper line of a descending channel a reversal?
    a: A close above the upper line is often read as a sign the downtrend has broken, but a turn upward is not confirmed. Thomas Bulkowski also said a channel breakout can go in either direction.
  - q: Is a channel a buy or sell signal?
    a: A channel is closer to a trend-mapping tool. Bulkowski did not tabulate channel performance separately and only said it is probably similar to a rectangle.
---

## How it looks

Highs and lows fall together, and price stays boxed in between two parallel trendlines heading down. Rallies stall at the upper line and drops pause near the lower line, over and over. If the lines are flat instead of sloped, it is treated separately as a [rectangle](/guide/chart-patterns/rectangle).

## What it tells you

Sellers keep the upper hand, but the decline is orderly and holds a steady width. As long as rallies turn down near the upper line, the downtrend is considered intact; a close above the upper line suggests the decline may have broken.

There is no scorecard for channels themselves. Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in his books, did not measure channel performance either and only guessed it is similar to a rectangle. He also saw no set breakout direction. So a descending channel is used less as a signal of when to buy or sell and more as a gauge of how wide the decline is running.

## How it differs from an ascending channel

In an [ascending channel](/guide/chart-patterns/ascending-channel) the key break is through the lower line, but in a descending channel the break above the upper line is the more important signal. Bulkowski treated a breakout above the channel as the point where a short sale (a position that profits when price falls, a bet on decline) made inside a down-sloping channel no longer holds. A close below the lower line, by contrast, is not a bottom; it means the decline is speeding up.

In a falling market, price can look cheap every time it touches the lower line, which makes buying tempting. But while the channel holds, the lower line is not a floor; it is one wall of a pipe that keeps heading down. Bulkowski also held that betting on a rise does not suit a down-sloping channel and that it is better viewed from the falling side.

The breakout direction is anticipated the same way as in an ascending channel. When price turns up before reaching the lower line (a partial decline), an upward break is expected; when it turns down before reaching the upper line (a partial rise), a downward break is expected. Because the upper-line break is the key signal here, a partial decline is worth watching as a possible early warning of it.

## How SIGLENS detects it

SIGLENS connects clearly turning highs and lows (swings: turning points where price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average range of recent bars) to draw the upper and lower boundaries. When both lines fall together and the width stays about the same, it treats the shape as a descending channel.

- Both lines must fall at least 1.5 times ATR over the pattern.
- Swings must touch each line at least twice. A swing within 0.35 times ATR of a line counts as a touch.
- No bar may poke out past a line by more than 0.25 times ATR.
- The final width must be 0.85 to 1.15 times the starting width for the lines to count as parallel. If it narrows to 0.7 times or less with at least 3 touches on each side, it is a [falling wedge](/guide/chart-patterns/descending-wedge); anything in between (0.7 to 0.85) is not shown as either.
- It must last at least 15 bars.
- The width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Direction comes from the trend over the 20 bars before the pattern, regardless of the channel's slope. The side toward which the close moved at least 2 times ATR in that span sets the direction; with no such trend, SIGLENS sets neither a direction nor a target. This is a calculation rule that assumes the prior trend continues, not a forecast of which way price will break.

Once a direction is set, the measured target is the channel width projected from the line on that side, and the conservative target is half of that. A target is the price reached if the move extends by the pattern's height. It is a reference value, not a promise, and for channels the share that reached it has never been tabulated. The invalidation level is the price at which the pattern is considered broken: the last swing that touched the opposite line.

If the close moves beyond a line by more than 0.25 times ATR and the last close then returns inside the channel, SIGLENS marks it as a "failed breakout".

## Watch out for

- If price often comes close to a line and turns away without touching it, the lines were drawn loosely.
- In a channel that is narrow relative to price, a move outside the lines is often noise.
- If price stays on one side and does not travel across the full width, the channel means less.
- A close above the upper line that quickly returns inside the channel may be a false breakout, not a reversal.
