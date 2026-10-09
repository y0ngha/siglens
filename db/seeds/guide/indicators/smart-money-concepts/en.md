---
title: "Smart Money Concepts (SMC)"
aliases: [SMC, Smart Money Concepts, Order Block, Fair Value Gap, FVG, BOS, CHoCH]
summary: "Marks key price zones using swing structure breaks, order blocks, fair value gaps and equal highs and lows."
seoTitle: "Smart Money Concepts: Order Blocks and FVG"
seoDescription: "Smart Money Concepts explained: BOS and CHoCH, order blocks, fair value gaps and premium/discount zones, from the basic meaning to the rules Siglens uses."
demoCaption: "Synthetic, illustrative bars. Marked are the bar that breaks a swing high (BOS), the down bar just before it (order block), and the empty price zone across three bars (fair value gap)."
faq:
  - q: "What is an order block?"
    a: "It is the last bar in the opposite direction just before a strong move. The last down bar before a bullish breakout is a bullish order block, seen as a price zone where large money placed orders."
  - q: "Does trading with Smart Money Concepts make money?"
    a: "There is not enough evidence to say it does. When Siglens checked SPY (S&P 500 ETF) data, none of order blocks, fair value gaps, liquidity sweeps or structure breaks clearly raised subsequent returns. It fits better as a tool for describing chart structure and price zones."
---

## How it's calculated

Smart Money Concepts (SMC) is an analysis framework that comes from the ICT (Inner Circle Trader) approach. It uses traces on the chart to estimate at which price levels large money such as banks and hedge funds enters and exits. It is not a single-number indicator; it looks at the following elements together.

- Swing highs and lows: the highest or lowest bar when compared with 5 bars on each side.
- Structure break: a close beyond the previous swing high or low.
- Order block: the last opposite-direction bar before a big move.
- Fair value gap (FVG): an untraded empty price zone between the first and third of three bars.
- Equal highs and lows (EQH, EQL): swing highs or lows clustered at nearly the same level.
- Premium and discount zones: the recent swing range split into upper, middle and lower parts.

## What it tells you

In an uptrend structure, highs and lows both rise; in a downtrend, both fall. When a close breaks the previous swing in the trend's direction, it is a BOS (Break of Structure) and the trend is seen as continuing. The first break against the trend is a CHoCH (Change of Character), treated as a warning of a possible reversal. A single CHoCH does not confirm a reversal.

Order blocks and fair value gaps are read as price zones where a reaction may occur when price comes back to them. Zones price has not yet passed through are the ones of interest; those it has already passed lose significance. Some hold that stop orders pile up near equal highs and lows, so the moves where price briefly breaks through and then returns (liquidity sweeps) are watched.

## How Siglens detects it

- A swing high or low is the highest or lowest bar within 5 bars on each side.
- A structure break is recorded when a close finishes above the latest swing high or below the latest swing low. If it goes the same direction as the previous break, it is a BOS; if the opposite direction, a CHoCH.
- A bullish fair value gap is when the current bar's low is above the high from two bars ago; a bearish gap is when the current bar's high is below the low from two bars ago. When price re-enters the gap, it is treated as used up.
- A bullish order block is the last down bar before a bullish break, and it is treated as used up once price later falls below that bar's low. A bearish order block is calculated the other way around.
- Equal highs and lows are two or more swing highs (or lows) clustered within 0.5 times [ATR](/guide/indicators/atr) (the average range of the last 14 bars).
- Premium is the upper 25% of the recent swing range, equilibrium is the middle 50%, and discount is the lower 25%. The range is set from the last structure break, using the broken swing and the swing highs and lows formed after it.

In interpretation, strength is graded by how many elements overlap at the same price zone: 1 is weak, 2 is moderate, 3 or more is strong. This standard is not a value validated with data; it is a simple rule set for automated analysis.

When Siglens checked SPY (S&P 500 ETF) data, none of order blocks, fair value gaps, liquidity sweeps or structure breaks clearly raised subsequent returns. So they are used only to describe structure and price zones, not as confirmed signals.

## Watch out for

- SMC was originally a method where a person reads the chart. Zones found automatically are a list of candidates, not confirmed signals.
- A swing high or low is confirmed only after 5 more bars pass to its right. So highs and lows within the most recent 5 bars are not marked yet.
- If price returns to the original trend within 1–3 bars after a CHoCH, it is more likely a false signal.
- If price entered an order block and passed through with no real reaction, the zone is no longer treated as valid.
- It does not measure trend strength, so a structure break in a sideways market means little. Check separately with an indicator such as [ADX](/guide/indicators/adx).
- The premium and discount range is set mechanically, so right after a trend change or in a sideways market it can differ from the range a person would draw by hand.
