---
title: Rounding Bottom
aliases: [Saucer Bottom, Saucer Pattern, Rounded Bottom, Bowl Pattern]
summary: A gentle saucer-shaped bottom. A close above the rim height is read as a turn up.
seoTitle: Rounding Bottom (Saucer) Pattern Explained
seoDescription: What a rounding bottom (saucer) looks like, how it differs from a cup and handle, how long it takes to form, and how Siglens checks the curve.
demoCaption: Synthetic, illustrative bars. Shows a gentle saucer-shaped bottom, both rims, and a bar moving above the left rim's height.
faq:
  - q: How is a rounding bottom different from a cup and handle?
    a: A rounding bottom has no handle, and it does not require a prior advance. Siglens allows a rim price difference of up to 5% for a rounding bottom, but a more generous 7% for a cup and handle.
  - q: How long does a rounding bottom take to form?
    a: On daily bars it usually takes several months and sometimes years. It needs at least 30 bars, and one lasting more than 50 bars is considered more reliable.
  - q: When is a rounding bottom considered complete?
    a: When a close finishes above the rim height. Textbooks use the left rim as the reference; Siglens uses the higher of the two rims. Calling it a bottom while it is still forming may be too early.
---

## How it looks

Price slides down gently, stays at the bottom for a while, and then climbs back gently. Because of its shape it is also called a saucer. The left and right rims are at similar heights, and the turn is smooth rather than abrupt.

## What it tells you

Selling pressure fades gradually while buying builds gradually, so control slowly changes hands. Ideally volume also draws a U like price: it falls on the left, is lowest at the bottom, and rises again on the right.

The pattern completes when the close moves above the left rim's height. It is considered more reliable if volume rises at that point. In Thomas Bulkowski's tabulation, the rounding bottom ranked 7th among 39 patterns. He said the trend before this pattern was up in 67% of cases. That means it more often shows up as a pause during an advance than only at the end of a decline.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar), and uses two swing highs as the two rims of the saucer. It fits a parabola to the closes between them and checks whether the shape is a saucer.

- The two rims must be at least 30 bars apart.
- The price difference between the rims must be within 5% and at most 25% of the saucer's depth. Anything looser would let W-shaped bottoms be picked up as rounding bottoms, so Siglens keeps 5%.
- No bar inside the saucer may rise above the lower rim by more than 0.25 times ATR. The legs coming down from and back up to the rims are excluded from this check.
- The parabola must open upward, and both the parabola's bottom and the actual lowest point must fall in the middle half of the saucer in time.
- The parabola must fit the actual closes well: it must explain at least 60% of the movement in the closes (R² of 0.6 or higher).
- U-shape condition: at least 40% of the closes must lie in the lower third of the saucer's depth.
- The depth (from the lower rim to the bottom) must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).
- If the right rim is too far back, it is not shown. The cutoff is the longer of the last 20 bars and half the pattern's length.

Unlike the cup and handle, Siglens does not require a prior advance. The breakout level is the higher of the two rims. The measured target is that level plus the saucer's depth, and the conservative target is that level plus half the depth. The invalidation level is the most recent swing low on the right side after the bottom (the bottom itself if there is none).

## Watch out for

- A sharp V-shaped bottom is not a rounding bottom.
- If stretches of fast price movement are mixed in, the rounded shape breaks down.
- If the right rim is more than 5% lower than the left, it is considered less reliable.
- If volume is flat or erratic instead of forming a U, it is considered less reliable.
- Because the pattern takes months to form, calling it a bottom before price clears the rim may be too early.
