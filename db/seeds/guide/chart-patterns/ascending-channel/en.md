---
title: Ascending Channel
aliases: [Rising Channel, Upward Channel, Uptrend Channel, Ascending Trend Channel]
summary: Price moves between two parallel rising trendlines. It maps the trend more than it signals a direction.
seoTitle: "Ascending Channel Pattern: Meaning and Breakouts"
seoDescription: How price moves up and down inside an ascending channel, what a break of the lower or upper line means, and how to keep it apart from a rising wedge.
demoCaption: Synthetic, illustrative bars. Shows two parallel rising trendlines, bars moving between them, and a bar closing below the lower line.
faq:
  - q: How do I tell an ascending channel from a rising wedge?
    a: If the two lines run parallel it is a channel; if they converge it is a wedge. SIGLENS treats the lines as parallel when the final width is 0.85 to 1.15 times the starting width, and calls it a rising wedge when the width narrows to 0.7 times or less with at least 3 touches on each line.
  - q: What does it mean when price leaves an ascending channel?
    a: A close beyond either line counts as a breakout. Thomas Bulkowski found that the breakout can go in either direction, and he presented a close beyond the line on the wrong side as a reason to exit a trade.
  - q: Is a channel a buy or sell signal?
    a: A channel is closer to a trend-mapping tool. Bulkowski did not tabulate channel performance separately and only said it is probably similar to a rectangle.
---

## How it looks

Price moves between two parallel rising trendlines, like a tilted pipe with price inside. Highs form near the upper line and lows near the lower line. If both lines are horizontal, it is a [rectangle](/guide/chart-patterns/rectangle).

## What it tells you

The uptrend is continuing within a steady range. While declines stop near the lower line, the trend is considered intact; a close below the lower line is read as a sign the trend has weakened.

It has limits as a directional signal. Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in his books, did not tabulate channel performance separately and said only that it is probably similar to a rectangle. He also noted the breakout can go either way. So a channel works less as a buy or sell signal and more as a way to see the range the current trend is moving in.

## How it differs from a descending channel

It looks like a [descending channel](/guide/chart-patterns/descending-channel) flipped upside down, but the break that matters is on the other side. In an ascending channel, the more informative break is the one through the lower line. Bulkowski's example also treats a close below the lower line as the sell signal. A close above the upper line, by contrast, reads less as a turn and more as the rise speeding up.

While price stays inside, the uptrend is considered intact. Bulkowski held that short selling (a position that profits when price falls, a bet on decline) does not suit an up-sloping channel and that it is better viewed only from the rising side. For a position betting on the rise, he treated a close outside the lower line as the point where that view no longer holds.

Moves inside the channel can hint at the breakout direction. When price turns down before reaching the upper line (a partial rise), a downward break is expected; when it turns up before reaching the lower line (a partial decline), an upward break is expected. Because the lower-line break is the more important signal in an ascending channel, a partial rise is worth watching as a possible early warning of it.

## How SIGLENS detects it

SIGLENS connects clearly turning highs and lows (swings: turning points where price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average range of recent bars) to draw the upper and lower boundaries. When both lines rise together and the width stays about the same, it treats the shape as an ascending channel.

- Both lines must rise at least 1.5 times ATR over the pattern.
- Swings must touch each line at least twice. A swing within 0.35 times ATR of a line counts as a touch.
- No bar may poke out past a line by more than 0.25 times ATR.
- The final width must be 0.85 to 1.15 times the starting width for the lines to count as parallel. If it narrows to 0.7 times or less with at least 3 touches on each side, it is a [rising wedge](/guide/chart-patterns/ascending-wedge); anything in between (0.7 to 0.85) is not shown as either.
- It must last at least 15 bars.
- The width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Direction comes from the trend over the 20 bars before the pattern, regardless of the channel's slope. The side toward which the close moved at least 2 times ATR in that span sets the direction; with no such trend, SIGLENS sets neither a direction nor a target. This is a calculation rule that assumes the prior trend continues, not a forecast of which way price will break.

Once a direction is set, the measured target is the channel width projected from the line on that side, and the conservative target is half of that. A target is the price reached if the move extends by the pattern's height. It is a reference value, not a promise, and for channels the share that reached it has never been tabulated. The invalidation level is the price at which the pattern is considered broken: the last swing that touched the opposite line.

If the close moves beyond a line by more than 0.25 times ATR and the last close then returns inside the channel, SIGLENS marks it as a "failed breakout".

## Watch out for

- If price often comes near a line without touching it, the channel is loose.
- If the channel is narrow relative to price, moving outside the lines is often just noise.
- If the channel slopes less steeply than the advance before it, Bulkowski read that as a warning that upward momentum has faded.
- If price hugs one side instead of moving across the full width, the pattern means less.
- A close below the lower line suggests the trend has weakened; a close above the upper line suggests the advance has accelerated.
