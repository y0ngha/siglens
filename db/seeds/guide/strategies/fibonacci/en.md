---
title: Fibonacci Retracement and Extension
aliases: [Fibonacci retracement, Fibonacci extension, Fibonacci levels, 61.8% retracement, golden ratio trading]
summary: Use ratios to estimate where a pullback after a big move may stop and how far the next move may extend.
seoTitle: "Fibonacci Retracement: 38.2%, 50%, 61.8% Levels"
seoDescription: What Fibonacci retracement and extension ratios mean, how to draw them on up and down swings, and how SIGLENS picks swings and calculates the levels.
demoCaption: Synthetic, illustrative candles. Shows a rise from swing low to swing high and the 38.2%, 50% and 61.8% retracement lines across the pullback.
faq:
  - q: Where do you draw Fibonacci retracements?
    a: In an uptrend, take the rise from the swing low to the swing high as the base, and watch what percentage of that rise a pullback (a brief dip during an advance) gives back from the high. In a downtrend, take the fall from the high to the low as the base, and watch where the bounce stalls.
  - q: Is 50% a Fibonacci ratio?
    a: No. 50% is the midpoint and does not come from the Fibonacci sequence. Many traders watch it anyway, so it is drawn alongside the others.
  - q: Do Fibonacci levels actually work?
    a: Evidence that the ratios themselves have predictive power is weak. Part of the reaction comes from many people watching the same price. That is why levels that overlap prior highs and lows or moving averages are given more weight.
---

## What it is

A method of dividing a price range using ratios derived from the Fibonacci sequence. The base is a swing, meaning a stretch where price moved a long way in one direction. The point where the swing started is the swing low (or high), and the point where it ended is the swing high (or low).

- **Retracement**: lines showing how much of a big rise (or fall) gets given back. The ratios are 23.6%, 38.2%, 50%, 61.8% and 78.6%.
- **Extension**: lines showing how far the next move may go after the retracement. The ratios are 100%, 127.2%, 161.8%, 200% and 261.8%. 100% is the same distance as the earlier move.

For example, an upswing from $100 to $150 covers $50. The 38.2% retracement line is $130.90, which is 38.2% of that move ($19.10) below the high. In an uptrend, you watch whether a pullback stops at lines like this, meaning the line acts as support. In a downtrend, lines drawn the same way become candidate resistance that stops a bounce.

## What it tells you

What follows is the traditional reading. SIGLENS uses these lines as background, checking whether they line up with other evidence.

The depth of the retracement gives a read on the state of the trend.

- Within 38.2%: a shallow pullback, read as a strong trend.
- 38.2 to 50%: an ordinary pullback.
- 50 to 61.8%: a deep pullback. The trend is alive but has weakened.
- 61.8 to 78.6%: a zone where it becomes questionable whether the trend holds.
- A close beyond 78.6%: the trend has probably broken.

A Fibonacci line is not a place where price must stop. It is a place many market participants are watching together. In Batchelor and Ramyar's 2006 study, ratios between Dow Jones swings did not cluster near Fibonacci values more often than chance. So lines that overlap prior swings, moving averages or high-volume price zones are given more weight. Extension lines do not tell you when to buy or sell; they are reference lines for gauging where the next move could reach.

## How SIGLENS detects it

SIGLENS picks swings by a fixed rule instead of by hand, so anyone looking gets the same lines.

- A swing high is the bar with the highest high among the 5 bars on each side, and a swing low is the bar with the lowest low among the 5 bars on each side.
- For each of the short, medium and long ranges (the last 20, 60 and 200 bars on a daily chart), it takes the most recent swing high and swing low. If the low comes first, it is an upswing; if the high comes first, a downswing.
- For each range, it calculates prices for 5 retracements (23.6 to 78.6%) and 5 extensions (100 to 261.8%).
- **A-B-C extension**: after a big rise (A to B) and a pullback (B to C), it assumes the same distance plays out once more from C, giving target zones such as 100%, 127.2% and 161.8%. It is calculated only when the last three swings alternate between high and low and C stopped between A and B. If the pullback is still in progress, none is made.

A spot where lines from different ranges overlap, or where a line meets horizontal support or resistance or a major moving average, is treated as a stronger zone (a cluster). But when several lines are packed within 1% of each other, it is hard to decide which line to use as the reference. A close beyond the 78.6% retracement line is read as a likely trend break.

## Watch out for

- One level alone is weak. It gains weight when other evidence overlaps, such as a reversal candle, an [RSI divergence](/guide/strategies/divergence) or falling volume.
- The lines change depending on which swing you use as the base. Lines drawn on a small swing mean little.
- If the A-B distance is small or unclear, the extension targets are hard to trust.
- Near 261.8%, the trend has run very far, and many readings watch for signs that it is running out of steam.
- Price reacts in a zone around the line, not at a single point on it.
