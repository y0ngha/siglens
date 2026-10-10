---
title: Three Inside / Three Outside
aliases: [Three Inside Up, Three Inside Down, Three Outside Up, Three Outside Down]
summary: "A three-bar reversal: a harami or an engulfing pattern with one more confirming bar."
seoTitle: "Three Inside and Outside Candles: How to Confirm"
seoDescription: How three inside and three outside patterns differ from the harami and engulfing, and why the third, confirming candle matters.
demoCaption: "Synthetic, illustrative bars made for this explanation. Three inside up: a big bearish bar, a small bullish bar inside it, then a bullish bar closing above the first bar's open."
faq:
  - q: How is three inside different from a harami?
    a: Three inside is a harami plus a third confirming bar. The third bar must close beyond the first bar's open.
  - q: How is three outside different from an engulfing pattern?
    a: It is an engulfing pattern followed by one more bar in the same direction that closes beyond the engulfing bar's close.
---

## How it looks

It is a three-bar reversal: a two-bar pattern plus one confirming bar.

- Three inside up: a long bearish bar, a small bullish bar inside its body (a [harami](/guide/candlesticks/harami)), then a bullish bar closing above the first bearish bar's open.
- Three inside down: a long bullish bar, a small bearish bar inside its body, then a bearish bar closing below the first bullish bar's open.
- Three outside up: a bearish bar, a bullish bar that covers its body (an [engulfing](/guide/candlesticks/bullish-engulfing)), then a bullish bar closing above the engulfing bar's close.
- Three outside down: a bullish bar, a bearish bar that covers its body, then a bearish bar closing below the engulfing bar's close.

## What it tells you

A harami or engulfing pattern alone is only a hint that direction might change. In three inside and three outside, the third bar moves once more in that direction, so there is one extra step of confirmation.

Thomas Bulkowski tallied what actually happened after patterns across decades of US stock charts and published the results in books. In his data, the reversal rates (the share that actually turned in the expected direction) were:

- Three inside up: 65% bullish reversal. It was the second-best bullish reversal among common candles, with an average gain of 2.61% ten days later.
- Three inside down: 60% bearish reversal.
- Three outside up: 75% bullish reversal.
- Three outside down: 69% bearish reversal.

The bullish versions did better than the bearish ones. Bulkowski said results were best when a pullback against the larger trend ended and that trend resumed. A three inside up during a pullback within an uptrend is one example.

## How SIGLENS detects it

SIGLENS looks for a harami or engulfing pattern followed by a third bar that takes one more step in the same direction. It checks only the shape of the three bars, not the preceding trend.

- Three inside: the first body is at least 60% of its own high-to-low range, and the second body sits inside the first. The third bar closes beyond the first bar's open (above for up, below for down).
- Three outside: the second body covers the first body, and the third bar closes beyond the second bar's close. The length of the first body is not considered.

It carries more weight with large bodies, high volume on the third bar, and a location at support or resistance.

## Watch out for

The third bar already serves as confirmation, but Bulkowski counted a breakout only when a later close moved above the highest high of the three bars (below the lowest low for the down versions). Patterns that appear when [ADX](/guide/indicators/adx), which measures trend strength, is below 20 and the market has no clear direction, and the three inside down, are on the weak side.
