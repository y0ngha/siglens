---
title: CMF
aliases: [Chaikin Money Flow, CMF indicator, money flow indicator]
summary: Weights where each bar closes within its range by volume over a set period, showing on a -1 to +1 scale whether money is flowing in or out.
seoTitle: "CMF Indicator: Chaikin Money Flow Zero Line"
seoDescription: What it means when Chaikin Money Flow (CMF) crosses zero or ±0.25, how to use it to confirm breakouts, and the distortion from gaps and trading halts.
demoCaption: Synthetic, illustrative bars. Closes keep landing in the upper part of the bar, and CMF rises through the zero line.
faq:
  - q: What does a CMF above 0 mean?
    a: Over the last 21 bars, days that closed in the upper part of the bar outweighed the others on volume. It is read as accumulation, with money flowing in.
  - q: How large does CMF need to be to matter?
    a: Above +0.25 or below -0.25 is seen as a clear direction. Values near the theoretical limit of ±1 almost never occur, and readings beyond ±0.4 are fairly rare.
  - q: Can I change the CMF period?
    a: The standard is 21 bars. On shorter charts 10 bars is more sensitive, and on weekly charts 40 bars is said to be smoother.
---

## How it's calculated

CMF (Chaikin Money Flow) was created by Marc Chaikin. First, find the close location value (CLV) for each bar. It is positive when the close is near the high, negative when near the low, and 0 when exactly in the middle. Multiply that by volume, add it up over the period, and divide by the total volume over the same period. The default period is 21 bars, and the value falls between -1 and +1.

Put simply, it averages whether the days with heavy trading closed in the upper or lower part of their range.

## What it tells you

- Positive CMF: accumulation, where days closing in the upper part dominate on volume.
- Negative CMF: distribution (selling), where closes in the lower part dominate.
- The size matters too. +0.25 shows much stronger buying pressure than +0.05, and beyond ±0.25 the direction is seen as clear.

Crossing above the zero line is an early sign of a shift from net selling to net buying, and crossing below is the reverse. If the cross holds for several bars, you can trust it as a change in flow rather than temporary noise.

It's also used to confirm breakouts. If CMF is positive and rising as price breaks resistance, buyers backed the breakout. If it's negative or turning down, the breakout lacks volume conviction and is more likely false. If price makes lower lows while CMF lows rise, that is a divergence showing selling pressure easing. CMF staying above 0 for a long time means volume supports the rise, and hovering near 0 suggests a directionless sideways market.

## How Siglens detects it

Siglens flags CMF(21) crossing the zero line from below within the last 3 bars as an accumulation shift, and crossing from above as a distribution shift. It doesn't conclude that flow has changed from a single cross. It also checks whether CMF stays above (or below) the zero line for the next few bars.

When confirming other signals, it is used like this.

- For breakouts from patterns such as triangles and boxes, it is trusted only when CMF points the same way.
- A [MACD](/guide/indicators/macd) golden cross with positive CMF is a momentum shift backed by money flow.
- [OBV](/guide/indicators/obv) rising and CMF also positive means the two volume-based views agree.

## Watch out for

- If the close is exactly in the middle of the bar, that bar contributes 0 no matter how large the volume.
- When an extreme bar from 21 bars ago leaves the calculation window, CMF can change suddenly. That can be the effect of the old bar dropping out, not a new flow.
- It doesn't capture gaps. After a gap up, a close near the low of a narrow range shows negative even in a rising market.
- On days like limit-up, limit-down or trading halts, the close is pinned at one price and CLV comes out extreme. Trust CMF less over a stretch that includes such bars.
