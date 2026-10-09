---
title: Breakout
aliases: [breakout trading, range breakout, resistance breakout, price breakout, false breakout]
summary: "Watch for a close beyond a long-standing support or resistance line, then filter false breakouts with checks like volume."
seoTitle: "Breakout Trading: Meaning and False Breakouts"
seoDescription: How range, pattern, moving average and Donchian breakouts differ, how closes, volume and retests filter false breakouts, and what Siglens checks.
demoCaption: Synthetic, illustrative candles. Shows a fixed-width range, a close above the upper line with rising volume, and a retest back to the breakout line.
faq:
  - q: When is a breakout considered confirmed?
    a: Many traders go by the close, not by an intraday move through the line. A more conservative approach waits for two consecutive closes beyond the line.
  - q: How do I filter out false breakouts?
    a: Check whether volume is at least 50% above its 20-day average, whether RSI and MACD agree with the direction, and whether ADX is rising above 25 (a trending environment). Waiting for a retest of the breakout line is more conservative still.
  - q: How do I set a target after a breakout?
    a: If a range or chart pattern was detected, the measured target from the pattern's height is a reference. With no pattern, look at zones such as the prior high instead of a specific number.
---

## What it is

Price moves through a boundary where buyers and sellers had been evenly matched. There are four types, depending on the boundary.

- **Range breakout**: price moves sideways inside horizontal support and resistance for a long time, then closes outside the boundary. The longer the range, the more weight the breakout carries.
- **Pattern breakout**: price leaves the boundary of a chart pattern such as a triangle, flag, wedge, rectangle or head and shoulders. Continuation patterns break in the prior direction; reversal patterns break the other way.
- **Moving average breakout**: price crosses the 20-, 50- or 200-day line after spending a long time on one side of it. The 200-day line is the one most often cited as dividing bull and bear markets.
- **Donchian breakout**: price exceeds the highest high (lowest low) of the last N bars. Richard Dennis's Turtle trading used a 20-bar breakout to enter and an opposite 10-bar breakout to exit. The [Donchian channel](/guide/indicators/donchian-channel) draws this boundary.

## What it tells you

It is read as a long-standing balance of buying and selling breaking to one side. Orders that had piled up at the boundary can fill all at once, so price sometimes moves fast.

That is why separating a real breakout from a false one matters most. Failure rates differ by pattern and cannot be reduced to one number; see Thomas Bulkowski's tallies in each pattern article. Common checks are whether the close is outside the boundary, whether the breakout bar's volume is at least 50% above its 20-day average, whether momentum indicators point the same way, and whether the breakout line holds when price comes back to test it (a retest).

## How Siglens detects it

Siglens does not judge breakouts with a single rule. When any of the signals below appears on the last bar, it examines the setup as a possible breakout.

- A close above the upper Bollinger Band
- The previous bar was inside the Keltner Channel, and the close is above the upper band (or below the lower band)
- The previous bar was not above the Ichimoku cloud, and the close is above the cloud (the same logic applies to a break below)

It then counts how many of the false-breakout filters pass.

- Whether the bar closed outside the boundary. A move through the line during the session that returns inside does not count.
- Whether the last bar's volume is at least 1.5 times the average of the last 20 bars
- Whether RSI and MACD agree with the breakout direction, and whether ADX is rising above 25

A target is used only when a chart pattern was detected, and then it is that pattern's measured target. Stops are described in terms of structure, such as the opposite boundary or "1.5 times [ATR](/guide/indicators/atr)", not as a specific price. If price is still short of the boundary, Siglens also explains what conditions would count as a breakout.

## Watch out for

- Filters do not remove false breakouts completely.
- A breakout is an entry after the move has started, so the entry price tends to be worse.
- In a sideways market with ADX below 20, small losses pile up easily.
- A gap from an event such as an earnings release makes it hard to fill at the breakout line.
- Many people watch the same price, so quick profit-taking right after a breakout can push price back.
- A level that has already been tested and failed several times gets lower confidence.
