---
title: Elliott Wave
aliases: [Elliott wave theory, Elliott wave count, impulse wave, five-wave structure, wave theory]
summary: A way of counting where price is in a five-wave advance and three-wave correction.
seoTitle: "Elliott Wave Theory: Meaning and How to Count"
seoDescription: The five waves up and three-wave correction of Elliott Wave theory, the three rules that must not break, and how SIGLENS counts waves and sets the invalidation price.
demoCaption: Synthetic, illustrative candles. Shows waves 1 to 5 up, the wave 2 and 4 corrections, the wave 1 start that wave 2 must not break, and the A-B-C correction after wave 5.
faq:
  - q: Does Elliott wave predict future prices?
    a: It is closer to a framework for describing the structure price is in than a forecasting tool. Two people can count the same chart differently, and a count often becomes clear only afterward. That is why SIGLENS shows alternate counts and an invalidation price (the price beyond which the count is considered wrong) alongside the main count.
  - q: What are the three Elliott wave rules?
    a: Wave 2 does not go below the start of wave 1. Wave 3 cannot be the shortest of waves 1, 3 and 5. Wave 4 does not enter the price range of wave 1. If any rule is broken, the count is considered wrong. The only exception to the wave 4 rule is the diagonal, a wedge-shaped five-wave move.
  - q: Do the Fibonacci ratios have to match exactly?
    a: No. Ratios such as wave 2 retracing about 50 to 61.8% of wave 1 are reference points only. A matching ratio alone is not a reason to set a price.
---

## What it is

Ralph Nelson Elliott laid out the theory in the 1930s. It holds that price advances in five steps in the larger direction, then comes back in three, and repeats. Numbering the waves to work out where price is now gives you a count.

- Impulse: a five-wave group made of trend-direction waves 1, 3 and 5, with waves 2 and 4 briefly pulling back in between.
- Diagonal: a five-wave move whose high and low lines narrow or widen like a wedge. It is the exception where wave 4 may overlap wave 1's price range.
- Correction: after the impulse ends, price comes back in three waves, A, B and C.

Wave 3 is often the longest and strongest. Wave 5 is weaker than wave 3, so a [divergence](/guide/strategies/divergence) often appears there: price makes a new high while momentum indicators (which track the speed and force of a move) fail to follow.

Corrections are grouped by shape. A zigzag pulls back steeply in one go. In a flat, wave B returns to near the start of wave A and the correction drifts sideways. Triangles also occur. Waves 2 and 4 tend to alternate: when one pulls back sharply, the other tends to rest sideways.

## What it tells you

What follows is the traditional reading. SIGLENS uses it as background for reading the current structure, not as a trading signal.

It works as a map for judging whether price is early in a trend (waves 1 to 3), near the end (wave 5), or in a correction (A, B, C). During wave 3, the trend is read as still having strength. If momentum fades in wave 5, the correction is read as getting close.

Counting waves involves a lot of judgment, though, and the ratio evidence is weak. Batchelor and Ramyar (2006) checked whether ratios between Dow Jones swings cluster near Fibonacci ratios more often than chance and found no such evidence. So treat Elliott wave as a framework for describing structure, and decide in advance how far price can go before the count is wrong.

## How SIGLENS detects it

SIGLENS takes clearly turned highs and lows in the last 120 bars as wave vertices and checks whether they form a structure that fits the Elliott rules. A previous high or low becomes a vertex once price reverses by more than 1.5 times [ATR](/guide/indicators/atr) (the average range of recent bars). The structures it looks for are the impulse, the diagonal, and the contracting triangle (a five-leg correction that keeps narrowing).

All three rules that must not break are checked.

- Wave 2 must not go below the start of wave 1. In other words, it must not retrace more than 100% of wave 1.
- Wave 3 must not be the shortest of waves 1, 3 and 5.
- Wave 4 must not enter wave 1's price range. Only the diagonal is exempt.

SIGLENS adds a few criteria of its own. A count that misses any of them is not shown.

- Wave 3 must not be shorter than wave 1.
- Wave 2 must retrace only 23.6 to 88.6% of wave 1, and wave 4 only 14.6 to 61.8% of wave 3.
- Each completed wave must cover at least 2.5 times ATR. Anything smaller is treated as noise.
- A completed wave 5 must go beyond the end of wave 3. A truncated fifth, which ends short of wave 3's end, is rare and hard to tell from noise, so it is left out.

When several structures pass, they are ranked. A count scores higher the closer wave 2 is to the common range of 38.2 to 78.6% of wave 1 and wave 4 to 23.6 to 50% of wave 3, and the more recent the structure is. These ranges only set the order; they do not rule anything out.

Each count carries an invalidation price: the end of wave 1 while wave 4 is in progress, and the end of wave 4 while wave 5 is in progress. If price has already passed the invalidation price, or already reached a target price the count calculated (for example, where wave C was expected to go), the count is in the past and is not shown.

## Watch out for

- More than one count can fit the same chart. The main count and the alternates need to be read together.
- Wave 1 is easily mistaken for a bounce inside a downtrend, so it is hard to be sure while it is in progress.
- The textbook also allows a truncated fifth wave. Until price breaks back through the end of wave 4, it is a suspicion, not a confirmation. Because of the criteria above, SIGLENS does not offer truncated fifths as counts.
- Once price passes the invalidation price, the count is considered wrong and the counting starts over.
- A matching Fibonacci ratio alone is weak evidence.
