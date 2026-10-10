---
title: "Supertrend"
aliases: [Supertrend, Super Trend, ATR Trend Line]
summary: "Draws an ATR-based line above or below price to show trend direction, reversals and a trailing stop at once."
seoTitle: "Supertrend Indicator: What a Color Change Means"
seoDescription: The reversal signal when the Supertrend line flips above or below price, how to use it as support and resistance, and how it often misleads in ranging markets, with examples.
demoCaption: "Synthetic, illustrative bars. In the uptrend the line rises beneath the bars; when the close breaks below it, the line moves above the bars."
faq:
  - q: "What are the default Supertrend settings?"
    a: "ATR period 10 and multiplier 3.0 are the standard. They suit daily-chart swing trading, and Siglens uses them."
  - q: "When is a Supertrend signal confirmed?"
    a: "After the bar closes. A line cross while the bar is still in progress is not treated as a signal, and a confirmed signal does not change later."
---

## How it's calculated

Supertrend is a trend-following indicator built on [ATR](/guide/indicators/atr). It draws a single line at a distance of ATR times a multiplier above or below the midpoint of each bar's high and low. In an uptrend the line sits below price like a support line, and in a downtrend above price like a resistance line.

The standard setting is ATR period 10 and multiplier 3.0. In an uptrend the line only rises and never falls (the reverse in a downtrend). When the close crosses the line, the line jumps to the other side and the trend is marked as changed. Because it works on bar closes, a signal, once confirmed, never changes later, which makes past signals easy to verify.

## What it tells you

- The line below price (usually green) means an uptrend. The trend is considered intact while price stays above the line.
- The line above price (usually red) means a downtrend.
- When the line moves from above to below, the close has crossed above the downtrend's resistance line, so it signals a turn up. When it moves from below to above, the close has broken the uptrend's support line, so it signals a turn down.
- Using the line's value as a trailing stop level is common. In an uptrend the line trails slowly upward, and in a downtrend slowly downward.
- A large gap between price and the line means the trend is firm; a narrowing gap means it is losing strength and a turn is close.

## How Siglens detects it

Siglens uses the standard setting of ATR period 10 and multiplier 3.0. The line below price means an uptrend, above means a downtrend. When the close crosses the line and the line jumps to the other side, that is a reversal, and the signal is marked when that flip happened within the last 3 bars.

It reads trend strength from the gap between the line and price. A stretch where the gap is narrowing is seen as trend strength dulling and a turn getting close. To filter out the frequent reversals of sideways markets, it also checks whether [ADX](/guide/indicators/adx) is above 25, and gives more weight to reversals that come with above-average volume.

## Watch out for

- It confirms a trend that has already started, so it cannot warn of a reversal in advance.
- In sideways markets the line flips often and losses repeat. One way to check is whether ADX is above 25.
- The standard (10, 3.0) suits daily-chart swing trading. Some traders use (7, 2.0) for short-term trading and (14, 4.0) for long-term positions.
- Adding a larger trend filter is also common, such as following bullish signals only when price is above the 50-day [EMA](/guide/indicators/ema).
- A larger multiplier gives fewer but later signals; a smaller one is more sensitive but adds noise. Adjust it to the stock's volatility.
- It does not account for volume, so it treats a low-volume reversal and a high-volume one the same. Volume has to be checked separately.
