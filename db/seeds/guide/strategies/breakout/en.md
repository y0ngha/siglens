---
title: Breakout
aliases: [breakout trading, range breakout, resistance breakout, price breakout, false breakout]
summary: "Watch for a close beyond a long-standing support or resistance line, then filter false breakouts with checks like volume."
seoTitle: "Breakout Trading: Meaning and False Breakouts"
seoDescription: How range, pattern, moving average and Donchian breakouts differ, and how to filter false breakouts by close, volume and retest, with Siglens' criteria.
demoCaption: Synthetic, illustrative candles. Shows a fixed-width range, a close above the upper line with rising volume, and a retest back to the breakout line.
faq:
  - q: When is a breakout considered confirmed?
    a: The usual reference is not price crossing the line intraday but a close beyond the line. A more conservative approach waits for two consecutive closes beyond it.
  - q: How do I filter out false breakouts?
    a: Check whether volume is at least 50% above its 20-day average, whether RSI and MACD agree with the breakout direction, and whether ADX, which measures trend strength, is rising above 25. Waiting for a retest, where price comes back to the broken line and the line holds again, is more conservative still.
  - q: How do I set a target after a breakout?
    a: If a range or chart pattern has been detected, the measured target calculated from that pattern's height is a reference. It reflects how far price often went in the past and does not promise that price will get there. Without a pattern, it is described only as a zone, such as near the prior high, rather than a number.
---

## What it is

A breakout is price pushing through a boundary where buyers and sellers had been evenly matched. It is grouped into four types by the kind of boundary.

- **Range breakout**: after moving inside horizontal support and resistance for a long time, price closes outside the boundary. The longer the range, the more weight the breakout is given.
- **Pattern breakout**: price leaves the boundary of a chart pattern such as a triangle, flag, wedge, rectangle or head and shoulders. Continuation patterns break in the prior direction; reversal patterns break the other way.
- **Moving average breakout**: after staying on one side of the 20-, 50- or 200-day line for a long time, price crosses to the other side. The 200-day line is the one most often cited as dividing bull and bear markets.
- **Donchian breakout**: price moves past the highest high (or lowest low) of the last N bars. Turtle Trading, taught by Richard Dennis in the 1980s, bought when price topped the 20-bar high and sold when it broke the 10-bar low. The [Donchian channel](/guide/indicators/donchian-channel) shows this boundary.

## What it tells you

What follows is the traditional reading. Siglens treats a breakout signal as background to read alongside other evidence, not as a conclusion on its own.

A breakout is read as a long-standing balance between buying and selling tipping to one side. Orders sitting near the boundary can fill all at once, sending price moving quickly.

That makes telling real breakouts from false ones the main task. Failure rates differ by pattern, so no single number covers them. Each pattern article cites Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results. Common checks:

- Did price close outside the boundary?
- Is volume on the breakout bar at least 50% above the 20-day average?
- Do momentum indicators (such as [RSI](/guide/indicators/rsi) and [MACD](/guide/indicators/macd), which measure the force behind a move) point the same way?
- Retest: when price comes back to the broken line, does the line hold?

## How Siglens detects it

When price closes outside the range it normally moves in (a band, channel or cloud), Siglens takes that as a sign a breakout may be under way and adds a breakout-focused analysis. Range and pattern boundaries differ from stock to stock, but these ranges can be calculated the same way for every stock, which makes them a practical starting point. It applies when one of the following appears on the last bar.

- [Bollinger Bands](/guide/indicators/bollinger-bands): a close above the upper band. Where the previous bar sat does not matter.
- [Keltner channel](/guide/indicators/keltner-channel): the previous close was inside the channel, and this close is above the upper line (or below the lower line).
- [Ichimoku cloud](/guide/indicators/ichimoku-cloud): the previous close was not above the cloud, and this close is above it. A move out below the cloud works the same way.

It then counts how many false-breakout filters are passed.

- Did price close outside the boundary? A move that crossed intraday and came back inside does not count.
- Is the last bar's volume at least 1.5 times the average of the last 20 bars?
- Do RSI and MACD agree with the breakout direction, and is [ADX](/guide/indicators/adx) (a measure of trend strength) rising above 25?

A target is used only when a chart pattern has been detected, in which case it is that pattern's measured target: the price reached if price moves another pattern height, and only a reference value. The point at which the breakout is considered wrong is described only in words, such as the opposite boundary or "1.5 times [ATR](/guide/indicators/atr) (the average range of recent bars)", never as a specific price. If price is still short of the boundary, it also explains what would be needed for a breakout to count.

## Watch out for

- Filters cannot fully prevent false breakouts.
- A breakout is confirmed only after price has already moved, so buying on confirmation often means a worse price.
- In a sideways market with ADX below 20, where there is no clear direction, small losses tend to pile up.
- When an event such as earnings causes a gap, trading near the breakout line becomes difficult.
- Because many people watch the same price, quick profit-taking right after the breakout can push it back.
- A boundary that has already been tested and failed several times is considered less reliable.
