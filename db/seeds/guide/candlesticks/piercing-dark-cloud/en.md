---
title: Piercing Line / Dark Cloud Cover
aliases: [Piercing Line, Dark Cloud Cover, Piercing Pattern]
summary: A two-bar reversal where the second bar goes deeper than half of the first body but doesn't cover all of it.
seoTitle: Piercing Line and Dark Cloud Cover Candlesticks
seoDescription: How the piercing line and dark cloud cover differ from engulfing patterns and when they carry more weight, along with Siglens' detection rules.
demoCaption: Synthetic, illustrative bars made for this explanation. A bullish bar closing above the midpoint of a long bearish bar (piercing line), and a bearish bar dropping below the midpoint of a long bullish bar (dark cloud cover).
faq:
  - q: How is a piercing line different from a bullish engulfing?
    a: In an engulfing the second bar fully covers the first body. A piercing line goes past half the body but not to the first bar's open. If it closes above the open, it is an engulfing, not a piercing line.
  - q: Is a dark cloud cover a bearish signal?
    a: In Thomas Bulkowski's data the bearish reversal rate was 60%. That is only slightly better than even, so it counts as confirmed only when a later close breaks below the lower of the two bars' lows.
---

## How it looks

- Piercing line: a long bearish bar followed by a bullish bar. The bullish bar opens below the prior close and closes above the midpoint of the prior body but below its open.
- Dark cloud cover: a long bullish bar followed by a bearish bar. The bearish bar opens above the prior close and closes below the midpoint of the prior body but above its open.

## What it tells you

The second bar retraced more than half of the prior bar's move. The piercing line reversed a decline and the dark cloud cover reversed an advance, which is a clue that direction may change.

Thomas Bulkowski tallied what actually happened after patterns across decades of US stock charts and published the results in books. In his data the piercing line actually turned up 64% of the time and the dark cloud cover turned down 60% of the time. That is only a little better than chance. Still, once a direction appeared, price tended to carry on in it. In his performance ranking, which ranks 103 candle patterns by how far price went afterward, the piercing line placed 13th and the dark cloud cover 22nd, both good results.

## How Siglens detects it

Siglens looks for a long bar followed by an opposite-color bar that cuts more than halfway into the prior body without covering all of it.

- The first body is at least 60% of its own high-to-low range.
- The second bar opens beyond the prior close (below it for a piercing line, above it for a dark cloud cover). Textbooks want a gap beyond the prior bar's low (piercing line) or high (dark cloud cover), but Siglens accepts this wider range.
- The second close passes the midpoint of the first body but does not reach the first bar's open. If it closes fully beyond the first body, Siglens treats it as an [engulfing](/guide/candlesticks/bullish-engulfing), not this pattern.
- The preceding trend is not checked.

It carries more weight when:

- A clear trend came right before the pattern
- The bodies are large and the second close goes well past the midpoint
- A piercing line is near support, or a dark cloud cover near resistance
- The second bar's volume is above normal

## Watch out for

A piercing line is confirmed only when a later close moves above the higher of the two bars' highs; a dark cloud cover, when a later close moves below the lower of the two lows. Until then it is only a clue. A piercing line is weak when [ADX](/guide/indicators/adx), which measures trend strength, is below 20 and the market has no clear direction, or inside a strong downtrend. Bulkowski also considered piercing lines unreliable when the larger trend is down.
