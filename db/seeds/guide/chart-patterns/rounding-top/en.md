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
    a: A double top has two distinct sharp highs, while a rounding top has highs joined in one gentle curve. Siglens treats it as rounded only if the curve explains at least 60% of the movement in the closes.
  - q: Does price usually fall all the way to the target after the breakdown?
    a: Rarely. In Thomas Bulkowski's tabulation, only 14% of rounding tops that broke downward reached their target. So it is more realistic to treat about half of that (the conservative target) as the reference.
---

## How it looks

Price rises slowly, stays flat at the top for a while, and then slides down slowly, forming a dome (an upturned bowl). It is a gentle curve, not a sharp spike up and down. The lows at the two ends of the dome are the rims, and they sit at similar prices. It is a [rounding bottom](/guide/chart-patterns/rounding-bottom) flipped upside down.

## What it tells you

Buying pressure fades gradually while selling builds gradually, so control slowly changes hands. Thomas Bulkowski described the basic form as one that comes after an uptrend. When it appears at the end of an uptrend, it is read as a candidate for a turn down.

The pattern completes when the close falls below the dome's lower rim. Until then it is only a candidate. A dome does not always lead to a decline either: in Bulkowski's tabulation, cases that broke out upward actually performed better. The higher the pattern and the heavier the volume as the rim breaks, the better the performance is said to be. The two rims act as support zones.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar), and uses two swing lows as the two rims of the dome. It fits a parabola to the closes between them and checks whether the shape is a dome.

- The two rims must be at least 30 bars apart.
- The price difference between the rims must be within 5% and at most 25% of the dome's height.
- No bar inside the dome may fall below the higher rim by more than 0.25 times ATR. The legs rising from and coming back down to the rims are excluded from this check.
- The parabola must open downward, and both the parabola's peak and the actual highest point must fall in the middle half of the dome in time.
- The parabola must fit the actual closes well: it must explain at least 60% of the movement in the closes (R² of 0.6 or higher).
- Dome condition: at least 40% of the closes must lie in the upper third of the dome's height. A shape that spikes up and drops back is excluded.
- The height (from the higher rim to the peak) must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).
- If the right rim is too far back, it is not shown. The cutoff is the longer of the last 20 bars and half the pattern's length.

A prior uptrend is not a condition. The breakdown level is the lower of the two rims. The measured target is that level minus the dome's height, and the conservative target is that level minus half the height. The invalidation level is the most recent swing high on the right side after the peak (the peak itself if there is none).

## Watch out for

- If the right rim is higher than the left, performance is said to drop.
- If price climbs back to the broken rim after the breakdown (a pullback), performance afterward is said to be worse. Pullbacks like this are common after downward breaks.
- If the peak is skewed toward either end of the span, or the shape is a sharp spike rather than a curve, it is not a rounding top.
- A dome shape alone is still only a candidate. Until a close falls below the lower rim, an upward break remains possible.
