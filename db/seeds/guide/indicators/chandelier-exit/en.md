---
title: Chandelier Exit
aliases: [Chandelier Stop, Chandelier Exit indicator, ATR trailing stop]
summary: A trailing stop set 3 times ATR below the recent high. It manages an open position and is not an entry signal.
seoTitle: Chandelier Exit Meaning and Trailing Stop
seoDescription: The Chandelier Exit is the 22-bar high minus three times ATR. Learn how to read its trend-change marks and why it shouldn't be used as an entry signal.
demoCaption: Synthetic, illustrative bars. The stop line rises as highs rise, and then the close drops below the stop line.
faq:
  - q: Can I use the Chandelier Exit as a buy signal?
    a: It's better not to. It is a lagging stop line, so if you enter after seeing the flip marker, price has already moved a lot. Find entries another way and use this line only for managing exits.
  - q: Can the stop line move down?
    a: A line drawn strictly by the formula can fall. It drops when ATR grows or an old high leaves the 22-bar window. In actual stop management, many people never lower a stop once it has been raised.
  - q: What are 22 and 3?
    a: A 22-bar high (or low), and ATR over 22 bars multiplied by 3. The values are tuned for daily swing trading, so on minute charts a smaller multiple gets stopped out often by ordinary swings.
---

## How it's calculated

The Chandelier Exit was created by Chuck Le Beau (Le Beau & Lucas, 1992) and popularized by Alexander Elder. It's a trailing stop whose distance adjusts to volatility.

- Stop for a long position = highest high of the last 22 bars - [ATR](/guide/indicators/atr)(22) × 3
- Stop for a short position = lowest low of the last 22 bars + ATR(22) × 3

It's named for the line hanging down from the recent high like a chandelier. You hold the position while the trend continues and get out when the close falls below this line.

By the formula, the line can also drop when ATR grows or an old high leaves the 22-bar window. So in actual stop management, many people never lower a stop once it has been raised.

## What it tells you

The most important number is the stop price. On the long side, a close below the stop line becomes the exit criterion. The short side is the mirror image, a line above price.

When the reference switches from the long stop to the short stop (or the reverse), it becomes a trend-flip marker. It's only a reference marker, and it matters when the direction has just changed, not while the trend continues.

## How Siglens detects it

Siglens calculates both stop lines on every bar from the 22-bar high and low and 3 times ATR(22). While reading the trend as up, if the close drops below the long stop, it switches to down. While reading it as down, if the close rises above the short stop, it switches to up. It flags a flip only when this switch happened within the last 3 bars, and doesn't flag anything when the trend is simply continuing.

When Siglens tested these flips as entry signals, returns after the flip did not clearly improve. That is the expected result for a line that trails behind ATR, and it means the indicator wasn't built for entries in the first place. So it isn't used as an entry reason. It is read as an exit line and a reference for trend phase.

Whether the stop distance is wide or narrow for current volatility is checked alongside ATR or other volatility indicators. Whether a flip marker is a real trend change or noise inside a range is judged with trend-phase indicators.

## Watch out for

- It's not an entry signal. If you enter after seeing a flip marker, you are already late.
- It hangs from the 22-bar high, so in a sudden reversal you only exit after giving back part of your profit.
- 22/3 is for daily swing trading. On minute charts, a smaller multiple gets you stopped out often by ordinary movement.
- It is common to find the entry separately, with basic chart analysis or a momentum indicator.
- Comparing it with [Supertrend](/guide/indicators/supertrend), which also draws an ATR-trailing line, makes its role clearer.
