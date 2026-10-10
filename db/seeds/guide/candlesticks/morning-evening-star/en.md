---
title: Morning Star / Evening Star
aliases: [Morning Star, Evening Star, Morning Doji Star, Evening Doji Star, Doji Star]
summary: "A three-bar reversal: a big bar, a small bar that gaps away, then a big bar in the opposite direction."
seoTitle: Morning Star and Evening Star Candlestick Patterns
seoDescription: What the morning star and evening star look like, whether a doji in the middle makes them more reliable, how often they reversed, and how SIGLENS detects them.
demoCaption: "Synthetic, illustrative bars made for this explanation. A morning star: a long bearish bar, a small bar that gaps down, then a bullish bar closing above the midpoint."
faq:
  - q: How do I tell a morning star from an evening star?
    a: A morning star turns a decline into an advance; an evening star turns an advance into a decline. The star is the small bar in the middle.
  - q: Is it stronger with a doji in the middle?
    a: No. In Bulkowski's data the doji stars had slightly lower reversal rates than the regular stars.
---

## How it looks

It has three bars.

- Morning star: a long bearish bar, a small-bodied bar that gaps below its body, then a bullish bar that closes above the midpoint of the first bearish body. Read as a bullish reversal at the end of a decline.
- Evening star: a long bullish bar, a small-bodied bar that gaps above its body, then a bearish bar that closes below the midpoint of the first bullish body. Read as a bearish reversal at the end of an advance.
- Doji star: a variant where the middle bar is a [doji](/guide/candlesticks/doji), a bar with almost no body.

In this article a gap means the bodies of the first and middle bars do not overlap. The wicks may overlap.

## What it tells you

The pushing force of one side ran out on the middle bar and flipped to the opposite direction on the third. Because the middle bar is separated by a gap, the abrupt stop in movement stands out.

Thomas Bulkowski tallied what actually happened after patterns across decades of US stock charts and published the results in books. In his data, the reversal rates (the share that actually turned in the direction the textbook expects) were:

- Morning star 78%, evening star 72%
- Morning doji star 76%, evening doji star 71%

A doji in the middle did not make the pattern more reliable; each doji star came in slightly below its regular star. All four are also rare. The best-performance figures for regular stars come from small samples, 108 morning stars and 63 evening stars, so the real figures may be lower.

## How SIGLENS detects it

SIGLENS looks for a long bar, a middle bar whose body is separated by a gap, and a third bar that retraces past half of the first body. The morning star criteria (the evening star is the mirror image):

- The first bearish body is at least 60% of its own high-to-low range.
- The whole body of the middle bar is below the first body.
- The third bullish bar closes above the first body's midpoint.
- If the middle bar's body is at most 10% of its own high-to-low range, it is shown separately as a doji star.

The middle body's size is not otherwise limited, and the preceding trend is not checked. So check on the chart whether the middle body is large and whether a clear trend came before. It carries more weight when:

- A clear trend came right before the pattern
- The first and third bars are large and the third close goes deep into the first body
- The third bar's volume is above normal
- It sits near support or resistance, or [RSI](/guide/indicators/rsi) is at an overbought extreme (risen so far it may pull back) or an oversold extreme (fallen so far it may bounce)

## Watch out for

It is weak when the middle body is as large as the outer bars. It is also weak when [ADX](/guide/indicators/adx), which measures trend strength, is below 20 and the market has no clear direction, and very short timeframes are noisy. In markets that trade around the clock (crypto), body gaps are rare, so be more suspicious if one is flagged.
