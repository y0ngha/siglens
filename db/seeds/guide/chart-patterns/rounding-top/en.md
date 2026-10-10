---
title: Rounding Top
aliases: [Dome Top, Rounded Top, Dome Pattern, Inverted Saucer]
summary: A gentle dome-shaped top, up slowly and back down slowly. A close below the lower rim is read as a turn down.
seoTitle: Rounding Top (Dome) Pattern Explained
seoDescription: The dome shape of a rounding top and how to confirm a break below its rim, plus the cases where the dome breaks upward and other false signals.
demoCaption: Synthetic, illustrative bars. Shows a gentle dome-shaped top, both rims, and a bar closing below the rims.
faq:
  - q: Does a rounding top always lead to a decline?
    a: No. The dome shape alone is not a bearish signal. It is confirmed only when a close falls below the lower rim, and Thomas Bulkowski said that cases breaking out above the dome also performed well.
  - q: How is a rounding top different from a double top?
    a: A double top has two distinct sharp highs, while a rounding top has highs joined in one gentle curve. SIGLENS treats it as rounded only if the curve explains at least 60% of the movement in the closes.
  - q: Does price usually fall all the way to the target after the breakdown?
    a: Rarely. In Thomas Bulkowski's tabulation, only 14% of rounding tops that broke downward reached their target. So it is more realistic to treat about half of that (the conservative target) as the reference.
---

## How it looks

Price rises slowly, stays flat at the top for a while, and then comes down slowly, forming a dome (an upside-down bowl). It is a gentle curve, not a sharp spike up and down. The lows at the two ends of the dome are the rims, and they sit at similar prices. It is a [rounding bottom](/guide/chart-patterns/rounding-bottom) flipped upside down.

## What it tells you

Buying pressure fades slowly and selling pressure builds slowly, so control changes hands gradually. Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in books, described the standard form as one with an uptrend leading into the pattern. When it appears at the end of an uptrend, it is read as a candidate for a turn down.

The pattern completes only when a close falls below the lower of the two rims. Until then it is just a candidate. A dome does not always lead to a decline, either: in Bulkowski's tabulation, cases that broke upward actually performed better (went further after the breakout). He said taller patterns and heavier volume on the rim break both went with better performance. The two rims act as support zones, where a falling price tends to stall.

## How SIGLENS detects it

SIGLENS takes two clearly turned lows (swing lows: turning points from which price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average size of recent bars' moves) as the two rims of the dome. It fits an upside-down U curve to the closes between them, and if the curve follows the actual price path closely, it treats the shape as a rounding top. The conditions:

- The two rims must be at least 30 bars apart.
- The rim prices must be within 5% of each other and no more than 25% of the dome's height apart.
- Leaving out the legs up from and back down to the rims, no bar inside the dome may fall below the higher rim by more than 0.25 times ATR.
- The curve must open downward, and both its peak and the actual highest point must sit in the middle half of the span in time.
- The curve must match the actual closes well: a single curve must explain at least 60% of the closes' ups and downs.
- Dome shape: at least 40% of the closes must sit in the top third of the dome's height. Sharp spike-and-collapse shapes drop out here.
- The height (from the higher rim to the peak) must be at least 2.5 times ATR and also at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

A prior uptrend is not required. The breakdown level is the lower of the two rims. The measured target subtracts the dome's height from it, and the conservative target subtracts half. The target is the price reached if the move repeats the pattern's height; it is a reference value, not a promise. Rounding tops that broke downward in particular rarely reached it. The invalidation level is the price at which the pattern is considered broken: the most recent swing high on the right side after the peak (or the peak itself if there is none).

## Watch out for

- When the right rim is higher than the left, performance was reportedly worse.
- If price climbs back to the broken rim after the breakdown (a pullback), later performance was reportedly worse. Such pullbacks are common after downward breaks.
- If the peak sits near either end of the span, or it is a sharp spike rather than a curve, it is not a rounding top.
- The dome shape alone is still only a candidate. Until a close falls below the lower rim, an upward break remains possible.
