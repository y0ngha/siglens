---
title: "Smart Money Concepts (SMC)"
aliases: [SMC, Smart Money Concepts, Order Block, Fair Value Gap, FVG, BOS, CHoCH]
summary: "A way of finding the traces large money leaves on a chart. It marks key price zones using high-low structure, order blocks and fair value gaps."
seoTitle: "Smart Money Concepts: Order Blocks and FVG"
seoDescription: What BOS and CHoCH, order blocks, fair value gaps and premium and discount zones mean in Smart Money Concepts (SMC), along with Siglens' rules.
demoCaption: "Synthetic, illustrative bars. Marked are the bar that breaks a swing high (BOS), the down bar just before it (order block), and the empty price zone across three bars (fair value gap)."
faq:
  - q: "What is an order block?"
    a: "It is the last bar in the opposite direction just before a strong move. The last down bar before a bullish breakout is a bullish order block, seen as a price zone where large money placed orders."
  - q: "Does trading with Smart Money Concepts make money?"
    a: "There is not enough evidence to say it does. When Siglens checked SPY (S&P 500 ETF) data, none of order blocks, fair value gaps, liquidity sweeps or structure breaks clearly raised subsequent returns. It fits better as a tool for describing chart structure and price zones."
---

## How it's calculated

Smart Money Concepts (SMC) is a way of finding the traces large money leaves on a chart. It estimates at which price levels big players such as banks and hedge funds entered and exited, using the shape of the bars and the sequence of highs and lows. It comes from a trading-education approach known as ICT (Inner Circle Trader). It is not a single-number indicator; it looks at the following patterns together.

- Swing highs and lows: peaks and troughs that stand out above or below the surrounding bars.
- BOS (Break of Structure): a close beyond the previous high or low in the direction of the trend, such as closing above the previous high in an uptrend.
- CHoCH (Change of Character): the first close beyond the previous high or low against the trend.
- Order block: the last opposite-direction bar just before a big move, seen as the spot where large money placed orders.
- Fair value gap (FVG): an empty price zone that price skipped over without trading because it moved fast. It forms when the price ranges of the first and third of three bars do not overlap.
- Equal highs and lows (EQH, EQL): swing highs or lows clustered at nearly the same level.
- Liquidity sweep: a move that briefly pierces a price where stop orders are bunched and then comes back. It is often discussed just beyond equal highs or lows.
- Premium and discount: within the recent swing range, the upper part is the relatively expensive zone (premium) and the lower part the relatively cheap zone (discount). The middle is equilibrium.
- Used up: an order block or fair value gap that price has already come back into once. For example, when price returns into a fair value gap after it forms, the gap is considered used up.

## What it tells you

What follows is the traditional SMC reading. Siglens uses it as context for describing chart structure, not as a confirmed signal.

In an uptrend structure, highs and lows both rise; in a downtrend, both fall. A BOS is read as the trend continuing, and a CHoCH as a warning that the trend may change. A single CHoCH does not confirm a reversal.

Order blocks and fair value gaps are read as price zones where a reaction may occur when price comes back to them. Zones that are not yet used up are the ones of interest; those already used up lose significance. Some hold that stop orders pile up near equal highs and lows, so liquidity sweeps around them are watched.

## How Siglens detects it

Siglens finds these patterns automatically with fixed rules and shows them as candidate key price zones on the chart.

- Swing highs and lows: the highest or lowest bar within 5 bars on each side.
- BOS and CHoCH: a structure break is recorded when a close finishes above the latest swing high or below the latest swing low. If it goes the same direction as the previous break, it is a BOS; if the opposite direction, a CHoCH.
- Fair value gap: on the bullish side, the current bar's low is above the high from two bars ago; on the bearish side, the current bar's high is below the low from two bars ago. When price re-enters the gap, it is treated as used up.
- Order block: on the bullish side, the last down bar before a bullish break, treated as used up once price later falls below that bar's low. The bearish side is calculated the other way around.
- Equal highs and lows: two or more swing highs (or lows) clustered within 0.5 times [ATR](/guide/indicators/atr) (the average range of the last 14 bars).
- Premium, equilibrium and discount: the upper 25%, middle 50% and lower 25% of the recent swing range. The range is set from the last structure break, using the broken swing and the swing highs and lows formed after it.

Strength is graded by how many elements overlap at the same price zone: 1 is weak, 2 is moderate, 3 or more is strong. This standard is not a value validated with data; it is a simple rule set for automated analysis.

When Siglens checked SPY (S&P 500 ETF) data, none of order blocks, fair value gaps, liquidity sweeps or structure breaks clearly raised subsequent returns. So they are used only to describe structure and price zones, not as confirmed signals.

## Watch out for

- SMC was originally a method where a person reads the chart. Zones found automatically are a list of candidates, not confirmed signals.
- A swing high or low is confirmed only after 5 more bars pass to its right. So highs and lows within the most recent 5 bars are not marked yet.
- If price returns to the original trend within 1–3 bars after a CHoCH, it is more likely a false signal.
- If price reached an order block and pushed straight through with no real reaction, the zone is no longer treated as valid.
- SMC does not measure trend strength, so a structure break in a sideways market means little. Check whether there is a trend at all with an indicator that measures trend strength, such as [ADX](/guide/indicators/adx).
- The premium and discount range is set mechanically, so right after a trend change or in a sideways market it can differ from the range a person would draw by hand.
