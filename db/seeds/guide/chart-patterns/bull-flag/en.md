---
title: Bull Flag
aliases: [Bullish Flag, Bull Flag Pattern, Rising Flag]
summary: A sharp rise (pole) and a gentle pause on fading volume (flag). A break above it suggests the rise continues.
seoTitle: "Bull Flag Pattern: How to Read It"
seoDescription: What a bull flag looks like, how the pole and flag are measured, how often it hit its target in Bulkowski's data, and how it differs from a pennant.
demoCaption: Synthetic, illustrative bars. Shows a sharp rise (the pole), a gently falling flag channel, and a bar closing above the channel.
faq:
  - q: What does a bull flag look like?
    a: A sharp rise over a short period (the pole) is followed by a section where price drifts down slightly or moves sideways between two parallel lines (the flag). If the flag retraces half the pole or more, it is not treated as a bull flag.
  - q: How reliable is a bull flag?
    a: The shape is distinct, but the results after a breakout are modest. In Thomas Bulkowski's tabulation, fewer than half of flags (46%) reached their target.
  - q: How is a bull flag different from a pennant?
    a: In a flag the two lines run parallel; in a pennant they converge and narrow. Siglens calls it a pennant if the final width narrows to 0.7 times the starting width or less, and a flag if it is wider than that.
---

## How it looks

First comes a sharp rise over a short period. That is the pole. After it, price drifts down slightly or moves sideways between two parallel lines. That is the flag. Volume usually drops noticeably during the flag.

## What it tells you

It reads as a brief pause after a surge, while some holders take profits. A gentle pullback on fading volume means selling pressure is not heavy, so a break above the flag's upper line is read as the earlier advance continuing.

The pattern completes when the close finishes above the flag's upper line. It is more convincing if volume returns to pole levels at that point. It is also viewed more favorably when the pole rises 10% or more, the flag retraces less than 38.2% of the pole, and the whole flag lasts a short 1 to 2 weeks. In Thomas Bulkowski's combined tabulation of bull and bear flags, 46% reached their target.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar), and uses consecutive swing lows and highs as the bottom and top of the pole.

- Pole: a rise of at least 3 times ATR within 20 bars, and also more than a set share of price (for example 3% on daily bars).
- Flag: 5 to 20 bars after the pole's top. It must not retrace more than 50% of the pole, and no bar may rise above the pole's top by more than 0.5 times ATR. The flag's starting width must be at most half the pole's length.
- The two flag lines are drawn through the minor highs and lows of the bars in the flag. Each line needs at least 2 touches that are 2 or more bars apart.
- It is a flag if the final width is more than 0.7 times and at most 1.15 times the starting width, and neither line moves up by more than the smaller of 0.75 times ATR and 1% of price. If the width narrows to 0.7 times or less, it is treated as a [pennant](/guide/chart-patterns/pennant).
- Whether it is a flag or a pennant is decided by the shortest flag that first meets the conditions, so the name does not change as more bars build up.
- If the flag ended before the last bar, the very next bar must have moved outside the channel. If it stays inside the channel, Siglens treats it as a sideways range, not a flag.

The measured target is the upper line plus the pole's length, and the conservative target is the upper line plus half the pole's length. The invalidation level is the lowest low of the flag after the pole's top.

After the breakout, the pattern stays on the chart for a while: 20 bars after the flag ends, or half the length from the pole's start to the flag's end, whichever is longer. If the close breaks above the upper line by more than 0.25 times ATR and the last close then returns inside the channel, Siglens marks it as a "failed breakout".

## Watch out for

- If the pole is gentle or slow, it was not a real surge and the flag means less.
- If the flag retraces more than 50% of the pole, it may be a sign that upward momentum is breaking down, not a pause.
- If volume stays high during the flag, it may not be a rest; supply may be coming out.
- A flag lasting more than 4 weeks is less likely to behave as a continuation.
- A flag that slopes upward is considered less reliable.
