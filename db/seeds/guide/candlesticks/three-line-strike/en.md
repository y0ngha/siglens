---
title: Three-Line Strike
aliases: [Three-Line Strike, Three Line Strike, Bullish Three-Line Strike, Bearish Three-Line Strike]
summary: "A rare shape where a fourth bar wipes out three same-color bars. In the data it moved as a reversal."
seoTitle: Three-Line Strike Candlestick Pattern Explained
seoDescription: Despite its name, the three-line strike more often led to a reversal than a continuation. Here is why, and how SIGLENS reads its direction.
demoCaption: "Synthetic, illustrative bars made for this explanation. A bearish three-line strike: three falling bearish bars wiped out by a fourth bullish bar that rises above the first bar's open."
faq:
  - q: Isn't a bullish three-line strike a bullish signal?
    a: The name says bullish, but in Bulkowski's data 65% moved as a bearish reversal. Reading it in the direction of the fourth bar matches the data better.
  - q: How often does it appear?
    a: Very rarely. By Bulkowski's frequency ranking it is 94th and 95th of 103. The samples are few, so don't put much confidence in the numbers.
---

## How it looks

It has four bars. Three same-color bars close progressively in one direction, then the fourth bar wipes out that move in one go. The fourth bar opens beyond the third close and closes beyond the first bar's open.

- Bullish three-line strike: three bullish bars (rising closes), then a bearish bar that opens at or above the third close and closes below the first open.
- Bearish three-line strike: three bearish bars (falling closes), then a bullish bar that opens at or below the third close and closes above the first open.

## The name and the actual direction differ

The traditional name describes a continuation pattern, where a bullish three-line strike means the advance continues and a bearish one means the decline continues.

But in the counts of Thomas Bulkowski, who tallied what actually happened after patterns across decades of US stock charts and published the results in books, both more often turned in the direction of the fourth bar. The performance rank orders 103 candle patterns by how far price went afterward.

- Bullish three-line strike: 65% turned down. Performance rank 2nd.
- Bearish three-line strike: 84% turned up. Performance rank 1st, the best of all 103.

Both are rare, so the figures rest on few cases. The bearish three-line strike did better where a pullback inside an uptrend ended, or near the yearly low (the lower third of the year's price range). The bullish one did better with large bars in a bear market.

## How SIGLENS detects it

SIGLENS looks for three same-color bars whose move is erased by a fourth bar that reaches past the first bar's open. The bullish three-line strike criteria (the bearish one is the opposite):

- The closes of the three bullish bars rise in turn. Body lengths are not considered.
- The fourth bar opens at or above the third close.
- The fourth bar closes below the first bar's open.
- The preceding trend is not checked.

Direction follows the data, not the name. A bullish three-line strike is read as bearish and a bearish one as bullish. In effect, the fourth bar is treated as the signal. It matters more when the fourth bar is large and appears at support or resistance.

## Watch out for

It is weak when [ADX](/guide/indicators/adx), which measures trend strength, is below 20 and the market has no clear direction, or when the bars are very small. The breakout is confirmed when a later close moves above the fourth bar's high (below its low for the bullish three-line strike). The figures are just rates from the past, so they are no promise that it will play out that way this time.
