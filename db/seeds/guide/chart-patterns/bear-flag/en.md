---
title: Bear Flag
aliases: [Bearish Flag, Bear Flag Pattern, Falling Flag]
summary: A sharp drop (pole), then a weak bounce on fading volume (flag). A break below it suggests the fall continues.
seoTitle: "Bear Flag Pattern: How to Read It"
seoDescription: The pole and flag of a bear flag, its retracement and volume conditions, and how to confirm a break below the lower line.
demoCaption: Synthetic, illustrative bars. Shows a sharp drop (the pole), a gently rising flag channel, and a bar closing below the channel.
faq:
  - q: What does a bear flag look like?
    a: A sharp drop over a short period (the pole) is followed by a section where price drifts up slightly or moves sideways between two parallel lines (the flag). If the flag retraces more than half the pole, it is not treated as a bear flag.
  - q: How reliable is a bear flag?
    a: The shape is distinct, but the results after a breakout are modest. In Thomas Bulkowski's tabulation, fewer than half of flags (46%) reached their target.
  - q: How does it relate to a bull flag?
    a: It is the mirror image. A bull flag is a break upward out of a rest after a sharp rise; a bear flag is a break downward out of a brief bounce after a sharp drop.
---

## How it looks

First comes a sharp drop over a short period. That is the pole. After it, price drifts up slightly or moves sideways between two parallel lines. That is the flag. It is a [bull flag](/guide/chart-patterns/bull-flag) turned upside down.

## What it tells you

It reads as a brief bounce, a breather after a sharp fall. A weak rise on fading volume means buying is not strong, so a break of the flag's lower line is read as the earlier decline continuing.

The pattern completes when the close finishes below the flag's lower line. It is more convincing if volume returns to pole levels at that point. It is also viewed more favorably when the pole falls 10% or more, the flag retraces less than 38.2% of the pole, and the whole flag lasts a short 1 to 2 weeks. In Thomas Bulkowski's combined tabulation of bull and bear flags, 46% reached their target.

## How it differs from a bull flag

After breaking the lower line, bear flags had a break-even failure rate (the share that ended without moving far enough in the breakout direction) of 45% and an average decline of 8%. That is nearly the same as the [bull flag](/guide/chart-patterns/bull-flag)'s 44% and 9%. But Bulkowski's sample comes from a bull market, and with both flags pooled, 60% broke upward. There is no direction split for bear flags alone, so until the lower line breaks, it is wise to keep an upward resolution in mind.

In a bear flag, the flag is not a profit-taking rest but a brief technical bounce after the plunge. So volume should shrink during the bounce; if it grows instead, bargain hunters may be accumulating. If the pole ended at a major long-standing support level, the flag can turn into a base rather than a pause before more decline. A flag that slopes downward may be ongoing capitulation (panic selling all at once) rather than a rest. A flag that runs past 4 weeks loses its bounce character and may be shifting into a base.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar), and uses consecutive swing highs and lows as the start and bottom of the pole.

- Pole: a drop of at least 3 times ATR within 20 bars, and also more than a set share of price (for example 3% on daily bars).
- Flag: 5 to 20 bars after the pole's bottom. It must not retrace more than 50% of the pole, and no bar may fall below the pole's bottom by more than 0.5 times ATR. The flag's starting width must be at most half the pole's length.
- The two flag lines are drawn through the minor highs and lows of the bars in the flag. Each line needs at least 2 touches that are 2 or more bars apart.
- It is a flag if the final width is more than 0.7 times and at most 1.15 times the starting width, and neither line moves down by more than the smaller of 0.75 times ATR and 1% of price. If the width narrows to 0.7 times or less, it is treated as a [pennant](/guide/chart-patterns/pennant).
- Whether it is a flag or a pennant is decided by the shortest flag that first meets the conditions, so the name does not change as more bars build up.
- If the flag ended before the last bar, the very next bar must have moved outside the channel. If it stays inside the channel, Siglens treats it as a sideways range, not a flag.

The measured target is the lower line minus the pole's length, and the conservative target is the lower line minus half the pole's length. The invalidation level is the highest high of the flag after the pole's bottom.

After the breakout, the pattern stays on the chart for a while: 20 bars after the flag ends, or half the length from the pole's start to the flag's end, whichever is longer. If the close breaks below the lower line by more than 0.25 times ATR and the last close then returns inside the channel, Siglens marks it as a "failed breakout".

## Watch out for

- If the pole is gentle or slow, the drop was not panic-driven and the flag means less.
- If the flag retraces more than 50% of the pole, it may be a base forming rather than a simple bounce.
- If volume does not return to pole levels when the lower line breaks, it is hard to say selling pressure has resumed.
