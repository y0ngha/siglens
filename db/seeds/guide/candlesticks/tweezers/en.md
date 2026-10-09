---
title: Tweezers
aliases: [Tweezers, Tweezers Top, Tweezers Bottom, Tweezer Top, Tweezer Bottom]
summary: Two bars whose highs or lows meet at nearly the same level. Read as a price level to watch.
seoTitle: Tweezer Top and Tweezer Bottom Candlesticks
seoDescription: What tweezer top and tweezer bottom candlesticks look like, why they failed as reversal signals in Bulkowski's data, and the conditions that give them meaning.
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

## How Siglens detects it

If the first bar is bullish and the two highs are equal within 0.2%, it is a tweezers top. If the first bar is bearish and the two lows are equal within 0.2%, it is a tweezers bottom. Siglens checks only the equal high or low, not the preceding trend. If the same two bars already fit another two-bar pattern such as an engulfing or harami, that name is used instead.

In Thomas Bulkowski's data, a tweezers top (about 20,000 cases) had only a 44% bearish reversal, with 56% upward continuation. A tweezers bottom had a 48% bullish reversal and 52% downward continuation. Both are close to a coin flip and contradict the textbook reversal reading, so Siglens doesn't call them reversal signals and treats them only as a small price zone to watch.

They matter when:

- The shared level overlaps a known support or resistance
- Both bars are taller than usual
- A later close leaves the range of the two bars (down for a top, up for a bottom)

## Watch out for

In a sideways market ([ADX](/guide/indicators/adx) below 20), highs or lows often match by chance, so it is noise. Bulkowski also said to treat tweezers in the direction of the ongoing trend. Don't call a reversal from tweezers alone, and don't draw a price target from these bars.
