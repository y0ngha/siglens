---
title: Chandelier Exit
aliases: [Chandelier Stop, Chandelier Exit indicator, ATR trailing stop]
summary: A trailing stop (a stop-loss that moves up as price rises) set 3 times ATR below the recent high. It manages an open position and is not an entry signal.
seoTitle: Chandelier Exit Meaning and Trailing Stop
seoDescription: The Chandelier Exit is the 22-bar high minus three times ATR. Learn how to read its trend-change marks and why it shouldn't be used as an entry signal.
demoCaption: Synthetic, illustrative bars. The stop line rises as highs rise, and then the close drops below the stop line.
faq:
  - q: Can I use the Chandelier Exit as a buy signal?
    a: It wasn't built as an entry signal. It is a lagging stop line, so by the time the flip marker appears, price has already moved a lot. The line is meant for managing exits.
  - q: Can the stop line move down?
    a: A line drawn strictly by the formula can fall. It drops when ATR grows or an old high drops out of the last 22 bars. In actual stop management, many people never lower a stop once it has been raised.
  - q: What are 22 and 3?
    a: A 22-bar high (or low), and ATR over 22 bars multiplied by 3. The values are tuned for swing trading on daily bars, where positions are held for days to weeks, so on minute charts a smaller multiple gets stopped out often by ordinary swings.
---

## How it's calculated

The Chandelier Exit was created by Chuck Le Beau (Le Beau & Lucas, 1992) and popularized by Alexander Elder. A trailing stop is a stop-loss that follows price as it moves in your favor, and the Chandelier Exit widens or narrows that gap to match volatility. The gap is measured with [ATR](/guide/indicators/atr) (the average distance a single bar moves).

- Stop for a long position (one that profits when price rises) = highest high of the last 22 bars - ATR(22) × 3
- Stop for a short position (one that bets on a fall) = lowest low of the last 22 bars + ATR(22) × 3

It's named for the line hanging down from the recent high like a chandelier. You hold the position while the trend continues and get out when the close falls below this line.

By the formula, the line can also drop when ATR grows or an old high drops out of the last 22 bars. So in actual stop management, many people never lower a stop once it has been raised.

## What it tells you

What follows is the traditional reading from the indicator's creators. Siglens uses it as context for the trend phase, not as a reason to enter.

The most important number is the stop price. For a long position, a close below the stop line becomes the exit criterion. For a short position it is the mirror image: the line sits above price, and a close above it becomes the exit criterion.

When the reference switches from the long stop to the short stop (or the reverse), it becomes a trend-flip marker. It's only a reference marker, and it matters when the direction has just changed, not while the trend continues.

## How Siglens detects it

Siglens flags the moment the trend direction has just flipped. It doesn't flag anything while the trend is simply continuing.

- Stop lines: both stop lines are calculated on every bar from the last 22 bars' high and low and 3 times ATR(22).
- Up to down: while reading the trend as up, a close below the long stop switches it to down.
- Down to up: while reading it as down, a close above the short stop switches it to up.
- Flip marker: flagged only when this switch happened within the last 3 bars.

When Siglens tested these flips as entry signals, returns after the flip did not clearly improve. That is the expected result for a line that trails behind ATR, and it means the indicator wasn't built for entries in the first place. So it is read only as an exit line and a reference for trend phase.

Whether the stop distance is wide or narrow for current volatility is checked alongside ATR or other volatility indicators. Whether a flip marker is a real trend change or noise inside a range is judged with trend-phase indicators.

## Watch out for

- It's not an entry signal. By the time a flip marker appears, price has already moved quite a bit.
- It hangs from the 22-bar high, so in a sudden reversal you only exit after giving back part of your profit.
- 22/3 is for swing trading on daily bars. On minute charts, a smaller multiple gets you stopped out often by ordinary movement.
- It is common to find the entry separately, with basic chart analysis or a momentum indicator (one that tracks the force behind a move).
- Comparing it with [Supertrend](/guide/indicators/supertrend), which also draws an ATR-trailing line, makes its role clearer.
