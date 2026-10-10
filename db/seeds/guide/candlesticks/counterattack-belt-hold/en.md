---
title: Counterattack / Belt Hold
aliases: [Belt Hold, Counterattack Line, Counterattack Lines, Meeting Lines, Bullish Belt Hold, Bearish Belt Hold]
summary: "A long bar opening at an extreme (belt hold) or closing at the prior close (counterattack). Weak turn clues."
seoTitle: "Counterattack Line and Belt Hold: Meaning and Signals"
seoDescription: How counterattack lines and belt hold candles look, how often they worked as reversal signals, and how to confirm them.
demoCaption: Synthetic, illustrative bars made for this explanation. A long bullish bar opening at its low (belt hold), and a bullish bar closing at the same price as a long bearish bar before it (counterattack).
faq:
  - q: Is a belt hold a reversal signal?
    a: In Thomas Bulkowski's data, a bullish belt hold was followed by a bullish reversal 71% of the time. But the move after the reversal was small, so one bar alone doesn't make a trend change.
  - q: What does a counterattack line look like?
    a: A long bar followed by a long bar of the opposite color that closes at almost the same price as the first bar's close. Because the two closes meet, it is also called Meeting Lines.
---

## How it looks

- Bullish belt hold: a tall bullish bar that opens near its low and closes higher, with almost no lower wick. Textbooks read it as a bullish reversal after a decline.
- Bearish belt hold: a tall bearish bar that opens near its high and closes lower, with almost no upper wick. Read as a bearish reversal after an advance.
- Bullish counterattack: a tall bearish bar followed by a tall bullish bar that closes at almost the same price as the first bar's close.
- Bearish counterattack: a tall bullish bar followed by a tall bearish bar that closes at almost the same price as the first bar's close.

## What it tells you

A belt hold means one side pushed from the very first trade. In a counterattack, the second bar opens at a price pushed further in the first bar's direction (lower or higher), then moves sharply the other way and comes back to the first bar's close. Both are clues to a short change of direction.

## How Siglens detects it

Siglens checks only bar shape, not the preceding trend.

- Belt hold: the bar's body must be at least 60% of its high-to-low range, and the wick on the opening side (lower wick for a bullish bar, upper wick for a bearish one) must be at most 10% of the body length. If the body is 90% or more, it is classified separately as a [marubozu](/guide/candlesticks/marubozu).
- Counterattack: both bars are long bars with bodies of at least 60%, and the second close is within 0.2% of the first close.

Thomas Bulkowski's data shows the following. Counterattack lines appear in his data as Meeting Lines.

- Bullish belt hold: 71% bullish reversal. Reversals happened often, but the move over the next 10 days was weak.
- Bearish belt hold: 68% bearish reversal.
- Bullish counterattack: 56% bullish reversal, close to a coin flip.
- Bearish counterattack: 49% bearish reversal, with upward continuation at 51%. However, when the bar after the pattern closed lower, it led to a reversal 67-70% of the time.

So Siglens reads a belt hold as a short-lived turning clue. It treats a counterattack as a pattern whose direction is uncertain but whose trend tends to continue once a direction is set. Judge direction by the next bar's close.

## Watch out for

A belt hold is a common bar, so one alone doesn't signal a trend change. It matters more when it is taller than recent bars and sits near support or resistance. In a sideways market ([ADX](/guide/indicators/adx) below 20), all four are weak.
