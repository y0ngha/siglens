---
title: Descending Triangle
aliases: [Falling Triangle, Descending Triangle Pattern]
summary: Lows hold at a flat line while highs keep falling and the range narrows. Direction is close to a coin flip.
seoTitle: "Descending Triangle Pattern: How to Read It"
seoDescription: A descending triangle completes with a drop below its flat support line, yet about half the time it breaks upward instead. Here is how to confirm a support break.
demoCaption: Synthetic, illustrative bars. Shows a flat support line, a falling resistance line, and a bar closing below support.
faq:
  - q: Does a descending triangle always break down?
    a: No. Textbooks call it a bearish pattern, but in Thomas Bulkowski's tabulation 53% broke upward. Judge the direction only after a close moves beyond one of the lines.
  - q: When does it count as a bearish signal?
    a: Only after a close finishes below the flat support line. Before that, it is safer to treat both directions as open.
  - q: How is it different from an ascending triangle?
    a: If the flat line is on top (resistance), it is an ascending triangle; if it is on the bottom (support), it is a descending triangle. In a descending triangle the upper line through the highs slopes down.
---

## How it looks

The lows find support at nearly the same price along a horizontal line, while each high is lower than the one before. With a flat bottom and a falling top, price is squeezed into a narrowing triangle. It is an [ascending triangle](/guide/chart-patterns/ascending-triangle) flipped upside down.

## What it tells you

Buyers hold the same price every time, but each rebound peaks lower. Selling pressure is building, so textbooks put more weight on support breaking.

The actual statistics differ somewhat. In Thomas Bulkowski's tabulation, 53% broke upward, so the direction was nearly 50-50, and performance has reportedly fallen by almost half since the 1990s. So it is safer to read this pattern as bearish only after a close finishes below the flat support line, and to treat both directions as open until then.

## How it differs from an ascending triangle

Unlike the [ascending triangle](/guide/chart-patterns/ascending-triangle), which leans 63% upward, the descending triangle says little about direction. In Bulkowski's tabulation, the break-even failure rate (the share that ended without moving far enough in the breakout direction) was similar both ways: 22% for upward breakouts and 23% for downward ones. 64% of upward and 50% of downward breakouts reached their target.

By rank, downward breakouts did better, at 15th of 36 bearish patterns, than upward ones at 33rd of 39 bullish patterns. So once it breaks down, the move is fairly trustworthy, but before that there is little basis for calling the decline in advance.

If the horizontal support lines up with a major long-standing support level and is being tested for the first time, a bounce becomes more likely. A breakdown is most reliable 50% to 75% of the way to the apex, and if a rally after the breakdown fails to reclaim the old support, the bearish case gets stronger.

## How Siglens detects it

Siglens confirms a swing high or swing low once price has reversed by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). It draws the upper and lower boundaries through the 5 to 8 most recent swings, then extends back to earlier swings (up to 16) as long as the same lines still hold. Each line passes through actual swing extremes.

- The upper line must fall at least 1.5 times ATR.
- The lower line must be flat: across the whole pattern it moves less than the smaller of 0.75 times ATR and 1% of price.
- Both lines must be touched at least twice (a swing counts as a touch if it is within 0.35 times ATR of the line). No bar in the span may poke out past a line by more than 0.25 times ATR.
- The width at the end must have narrowed to 0.7 times the starting width or less.
- It must span at least 15 bars, and the width at the first touch must be at least 2.5 times ATR and at least a set share of price (0.5% on 5- to 30-minute bars, 1% on 1- to 4-hour bars, 3% on daily bars).

Siglens takes the direction of this pattern as down. The measured target is support minus the starting width (the pattern height), and the conservative target is support minus half the height. The invalidation level is the last high that touched the upper line. A close above it means the bearish pattern has failed.

If the close breaks below support by more than 0.25 times ATR and the last close then returns inside the triangle, Siglens marks it as a "failed breakout".

## Watch out for

- If either line has fewer than 2 touches, it is hard to call it a triangle.
- A break near the apex or after it tends to be weak.
- If it forms in a sideways range with no prior downtrend, it is considered less reliable.
- If a close moves above the upper line, the bearish pattern has failed. This is called a bear trap, and some read it as a signal that price has turned upward.
- If volume stays high instead of shrinking during the narrowing, the breakdown signal is weighted lower.
