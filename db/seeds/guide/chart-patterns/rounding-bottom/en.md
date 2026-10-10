---
title: Rounding Bottom
aliases: [Saucer Bottom, Saucer Pattern, Rounded Bottom, Bowl Pattern]
summary: A gentle saucer-shaped bottom. A close above the rim height is read as a turn up.
seoTitle: Rounding Bottom (Saucer) Pattern Explained
seoDescription: The saucer shape of a rounding bottom, how to confirm a break above its rim, and why it helps to check whether volume also traces a U.
demoCaption: Synthetic, illustrative bars. Shows a gentle saucer-shaped bottom, both rims, and a bar moving above the higher of the two rims.
faq:
  - q: How is a rounding bottom different from a cup and handle?
    a: A rounding bottom has no handle, and it does not require a prior advance. SIGLENS allows a rim price difference of up to 5% for a rounding bottom, but a more generous 7% for a cup and handle.
  - q: How long does a rounding bottom take to form?
    a: On daily bars it usually takes several months and sometimes years. It needs at least 30 bars, and one lasting more than 50 bars is more reliable.
  - q: When is a rounding bottom considered complete?
    a: When a close finishes above the higher of the two rims. Calling it a bottom while it is still forming may be too early.
---

## How it looks

Price slides down gently, stays at the bottom for a while, and then climbs back gently. Because of its shape it is also called a saucer. The left and right rims are at similar heights, and the turn is smooth rather than abrupt.

## What it tells you

Selling pressure fades slowly and buying pressure builds slowly, so control changes hands gradually. Ideally volume traces a U as well: it shrinks on the left, is lowest at the bottom, and rises again on the right.

The pattern completes only when a close finishes above the higher of the two rims. Rising volume at that point makes it more reliable.

Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in books, placed the rounding bottom 7th of 39 bullish patterns in his performance ranking (a ranking by how far price went after the breakout). He also found that the trend leading into this pattern was upward 67% of the time. In other words, it does not only appear at the end of a decline; more often it shows up as a pause within an advance.

## How SIGLENS detects it

SIGLENS takes two clearly turned highs (swing highs: turning points from which price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average size of recent bars' moves) as the two rims of the saucer. It fits a U-shaped curve to the closes between them, and if the curve follows the actual price path closely, it treats the shape as a rounding bottom. The conditions:

- The two rims must be at least 30 bars apart.
- The rim prices must be within 5% of each other and no more than 25% of the saucer's depth apart. A looser match would also catch W-shaped bottoms, so the limit stays at 5%.
- Leaving out the legs down from and back up to the rims, no bar inside the saucer may rise above the lower rim by more than 0.25 times ATR.
- The curve must open upward, and both its low point and the actual lowest point must sit in the middle half of the span in time.
- The curve must match the actual closes well: a single curve must explain at least 60% of the closes' ups and downs.
- U shape: at least 40% of the closes must sit in the bottom third of the saucer's depth. Sharp V shapes drop out here.
- The depth (from the lower rim to the bottom) must be at least 2.5 times ATR and also at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Unlike a cup and handle, a prior advance is not required. The breakout level is the higher of the two rims. The measured target adds the saucer's depth to it, and the conservative target adds half. The target is the price reached if the move repeats the pattern's height; it is a reference value because past moves often went that far, not a promise that price will get there. The invalidation level is the price at which the pattern is considered broken: the most recent swing low on the right side after the bottom (or the bottom itself if there is none).

## Watch out for

- A sharp V-shaped bottom is not a rounding bottom.
- If abrupt moves are mixed in, the rounded shape breaks down.
- If the right rim is more than 5% below the left, the saucer is not really complete and reliability drops.
- If volume is flat or erratic instead of tracing a U, there is little evidence of steady buying.
- Because the pattern takes months to form, calling a bottom before price clears the rim may be too early.
