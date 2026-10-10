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
    a: Its performance is not strong. In Thomas Bulkowski's tabulation, only about a third reached their target, both up and down. That is why volume at the breakout and the trend before the pattern are checked as well.
---

## How it looks

After a steep rise or drop (the pole), a small triangle forms with falling highs and rising lows. That is the pennant. If a flag is a rest between two parallel lines, a pennant is a rest between two lines that converge and narrow.

## What it tells you

It reads as a brief breather after a sharp move. Volume drops sharply as the price range narrows, and when price breaks out in the same direction as the pole, the earlier move is read as continuing.

The pattern completes when the close leaves the triangle in the direction of the pole and volume returns to normal levels or higher. The more of these a pennant has, the more reliable it is considered:

- The pole moved 10% or more.
- The retracement is under 25% of the pole.
- It lasts a short 1 to 2 weeks.
- Volume has fallen by more than 60% from the pole.

A pennant is often said to sit in the middle of the whole move: the pole is the first half, and after the pennant price travels about the pole's length once more. But in the tabulation of Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results in books, the pennant came at the midpoint only about 30% of the time. Expecting another pole-length move after a pennant was more often wrong than right.

## How SIGLENS detects it

SIGLENS takes two clearly turned highs and lows (swings: turning points from which price reversed by more than 1.5 times the [ATR](/guide/indicators/atr), the average size of recent bars' moves) as the start and end of the pole. If the two lines of the pause that follows converge, it is a pennant; if they run parallel, it is a flag. The conditions:

- Pole: a move of at least 3 times ATR within 20 bars, and also more than a set share of price (3% on daily bars).
- Pause: 5 to 20 bars after the pole's end. It must not retrace more than half the pole, and no bar may go beyond the pole's end by more than 0.5 times ATR.
- Two lines: one through the pause's minor highs, one through its minor lows. Each line needs at least 2 touches that are 2 or more bars apart, and the starting width must not exceed half the pole's length.
- Narrowing: from the first touch to the last, the width must shrink to 0.7 times its start or less. If the upper line rises by 1.5 times ATR or more, or the lower line falls by 1.5 times ATR or more, it is not a pennant. If the two lines run parallel, it is a [bull flag](/guide/chart-patterns/bull-flag) or [bear flag](/guide/chart-patterns/bear-flag).
- If the pause has already ended, the very next bar must be outside the lines. If price stays inside, SIGLENS treats it as a sideways range.

Direction follows the pole. The measured target is the pole's length projected from the line on the breakout side, and the conservative target is half of that. The target is the price reached if the move repeats the pole's length; it is a reference drawn from past cases, not a promise that price will get there. The invalidation level is the price at which the pattern is considered broken: the lowest low of the pause (the highest high for a bearish pennant).

If the close moves beyond the breakout line by more than 0.25 times ATR and the last close then returns inside, SIGLENS marks it as a "failed breakout". If two lines converge with no pole, it is a [symmetrical triangle](/guide/chart-patterns/symmetrical-triangle).

## Watch out for

- If the pole is gentle, the move was not sharp and it is hard to call it a pennant.
- A pennant lasting more than 3 weeks is less likely to behave as a continuation.
- If the retracement is more than 38.2% of the pole, reliability drops, and above 50% it is much weaker.
- If volume stays high during the pennant, it may not be a rest.
- A break in the direction opposite to the pole is less reliable.
