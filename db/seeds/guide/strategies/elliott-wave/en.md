---
title: Elliott Wave
aliases: [Elliott wave theory, Elliott wave count, impulse wave, five-wave structure, wave theory]
summary: A way of counting where price is in a five-wave advance and three-wave correction.
seoTitle: "Elliott Wave Theory: Meaning and How to Count"
seoDescription: The five-wave and three-wave structure, the three rules a count must not break, and how Siglens counts waves and sets the invalidation price.
demoCaption: Synthetic, illustrative candles. Shows waves 1 to 5 up, the wave 2 and 4 corrections, and the wave 1 start that wave 2 must not break.
faq:
  - q: Does Elliott wave predict future prices?
    a: It is closer to a framework for describing the structure price is in than a forecasting tool. Two people can count the same chart differently, and a count often becomes clear only afterward. That is why Siglens shows alternate counts and an invalidation price alongside the main count.
  - q: What are the three Elliott wave rules?
    a: Wave 2 does not go below the start of wave 1. Wave 3 cannot be the shortest of waves 1, 3 and 5. Wave 4 does not enter the price territory of wave 1. If any rule is broken, the count is considered wrong. The only exception to the wave 4 rule is the diagonal.
  - q: Do the Fibonacci ratios have to match exactly?
    a: No. Ratios such as wave 2 retracing about 50 to 61.8% of wave 1 are reference points only. A matching ratio alone is not a reason to set a price.
---

## What it is

Ralph Nelson Elliott laid out the theory in the 1930s. It holds that price repeats a pattern of five waves in the larger direction followed by three waves that retrace it.

- A five-wave structure made of trend-direction waves (1, 3, 5) and retracing waves (2, 4) is called an impulse.
- After the impulse ends, a correction follows in three waves, A, B and C.
- Wave 3 is often the longest and strongest. Wave 5 is weaker than wave 3, so a [divergence](/guide/strategies/divergence) often shows up there.

Corrections come in shapes such as zigzags, flats and triangles. Waves 2 and 4 tend to differ in form: when one retraces sharply, the other tends to move sideways.

## What it tells you

It works as a map for judging whether price is in the early part of a trend (waves 1 to 3), near the end (wave 5), or in a correction (A, B, C). During wave 3, the trend is read as still having strength. If momentum fades in wave 5, that is read as a zone to prepare for a correction.

Wave counting involves a lot of subjectivity, though. Academic research also found no evidence that Dow Jones trend ratios cluster on Fibonacci ratios more than chance would explain (Batchelor & Ramyar, 2006). So treat it as a framework for describing structure, and decide in advance how far price can go before the count is wrong.

## How Siglens detects it

Siglens confirms the previous high or low as a wave vertex once price moves 1.5 times [ATR](/guide/indicators/atr) (the average range of recent bars) in the opposite direction. From these vertices it counts the structure within the last 120 bars. The structures it draws are the impulse, the diagonal (a wedge-shaped five-wave move) and the contracting triangle.

All three rules are checked. Wave 2 must not retrace more than 100% of wave 1 (it must not break the start of wave 1). Wave 3 must not be the shortest. Wave 4 must not enter the wave 1 territory (diagonals excepted).

Several more criteria are added.

- Wave 3 must not be shorter than wave 1.
- Wave 2 must retrace only 23.6 to 88.6% of wave 1, and wave 4 only 14.6 to 61.8% of wave 3.
- Each completed wave must be at least 2.5 times ATR. Anything smaller is treated as noise.
- A completed wave 5 must go beyond the end of wave 3.

When several structures qualify, they are scored by how well they fit common retracement ranges (wave 2 at 38.2 to 78.6%, wave 4 at 23.6 to 50%) and by how recent they are, then shown from highest score down. Each count carries an invalidation price at which it is judged wrong (the end of wave 1 while wave 4 is in progress, the end of wave 4 while wave 5 is in progress). Counts where price has already passed the invalidation price, or already reached the target, are not shown.

## Watch out for

- More than one count can fit the same chart. Look at the main count and the alternates together.
- Wave 1 is easily mistaken for a bounce inside a downtrend, so it is hard to be sure while it is in progress.
- A truncation is possible, where wave 5 fails to go beyond the end of wave 3. Until price breaks below the end of wave 4, it is a suspicion, not a confirmation.
- Once price passes the invalidation price, discard the count and start again.
- A matching Fibonacci ratio alone is weak evidence.
