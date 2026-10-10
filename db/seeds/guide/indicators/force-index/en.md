---
title: Force Index
aliases: [Force Index, Elder Force Index, force indicator]
summary: Multiplies the size of each price move by volume, to show how much force was behind the move.
seoTitle: "Force Index: Calculation, Zero Line, Divergence"
seoDescription: How the Force Index measures strength from price change and volume, how to read zero-line crosses and divergences, and why it is hard to use alone.
demoCaption: Synthetic, illustrative bars. A stretch is marked where price makes lower lows while the Force Index makes higher lows.
faq:
  - q: How is the Force Index calculated?
    a: Multiply today's close minus yesterday's close by volume. The default setting is the 13-day exponential moving average of that value.
  - q: What does it mean when the Force Index crosses the zero line?
    a: The sign of the force behind price changes has flipped. Crossing up is read as buyers taking over, and crossing down as sellers taking over.
  - q: Can I compare its values across stocks?
    a: No. Volume is multiplied in, so the size of the value differs by stock. Only the sign and the slope are worth looking at.
---

## How it's calculated

Dr. Alexander Elder introduced this indicator in "Trading for a Living" (1993). It puts the direction, size and volume of a move into one value.

- 1-day Force Index = (today's close − yesterday's close) × volume
- The value normally used is the 13-day [exponential moving average](/guide/indicators/ema) of that.

Elder saw different uses for different periods. The 2-day is for fast short-term timing, the 13-day for trend and divergences, and around 100 days for the bias of a longer move.

## What it tells you

What follows is the traditional reading Elder set out. Siglens uses it as context for checking volume, not as a basis for setting direction.

- Zero-line cross: crossing above 0 means buyers have taken over, and crossing below means sellers have. It only marks a change of direction and isn't a trading signal by itself.
- Divergence (price and the indicator moving in different directions): price making lower lows while the Force Index makes higher lows is a warning that selling force is weakening. The opposite shape means buying force is weakening. Elder also said divergence is the most useful output of this indicator, but not a trading signal on its own.
- Gauging pullback timing: in an uptrend where price is above the 22-day exponential moving average, a 2-day Force Index dropping to negative is read as a pullback (a spot where price eases back briefly during an uptrend). It only means something when used with a trend filter.

## How Siglens detects it

Siglens flags the moment the Force Index crosses the zero line and control of the force changes hands.

- Calculation: the 13-bar Force Index.
- Zero-line cross: when the last bar's value has a different sign from the previous bar. A value that stops exactly at 0 doesn't count as a cross.
- Divergence: it also reads whether price and the Force Index disagree.

When Siglens checked later returns from the zero-line cross alone, there was no clear difference. So it's used only as a supporting reason to check whether volume backs the move and to warn about divergences, not as a basis for setting direction. It is viewed together with volume indicators of the same family, such as [OBV](/guide/indicators/obv) and [MFI](/guide/indicators/mfi).

## Watch out for

- Volume is multiplied in, so you can't compare the size of values between stocks or between volume environments. Read only the sign and the slope.
- A divergence is a warning, not timing. It can last a long time without a reversal, or before one.
