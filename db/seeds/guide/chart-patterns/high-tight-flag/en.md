---
title: High Tight Flag
aliases: [HTF, High-Tight Flag, High and Tight Flag]
summary: "A rare continuation pattern: price nearly doubles in two months, pauses shallowly, then clears the pole's top."
seoTitle: "High Tight Flag Pattern: Rules and Reliability"
seoDescription: What a high tight flag is, why it only shows up on daily charts, how the breakout is confirmed, and what Bulkowski's data says about its reliability.
demoCaption: Synthetic, illustrative bars. Shows a sharp pole, a shallow pause, and a bar moving above the pole's top.
faq:
  - q: How is a high tight flag different from an ordinary bull flag?
    a: The pole is far more extreme. Price must rise at least 90% within 40 bars, and the pause must not retrace more than 25% from the pole's top.
  - q: Can it be found on intraday charts?
    a: In practice it only shows up on daily charts. A 90% rise within 40 bars almost never happens on intraday bars.
  - q: How is the breakout confirmed?
    a: Look for a close above the highest high in the pattern (usually the pole's top). Thomas Bulkowski found that clearing only the flag's upper line fails often.
---

## How it looks

It consists of a pole in which price nearly doubles in a short period, followed by a pause that does not give back much. The pause is often not as tidy as a flag or [pennant](/guide/chart-patterns/pennant); it just looks like the advance stalled for a moment. As the name says, price holds tightly at a high level.

## What it tells you

After nearly doubling, there is almost no profit-taking and price stays high. The reading is that holders expect it to go higher and are not selling, so a close above the pole's top is read as the advance continuing. It appears only rarely, in stocks with very strong upward momentum.

In Thomas Bulkowski's tabulation, failures were rare, but its overall performance ranked 30th out of 39. That means the rise after the breakout is often small compared with the pole. The 82% figure for reaching the target is also measured against half the pole's height, not the full height. Performance is said to be better when the flag is tighter and when volume shrinks during the flag.

## How Siglens detects it

Siglens treats a pattern as a high tight flag when all of the following are met. The conditions are so extreme that it effectively appears only on daily charts. If the same pause also meets the conditions for a [bull flag](/guide/chart-patterns/bull-flag) or [pennant](/guide/chart-patterns/pennant), Siglens shows it only as a high tight flag.

- Pole: within 40 bars, price must rise at least 90% from the bottom (the lowest low) to the top (the highest high).
- Pole top: it must be the highest high of the last 31 bars, and no bar in the pole section before it may be higher. This keeps a lower high inside a longer correction from being mistaken for the top.
- Flag: it lasts at least 3 bars after the top and must not retrace more than 25% from the top.
- The top and the flag low must both be confirmed swings. A swing is a turning point confirmed once price reverses by at least 1.5 times the [ATR](/guide/indicators/atr) (the average range of one bar). So even when a breakout above the top appears, the top does not turn into the breakout bar.

A breakout counts when a close is above the highest high in the pattern (usually the pole's top). The measured target is the pole's top plus the pole's height, and the conservative target is the top plus half the height. Bulkowski's 82% is also based on half the pole's height as the target, so it should be compared with the conservative target. The invalidation level is the flag's low.

## Watch out for

- If the flag is loose, with price jumping around or often leaving the boundaries, performance drops.
- The closer the dip gets to the 25% limit, the less reliable it is considered.
- Until there is a close above the pole's top, it is not confirmed. Bulkowski said that in that case price may drift lower or sideways for months.
- Because price has already nearly doubled, the absolute size of price swings inside the flag is large.
- It is common for price to drift back toward the pole's top after the breakout. Bulkowski did not treat that alone as a failure.
