---
title: Abandoned Baby / Tri-Star
aliases: [Abandoned Baby, Tri-Star, Bullish Abandoned Baby, Bearish Abandoned Baby, Three-Star Doji]
summary: "A rare three-bar reversal with a doji gapped clear of both neighbors, plus the tri-star of three dojis."
seoTitle: Abandoned Baby and Tri-Star Candlestick Patterns
seoDescription: What the abandoned baby and tri-star look like, why they are rare, and how far you can trust them as reversal signals, with Siglens' detection rules.
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

A gap is a stretch where the price ranges of two neighboring bars do not overlap.

## What it tells you

A doji means buyers and sellers were evenly matched. When gaps cut it off from the bars on both sides, direction changed abruptly. The conditions are stricter than for a [morning or evening star](/guide/candlesticks/morning-evening-star), so it appears rarely.

## How Siglens detects it

Siglens checks only bar shape and gaps, not the preceding trend.

- Abandoned baby: the first bar must be a long bar whose body is at least 60% of its high-to-low range. The middle bar must be a doji whose body is at most 10% of its range. For the bullish version, the doji's high is below the first bar's low, and the third bar's low is above the doji's high. The bearish version is the mirror image.
- Tri-star: all three bars are dojis, and the second doji gaps away from the first. In the bullish version the third doji closes at or above its open; in the bearish version it closes below its open.

If the third bar closes beyond the midpoint of the first bar's body, Siglens classifies the setup as a [morning doji star or evening doji star](/guide/candlesticks/morning-evening-star) first. So an abandoned baby is shown only when the third bar fails to reach that midpoint.

Reversal rates in Thomas Bulkowski's data:

- Bullish abandoned baby: 70% bullish reversal. Only 293 samples, and it often appeared at the end of a short decline.
- Bearish abandoned baby: 69% bearish reversal.
- Bullish tri-star: 60% bullish reversal.
- Bearish tri-star: 52% bearish reversal, close to a coin flip.

All four are rare, so the statistics rest on small samples. Siglens reads the abandoned baby as the most reliable of the four and the tri-star as the weakest. It matters more when the outer bars are large, the gaps around the doji are clean, and the pattern forms at support or resistance.

## Watch out for

Confirmation is a close beyond the far end of the pattern: above the pattern's high for the bullish version, below its low for the bearish one. Until that close appears, treat a tri-star as undecided. Markets that trade around the clock, such as crypto, rarely produce true gaps, so be extra skeptical if this pattern is flagged there.
