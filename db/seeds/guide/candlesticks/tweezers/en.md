---
title: Tweezers
aliases: [Tweezers, Tweezers Top, Tweezers Bottom, Tweezer Top, Tweezer Bottom]
summary: Two bars whose highs or lows meet at nearly the same level. Read as a price level to watch.
seoTitle: Tweezer Top and Tweezer Bottom Candlesticks
seoDescription: What tweezer tops and bottoms look like, why they didn't work well as reversal signals, and the conditions under which they still mean something.
demoCaption: Synthetic, illustrative bars made for this explanation. One pair of bars with equal highs (tweezers top) and one pair with equal lows (tweezers bottom).
faq:
  - q: Does price fall after a tweezers top?
    a: Not in the data. In Thomas Bulkowski's data a bearish reversal followed a tweezers top only 44% of the time, and upward continuation was actually 56%.
  - q: When do tweezers matter?
    a: When the equal level overlaps a known support or resistance, and a later close moves away from that level.
---

## How it looks

- Tweezers top: a bullish bar followed by a bar whose high equals the prior high. The shared high looks like resistance, so textbooks read it as a bearish reversal at the end of an advance.
- Tweezers bottom: a bearish bar followed by a bar whose low equals the prior low. The shared low looks like support, so it is read as a bullish reversal at the end of a decline.

## What it tells you

Price was stopped at the same level on two attempts. But the fact that it was stopped twice is not enough to say the direction will change.

The counts of Thomas Bulkowski, who tallied what actually happened after patterns across decades of US stock charts and published the results in books, also disagreed with the textbook:

- Tweezers top (about 20,000 cases): only 44% bearish reversal; the advance actually continued 56% of the time.
- Tweezers bottom: 48% bullish reversal; the decline continued 52% of the time.

Both are close to a coin flip.

## How SIGLENS detects it

SIGLENS looks for two bars whose highs or lows meet at nearly the same level.

- Tweezers top: the first bar is bullish, and the two highs are within 0.2% of each other.
- Tweezers bottom: the first bar is bearish, and the two lows are within 0.2% of each other.
- Only the matching high or low is checked, not the preceding trend.
- If the same two bars already fit another two-bar pattern such as an engulfing or harami, that name is used instead.

Because the data doesn't match the textbook reversal reading, SIGLENS doesn't call tweezers a reversal signal and treats them only as a small price zone to watch. They matter when:

- The shared level overlaps a known support or resistance
- Both bars are taller than usual
- A later close leaves the range of the two bars (down for a top, up for a bottom)

## Watch out for

When [ADX](/guide/indicators/adx), which measures trend strength, is below 20 and the market has no clear direction, highs or lows often match by chance, so it is close to noise. Bulkowski found that tweezers were better read as the ongoing trend continuing. SIGLENS does not call a reversal from tweezers alone, and does not draw a price target from these bars.
