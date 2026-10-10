---
title: Abandoned Baby / Tri-Star
aliases: [Abandoned Baby, Tri-Star, Bullish Abandoned Baby, Bearish Abandoned Baby, Three-Star Doji]
summary: "A rare three-bar reversal with a doji gapped clear of both neighbors, plus the tri-star of three dojis."
seoTitle: Abandoned Baby and Tri-Star Candlestick Patterns
seoDescription: What the abandoned baby and tri-star look like, why they are rare, and how far you can trust them as reversal signals, with SIGLENS' detection rules.
demoCaption: Synthetic, illustrative bars made for this explanation. A long bearish bar, a doji that gaps down with no shadow overlap, then a bullish bar that gaps back up.
faq:
  - q: Why is it called an abandoned baby?
    a: The middle doji sits alone, separated from the bars on both sides by gaps that include the shadows, like a baby left behind.
  - q: How common is this pattern?
    a: Very rare. Bulkowski found only 293 bullish cases in about 4.7 million bars. The sample is small, so don't lean on the numbers too hard.
---

## How it looks

- Bullish abandoned baby: a long bearish bar, then a [doji](/guide/candlesticks/doji) that gaps below it with no shadow overlap, then a bullish bar that gaps back above the doji.
- Bearish abandoned baby: a long bullish bar, then a doji that gaps above it, then a bearish bar that gaps below the doji.
- Bullish tri-star: three dojis in a row. The second gaps below the first, and the third closes higher.
- Bearish tri-star: three dojis in a row. The second gaps above the first, and the third closes lower.

A gap is a stretch where the price ranges of two neighboring bars do not overlap. In this article a gap means the full high-to-low ranges, shadows included, do not overlap at all. A [morning star](/guide/candlesticks/morning-evening-star) only needs the bodies to be separated, which is a looser rule.

## What it tells you

A doji means buyers and sellers were evenly matched. When gaps cut it off from the bars on both sides, direction changed abruptly. The conditions are stricter than for a [morning or evening star](/guide/candlesticks/morning-evening-star), so it appears rarely.

## How SIGLENS detects it

SIGLENS checks only bar shape and gaps, not the preceding trend. Below, body ratios are measured against each bar's own high-to-low range.

- Abandoned baby, first bar: a long bar whose body is at least 60% of its own high-to-low range. Bearish for the bullish version, bullish for the bearish version.
- Abandoned baby, middle bar: a doji whose body is at most 10% of its own high-to-low range. In the bullish version, the doji's high is below the first bar's low.
- Abandoned baby, third bar: in the bullish version, a bullish bar whose low is above the doji's high. The bearish version is the mirror image.
- Tri-star: all three bars are dojis, and the second gaps away from the first (down for the bullish version, up for the bearish one). In the bullish version the third doji's close is at or above its own open; in the bearish version it is below its own open.

If the third bar closes beyond the midpoint of the first bar's body, the setup is classified as a [morning doji star or evening doji star](/guide/candlesticks/morning-evening-star) first, so an abandoned baby remains only when the third bar falls short of that midpoint.

Thomas Bulkowski, who counted what price actually did after each pattern across decades of US stock charts and published the results in books, found that the reversal rate (how often price turned in the expected direction) differed across the four:

- Bullish abandoned baby: 70%. Only 293 samples, and it often appeared at the end of a short decline.
- Bearish abandoned baby: 69%.
- Bullish tri-star: 60%.
- Bearish tri-star: 52%, close to a coin flip.

All four are rare, so the figures rest on small samples. SIGLENS reads the abandoned baby as the most reliable of the four and the tri-star as the weaker one. An abandoned baby matters more when the two outer bars are large, the gaps around the doji are clean, and it forms at support or resistance.

## Watch out for

The bullish version is confirmed when a later close rises above the highest high of the three bars; the bearish version, when a later close falls below their lowest low. Until that close appears, a tri-star is treated as undecided. Markets that trade around the clock, such as crypto, rarely produce true gaps, so be extra skeptical if this pattern is flagged there.
