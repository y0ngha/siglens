---
title: "Supertrend"
aliases: [Supertrend, Super Trend, ATR Trend Line]
summary: "Draws an ATR-based line above or below price to show trend direction, reversals and a trailing stop at once."
seoTitle: "Supertrend Indicator: What a Color Change Means"
seoDescription: The reversal signal when the Supertrend line flips above or below price, how to use it as support and resistance, and how it often misleads in ranging markets, with examples.
demoCaption: "Synthetic, illustrative bars. In the uptrend the line rises beneath the bars; when the close breaks below it, the line moves above the bars."
faq:
  - q: "What are the default Supertrend settings?"
    a: "ATR period 10 and multiplier 3.0 are the standard. They suit daily-chart swing trading, and SIGLENS uses them."
  - q: "When is a Supertrend signal confirmed?"
    a: "After the bar closes. A line cross while the bar is still in progress is not treated as a signal, and a confirmed signal does not change later."
---

## How it's calculated

Supertrend is a trend-following indicator built on [ATR](/guide/indicators/atr) (the average size of recent bars' moves). It draws a single line at a distance of ATR times a multiplier above or below the midpoint of each bar's high and low. In an uptrend the line sits below price like a support line, and in a downtrend above price like a resistance line.

The standard setting is ATR period 10 and multiplier 3.0. In an uptrend the line only rises and never falls (the reverse in a downtrend). When the close crosses the line, the line jumps to the other side and the trend is marked as changed. Because it works on bar closes, a signal, once confirmed, never changes later, which makes past signals easy to verify.

## What it tells you

- The line below price (usually green) means an uptrend. The trend is considered intact while price stays above the line.
- The line above price (usually red) means a downtrend.
- When the line was above price and moves below it, the close has crossed above the downtrend's resistance line, so it signals a turn up. When it was below price and moves above it, the close has broken the uptrend's support line, so it signals a turn down.
- The line's value is widely used as a trailing stop (a stop level that moves along with the trend). In an uptrend the line trails slowly upward, and in a downtrend slowly downward.
- A large gap between price and the line means the trend is firm; a narrowing gap means it is losing strength and a turn is close.

## How SIGLENS detects it

SIGLENS looks for the bar where the line has just jumped to the other side of price. It then uses other indicators to tell whether the flip is one of the frequent whipsaws of a sideways market or a trend change with force behind it.

- Setting: the standard ATR period 10 and multiplier 3.0.
- Direction: the line below price means an uptrend, above means a downtrend.
- Reversal signal: marked when the close crosses the line, the line moves to the other side, and that flip happened within the last 3 bars.
- Trend strength: a narrowing gap between the line and price is read as the trend dulling and a turn getting close.
- Filtering sideways markets: it also checks whether [ADX](/guide/indicators/adx), which measures trend strength, is above 25.
- Volume: reversals on days with above-average volume get more weight.

## Watch out for

- It confirms a trend that has already started, so it cannot warn of a reversal in advance.
- In sideways markets the line flips often and losses repeat. The ADX 25 check above is meant to filter out those stretches.
- The standard (10, 3.0) suits daily-chart swing trading. Some traders use (7, 2.0) for short-term trading and (14, 4.0) for long-term positions.
- Some traders add a larger trend filter, following bullish signals only when price is above a mid-term [EMA](/guide/indicators/ema) (often the 50-day; the one SIGLENS calculates is the 60-bar).
- A larger multiplier gives fewer but later signals; a smaller one is more sensitive but adds noise. Some adjust it to the stock's volatility.
- It does not account for volume, so it treats a low-volume reversal and a high-volume one the same. Volume has to be checked separately.
