---
title: Bull Flag
aliases: [Bullish Flag, Bull Flag Pattern, Rising Flag]
summary: A sharp rise (pole) and a gentle pause on fading volume (flag). A break above it suggests the rise continues.
seoTitle: "Bull Flag Pattern: How to Read It"
seoDescription: A bull flag is a pause on shrinking volume after a sharp rise. Learn the flag's retracement limits and how to confirm a break above the upper line.
demoCaption: Synthetic, illustrative bars. Shows a sharp rise (the pole), a gently falling flag channel, and a bar closing above the channel.
faq:
  - q: What does a bull flag look like?
    a: A sharp rise over a short period (the pole) is followed by a section where price drifts down slightly or moves sideways between two parallel lines (the flag). If the flag retraces more than half the pole, it is not treated as a bull flag.
  - q: How reliable is a bull flag?
    a: The shape is distinct, but the results after a breakout are modest. In Thomas Bulkowski's tabulation, fewer than half of flags (46%) reached their target.
  - q: How is a bull flag different from a pennant?
    a: In a flag the two lines run parallel; in a pennant they converge and narrow. SIGLENS calls it a pennant if the final width narrows to 0.7 times the starting width or less, and a flag if it is wider than that.
---

## How it looks

First comes a sharp rise over a short period. That is the pole. After it, price drifts down slightly or moves sideways between two parallel lines. That is the flag. Volume usually drops noticeably during the flag.

## What it tells you

It reads as a brief rest driven by profit-taking after a surge. A gentle pullback on fading volume means selling pressure is light, so a move above the flag's upper line is read as the earlier rise continuing.

The pattern completes only when the close finishes above the flag's upper line. Volume returning to pole levels at that point gives the signal more weight. The shape counts as better when the pole rises 10% or more, the flag retraces less than 38.2% of the pole, and the whole flag lasts a short 1 to 2 weeks.

In the combined tabulation of bull and bear flags by Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in his books, 46% reached their target. A target is the price reached if the move extends by the length of the pole: a reference value based on how often past patterns went that far, not a promise. The invalidation level is the price at which the pattern is considered broken.

## How it differs from a bear flag

Bulkowski pooled bull flags and [bear flags](/guide/chart-patterns/bear-flag) in one tabulation. For upward breakouts, the break-even failure rate (the share that did not travel far enough after the breakout) was 44%, and the average rise after the breakout was 9%. Bear flags came in at a 45% failure rate and an 8% average decline, nearly the same. Across all flags, 60% broke upward, but keep in mind that every case was collected in a bull market.

In a bull flag, the flag is a rest driven by profit-taking after the surge. So when volume during the flag drops below half of the pole's volume, the case for a pause gets stronger. If the flag slopes upward and starts to resemble a [rising wedge](/guide/chart-patterns/ascending-wedge), it may be a weakening trend rather than a normal pause. A flag that runs past 4 weeks may be turning into a [rectangle](/guide/chart-patterns/rectangle) or a [descending channel](/guide/chart-patterns/descending-channel).

## How SIGLENS detects it

SIGLENS looks for clearly turning highs and lows (swings: turning points where price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average range of recent bars) and uses the surge from a swing low to the next swing high as the pole. When a narrow channel that drifts down or sideways follows, it treats the shape as a bull flag.

- Pole: it must rise at least 3 times ATR within 20 bars and also exceed a set share of price (for example, 3% on daily bars).
- Flag length: 5 to 20 bars after the pole top.
- Retracement: it must not retrace more than 50% of the pole, and no bar may rise above the pole top by more than 0.5 times ATR.
- The flag's starting width must be no more than half the pole's length.
- The flag's upper and lower lines each need at least 2 touches at least 2 bars apart.
- The final width must be more than 0.7 times and no more than 1.15 times the starting width, and neither line may rise by more than the smaller of 0.75 times ATR and 1% of price. If the width narrows to 0.7 times or less, it is treated as a [pennant](/guide/chart-patterns/pennant).
- If the flag ended before the last bar, the very next bar must already be outside the channel. If it stays inside, SIGLENS treats it as a trading range, not a flag.

The measured target is the upper line plus the pole length, and the conservative target adds half the pole length. The invalidation level is the flag's lowest low after the pole top.

If the close breaks above the upper line by more than 0.25 times ATR and the last close then returns inside the channel, SIGLENS marks it as a "failed breakout".

## Watch out for

- If the pole is gentle or slow, it was not a real surge and the flag means less.
- If the flag retraces more than 50% of the pole, it may be a sign that upward momentum is breaking down, not a pause.
- If volume stays high during the flag, it may not be a rest; supply may be coming out.
- If volume on the breakout bar is as light as during the flag, the breakout may be false.
