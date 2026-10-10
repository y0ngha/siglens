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

## What it looks like

The lows hold at a nearly flat horizontal line, while each high comes in lower than the last. With a flat bottom and a falling top, price gets squeezed into a narrowing triangle. It is an [ascending triangle](/guide/chart-patterns/ascending-triangle) flipped upside down.

## What it tells you

Buyers step in at the same price every time, but each bounce tops out lower. Selling pressure looks like it is building, so textbooks lean toward the support line breaking.

The actual counts differ a little. According to Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results, 53% broke upward, making direction close to even. He also reports that its performance has dropped by almost half since the 1990s. So it is read as bearish only after a close below the flat support line; before that, it is safer to treat both directions as open.

## How it differs from an ascending triangle

Unlike the [ascending triangle](/guide/chart-patterns/ascending-triangle), which broke upward 63% of the time, the descending triangle tells you little about direction. The share that failed to move far enough after the breakout (the break-even failure rate) was similar: 22% for upward breakouts and 23% for downward ones. The price target was reached 64% of the time upward and 50% downward.

Bulkowski ranked 39 bullish and 36 bearish patterns separately by how far price went afterward. A descending triangle that broke down ranked 15th among bearish patterns, around the middle, while one that broke up ranked 33rd among bullish patterns, near the bottom. So once it breaks down, the move afterward has been fairly useful, but until it breaks there is little basis for calling a decline in advance.

If the flat support lines up with a major long-standing support level and is being tested for the first time, a bounce becomes more likely. Breakouts between 50% and 75% of the way through the triangle were the most reliable, and if a rally after the break fails to reclaim the old support, the bearish case gets stronger.

## How Siglens finds it

Siglens connects clear turning points (swings: highs and lows where price reversed more than 1.5 times [ATR](/guide/indicators/atr), the average range of recent bars) into upper and lower boundary lines, and checks for a flat bottom and a falling top that narrow together. It starts with the latest 5–8 swings and, if the same shape holds, extends back to earlier swings (up to 16).

- The upper line falls at least 1.5 ATR over the pattern.
- The lower line is flat: it moves less than the smaller of 0.75 ATR and 1% of price across the pattern.
- Each line is touched at least twice. A swing within 0.35 ATR of a line counts as a touch.
- No bar inside the span pokes more than 0.25 ATR outside the lines.
- The end width narrows to 0.7× the starting width or less.
- It spans at least 15 bars, and the width at the first touch (the pattern height) is at least 2.5 ATR and at least a minimum share of price (0.5% on 5–30 minute bars, 1% on 1–4 hour bars, 3% on daily bars).

Following the textbook direction, Siglens computes the measured target as the support line minus the pattern height, and the conservative target as the support line minus half the height. This is a calculation rule, not a direction forecast. A target is the price reached if price moves another pattern height; it is a reference drawn from past cases, not a promise. Only about half of past cases actually got that far. The invalidation level (the price at which the pattern counts as broken) is the last high that touched the upper line. A close above it breaks the bearish pattern.

If a close breaks the support by more than 0.25 ATR and the latest close is back inside the triangle, Siglens marks it as a "failed breakout."

## Watch out when

- If either line has fewer than two touches, it is hard to call it a triangle.
- Breakouts near or past the apex tend to be weak.
- If it forms in a sideways range with no prior downtrend, the signal is rated lower.
- A close above the upper line means the bearish pattern has failed. This is called a bear trap, and some read it as a sign price has turned up.
- If volume stays high instead of fading as the range narrows, the breakout signal is rated lower.
