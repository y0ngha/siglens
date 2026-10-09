---
title: Fibonacci Retracement and Extension
aliases: [Fibonacci retracement, Fibonacci extension, Fibonacci levels, 61.8% retracement, golden ratio trading]
summary: Use ratios to estimate where a pullback after a big move may stop and how far the next move may extend.
seoTitle: "Fibonacci Retracement: 38.2%, 50%, 61.8% Levels"
seoDescription: What Fibonacci retracement and extension ratios mean, how to draw them on up and down swings, and how Siglens picks swings and calculates the levels.
demoCaption: Synthetic, illustrative candles. Shows a rise from swing low to swing high and the 38.2%, 50% and 61.8% retracement lines across the pullback.
faq:
  - q: Where do I draw a Fibonacci retracement?
    a: In an uptrend, set the swing low at 0% and the swing high at 100%, and watch how deep the pullback goes. In a downtrend, draw it the other way, from the high to the low, and watch where the bounce stalls.
  - q: Is 50% a Fibonacci ratio?
    a: No. 50% is the midpoint and does not come from the Fibonacci sequence. Many traders watch it anyway, so it is drawn alongside the others.
  - q: Do Fibonacci levels actually work?
    a: Evidence that the ratios themselves have predictive power is weak. Part of the reaction comes from many people watching the same price, so levels that overlap prior highs and lows or moving averages are given more weight.
---

## What it is

A method of dividing a price range using ratios derived from the Fibonacci sequence. It is used in two main ways.

- **Retracement**: lines showing how much of a big rise (or fall) gets given back. The ratios are 23.6%, 38.2%, 50%, 61.8% and 78.6%.
- **Extension**: lines showing how far the next move may go after the retracement. The ratios are 100%, 127.2%, 161.8%, 200% and 261.8%. 100% is the same distance as the earlier move.

In an uptrend, the swing low is 0% and the swing high is 100%. As the pullback comes down, you watch whether the retracement lines act as support. In a downtrend, the same lines become candidate resistance that stops a bounce.

## What it tells you

The depth of the retracement gives a read on the state of the trend.

- Within 38.2%: a shallow pullback, read as a strong trend.
- 38.2 to 50%: an ordinary pullback.
- 50 to 61.8%: a deep pullback. The trend is alive but has weakened.
- 61.8 to 78.6%: a zone where it becomes questionable whether the trend holds.
- A close beyond 78.6%: the trend has probably broken.

A Fibonacci line is not a place where price must stop. It is a place many market participants are watching together. In Batchelor and Ramyar's 2006 study, Dow Jones trend ratios also did not cluster on Fibonacci values more than chance would explain. So lines that overlap prior swings, moving averages or high-volume price zones are given more weight. Extension lines are target zones, not entry signals.

## How Siglens detects it

Siglens picks swings by a fixed rule instead of by hand. A swing high is the bar with the highest high among the 5 bars on each side, and a swing low is the bar with the lowest low.

- For each of the short, medium and long ranges (the last 20, 60 and 200 bars on a daily chart), it takes the most recent swing high and swing low. If the low comes first, it is an upswing; if the high comes first, a downswing.
- For each range, it calculates prices for 5 retracements (23.6 to 78.6%) and 5 extensions (100 to 261.8%). On the chart it draws the five retracements plus the 127.2% and 161.8% extensions.
- **A-B-C extension**: calculated only when the last three swings alternate between high and low and C is a retracement that stopped between A and B. The A-B distance is measured again from C to make target zones such as 100%, 127.2% and 161.8%. If the retracement is still in progress, none is made.

For interpretation, a spot where lines from different ranges overlap, or where they meet horizontal support or resistance or a major moving average, is treated as a stronger zone (a cluster). Conversely, when several lines sit within 1% of each other, it is unclear which line is the reference. A close beyond the 78.6% retracement line is read as a likely trend break.

## Watch out for

- One level alone is weak. It gains weight when confirmation overlaps, such as a reversal candle, an [RSI divergence](/guide/strategies/divergence) or falling volume.
- The lines change depending on which swing you pick. Lines drawn on a small swing mean little.
- If the A-B distance is small or unclear, the extension targets are hard to trust.
- Near 261.8%, the trend has run very far, and many traders watch for signs of exhaustion.
- Price reacts in a zone around the line, not at a single point on it.
