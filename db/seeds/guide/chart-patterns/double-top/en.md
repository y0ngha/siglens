---
title: Double Top
aliases: [M Pattern, M-Shaped Top, Double Top Pattern]
summary: Two highs at similar levels; a break of the low between them (the neckline) is read as a turn down.
seoTitle: "Double Top Pattern: How to Read It"
seoDescription: How a double top builds its M shape, how to confirm a break below the neckline, and how to weed out false signals within an uptrend.
demoCaption: Synthetic, illustrative bars. Shows two highs, the neckline through the low between them, and a bar closing below the neckline.
faq:
  - q: When is a double top considered complete?
    a: When, after the second high, a close finishes below the neckline (the low between the two highs). A brief intraday break that falls back is not a confirmation.
  - q: How is a double top different from a double bottom?
    a: They are mirror images. A double top is an M-shaped signal that an advance is ending; a double bottom is a W-shaped signal that a decline is ending.
  - q: What should volume look like on the second high?
    a: Lower than on the first high is read as a sign buying has weakened. If it is the same or higher, the case for a turn down is weak.
---

## What it looks like

Rising price turns down at a high, bounces, and is stopped again at about the same height, forming an M. The horizontal line through the low between the two highs is the neckline.

## What it tells you

When a rise is stopped twice at the same price area, there are many sellers at that price. It is read as a sign the uptrend is losing strength and may turn down.

The pattern is complete only when, after the second high, a close finishes below the neckline. Lower volume on the second high than on the first, and rising volume on the neckline break, add weight to the signal. A bearish divergence (price and an indicator pointing different ways) at the second high, where price is near the first high but [RSI](/guide/indicators/rsi) makes a lower high, is also used as supporting evidence.

## How it differs from a double bottom

Thomas Bulkowski, who counted what actually happened after patterns across decades of US stock charts and published the results, split double tops into four types by the shape of each high. A sharp high is called Adam and a rounded high Eve, and the types are the pairings of the two.

- The share that failed to move far enough after the breakout (the break-even failure rate) was highest for Adam & Adam, with two sharp highs, at 25%; the other three were 20–21%.
- Performance rank (a ranking by how far price went afterward) was 10th to 19th of 36 bearish patterns.
- 43–64% reached the price target.

The same four types of [double bottom](/guide/chart-patterns/double-bottom) had failure rates of 12–16% and reached the target 65–73% of the time. The shapes mirror each other, but the top version worked less well. With only two highs as reference points, it also gives more false signals than a [head and shoulders](/guide/chart-patterns/head-and-shoulders), which has a head as an extra reference point. That makes checking volume and the close more important.

The volume rule is also the opposite of a double bottom. In a double top, volume on the second high should be lower than on the first to show buying has faded. If price rallies back after breaking the neckline, fails to reclaim it, and turns down, the bearish case gets stronger.

## How SIGLENS finds it

SIGLENS takes the two most recent clear highs (swing highs: turning points where price pulled back more than 1.5 times [ATR](/guide/indicators/atr), the average range of recent bars) and checks whether they form an M at a similar level. Once a turning point is set, it does not change as more bars arrive. All of these must hold:

- The two highs differ by no more than the smaller of 1× ATR and 3% of their average price.
- The two highs are at least 10 bars apart.
- No bar between them rises more than 0.25 ATR above the highs.
- The neckline is the lowest swing low between the two highs. It must sit in the middle half of the span between them, meaning at least 25% of the full distance from either high.
- The height from the average high to the neckline is at least 2.5 ATR and at least a minimum share of price (0.5% on 5–30 minute bars, 1% on 1–4 hour bars, 3% on daily bars).
- If the lows between the two highs clearly rise toward them (by 1.5 ATR or more), SIGLENS treats it as an [ascending triangle](/guide/chart-patterns/ascending-triangle), not a double top.
- If the second high is older than the longer of the last 20 bars and half the pattern's length, it is not shown.

The invalidation level (the price at which the pattern counts as broken) is the higher of the two highs. A close above it breaks the pattern. The neckline minus the pattern height is the measured target, and the neckline minus half the height is the conservative target. A target is the price reached if price moves another pattern height; it is a reference drawn from past cases, not a promise. Only about half of past cases actually got that far. Once a close rises above the invalidation level or price has already reached the measured target, the pattern is no longer shown.

## Watch out when

- In a strong uptrend, the two highs may be a breather before more upside.
- If the highs are fewer than 10 bars apart, it is more likely short-term noise than a change in trend.
- If volume on the second high is equal to or higher than on the first, the case that buying has weakened is thin.
- If the neckline is not at least 3% below the average high, the middle dip is too shallow to count as a neckline.
- A wick below the neckline intraday that comes back is not confirmation.
