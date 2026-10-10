---
title: Connors RSI
aliases: [CRSI, ConnorsRSI, Connors RSI indicator]
summary: Averages three RSI-style readings to catch short-term extremes fast. Below 10 and above 90 are extremes.
seoTitle: "Connors RSI: How to Read the 10 and 90 Levels"
seoDescription: The three parts of Connors RSI (3,2,100), its extremes below 10 and above 90, the 50 to 80 exit zone, and why it is hard to use as a standalone signal.
demoCaption: Synthetic, illustrative bars. After several days of falling, Connors RSI drops below 10 and then recovers.
faq:
  - q: Should I buy when Connors RSI is below 10?
    a: As a standalone signal, it falls short. Connors's original method was a system that combined several conditions, such as an ADX filter and the size of the prior drop, and when Siglens checked, this indicator alone did not clearly improve later returns.
  - q: How is it different from regular RSI?
    a: "Regular RSI(14) looks at one kind of momentum. Connors RSI averages three: a short-term RSI, an RSI of the up/down streak length, and the rank of the day's return. That's why it reaches extremes much faster."
  - q: What kind of stocks is it for?
    a: It is tuned for judging short-term pullbacks in weakly trending, highly liquid stocks. It often misfires on strongly trending stocks.
---

## How it's calculated

Connors RSI (CRSI) was created by Larry Connors with Cesar Alvarez and Matt Radtke ("An Introduction to ConnorsRSI", 2012). It combines three indicators to look for chances where price that has moved too far in the short term snaps back toward its average (short-term mean reversion).

CRSI(3, 2, 100) = [RSI(close, 3) + RSI(streak, 2) + percent rank of return(100)] ÷ 3

- RSI(close, 3): a very short 3-bar [RSI](/guide/indicators/rsi), measuring short-term price momentum.
- RSI(streak, 2): the number of consecutive up or down days, converted with a 2-bar RSI.
- Percent rank of return(100): where this bar's one-day return ranks among the previous 100 bars' returns, which looks at the size of the move.

Because it averages three different values, one of them spiking doesn't swing the whole reading easily.

## What it tells you

- CRSI below 10: oversold. Seen as a candidate for a short-term bounce.
- CRSI above 90: overbought. Seen as a candidate for a short-term pullback.

The thresholds are 10/90 rather than regular RSI's 30/70 because CRSI moves fast and reaches its limits easily. In Connors's method, the long position is closed when CRSI recovers into the 50 to 80 zone. So CRSI is used both to screen entry spots and to time exits. It was built for short counter-trend trades held 2 to 5 days, 8 days at most.

## How Siglens detects it

Siglens calculates CRSI(3, 2, 100) and flags it only when the value is at an extreme, 10 or below or 90 or above.

When Siglens isolated these extreme signals and checked them, later returns did not clearly improve, and in some cases got worse. Connors's published backtest picked its parameters to fit 2001 to 2012 data, and the performance came from a full system, not from the 10/90 signal alone: ADX above 30, a drop of a certain size, a position in the lower part of the recent range, limit-order entries, and CRSI-based exits, all combined. So Siglens doesn't use this indicator as an entry signal. It uses it only as a reference for judging the quality of a pullback and the timing of an exit in weakly trending, actively traded stocks.

## Watch out for

- Don't treat below 10 or above 90 as a buy or sell signal by itself. On its own, it showed almost no effect.
- It is a very fast indicator, so it keeps misfiring in trending markets. It is for ranges and pullbacks, not for trends.
- (3, 2, 100) is tuned for US daily stock charts. Moving it to other timeframes or markets without testing has no basis.
- It fits best for reading pullback quality in non-trending stocks where [ADX](/guide/indicators/adx) is low.
