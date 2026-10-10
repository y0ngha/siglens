---
title: Pennant
aliases: [Pennant Pattern, Bullish Pennant, Bearish Pennant, Triangular Flag]
summary: A small narrowing triangle after a sharp move (the pole). A break in its direction suggests continuation.
seoTitle: "Pennant Pattern: How to Read It"
seoDescription: How a pennant, a short pause in a small triangle after a sharp move, differs from a flag and a symmetrical triangle, and how to confirm the breakout with volume.
demoCaption: Synthetic, illustrative bars. Shows a sharp pole, a small narrowing triangle, and a bar closing above the triangle.
faq:
  - q: How do I tell a pennant from a symmetrical triangle?
    a: If a steep pole comes before it, it is a pennant; if not, it is a symmetrical triangle. A pennant is usually short, 1 to 3 weeks, while a symmetrical triangle can run from several weeks to several months.
  - q: Do pennants only form in uptrends?
    a: No. After a sharp rise it is a bullish pennant, and after a sharp drop it is a bearish pennant. Either way, what matters is whether price breaks out in the direction of the pole.
  - q: How reliable is a pennant?
    a: Its performance is not strong. In Thomas Bulkowski's tabulation, only about a third reached their target, both up and down. Many traders also look at volume at the breakout and at the trend before the pattern.
---

## How it looks

After a steep rise or drop (the pole), a small triangle forms with falling highs and rising lows. That is the pennant. If a flag is a rest between two parallel lines, a pennant is a rest between two lines that converge and narrow.

## What it tells you

It reads as a brief breather after a sharp move. Volume drops sharply as the price range narrows, and when price breaks out in the same direction as the pole, the earlier move is read as continuing.

The pattern completes when the close leaves the triangle in the direction of the pole and volume returns to normal levels or higher. It is considered more reliable if the pole is 10% or more, the retracement is under 25% of the pole, the pattern lasts a short 1 to 2 weeks, and volume has fallen by more than 60% from the pole.

A pennant is often said to come about halfway through the whole move, so people expect another move as large as the pole after it. But in Thomas Bulkowski's tabulation, the pennant came about halfway through the move only about 30% of the time.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar), and uses two consecutive swings as the start and end of the pole. It searches the same way as for a flag, and tells a pennant apart by how much the two lines of the pause narrow.

- Pole: a move of at least 3 times ATR within 20 bars, and also more than a set share of price (for example 3% on daily bars).
- Pause: 5 to 20 bars after the pole's end. It must not retrace more than 50% of the pole, and no bar may go beyond the pole's end by more than 0.5 times ATR.
- The two lines are drawn through the minor highs and lows of the bars in the pause. Each line needs at least 2 touches that are 2 or more bars apart, and the starting width must not exceed half the pole's length.
- If the width narrows to 0.7 times or less from the first touch to the last, the upper line does not rise by 1.5 times ATR or more, and the lower line does not fall by 1.5 times ATR or more, it is a pennant. If the two lines run parallel, it is a [bull flag](/guide/chart-patterns/bull-flag) or [bear flag](/guide/chart-patterns/bear-flag).
- Whether it is a flag or a pennant is decided by the shortest section that first meets the conditions, so the name does not change as more bars build up.
- If the pause ended before the last bar, the very next bar must have moved outside the lines. If it stays inside, Siglens treats it as a sideways range, not a pennant.

Direction follows the pole. The measured target is the pole's length projected from the line on the breakout side, and the conservative target is half of that. The invalidation level is the lowest low of the pause (the highest high for a bearish pennant).

After the breakout, the pattern stays on the chart for a while: 20 bars after the pause ends, or half the length from the pole's start to the pause's end, whichever is longer. If the close moves beyond the breakout line by more than 0.25 times ATR and the last close then returns inside, Siglens marks it as a "failed breakout". If two lines converge with no pole, it is a [symmetrical triangle](/guide/chart-patterns/symmetrical-triangle).

## Watch out for

- If the pole is gentle, the move was not sharp and it is hard to call it a pennant.
- A pennant lasting more than 3 weeks is less likely to behave as a continuation.
- If the retracement is more than 38.2% of the pole, it is considered less reliable, and above 50% it is much weaker.
- If volume stays high during the pennant, it may not be a rest.
- A break in the direction opposite to the pole is considered less reliable.
