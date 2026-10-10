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
    a: Siglens uses it as a reference for judging short-term pullbacks in weakly trending, actively traded stocks. It is a very fast indicator, so it often misfires on strongly trending stocks.
---

## How it's calculated

In one line: it combines into a single number how hard price has moved lately, how many days in a row it has moved one way, and how large the move was compared with usual. It was built to look for chances where price that has moved too far in the short term snaps back toward its average (short-term mean reversion).

CRSI(3, 2, 100) = [RSI(close, 3) + RSI(streak, 2) + percent rank of return(100)] ÷ 3

- RSI(close, 3): a very short 3-bar [RSI](/guide/indicators/rsi), looking at how hard price has moved over a short span (momentum).
- RSI(streak, 2): the number of consecutive up or down days, converted with a 2-bar RSI.
- Percent rank of return(100): where this bar's one-day return ranks among the previous 100 bars' returns, which looks at the size of the move.

Because it averages three different values, one of them spiking doesn't swing the whole reading easily.

Larry Connors created it with Cesar Alvarez and Matt Radtke and introduced it in "An Introduction to ConnorsRSI" (2012).

## What it tells you

What follows is the traditional reading Connors laid out. Siglens uses it as context, not as a trading signal.

- CRSI below 10 is read as oversold (down a lot in a short time) and seen as a candidate for a short-term bounce.
- CRSI above 90 is read as overbought (up a lot in a short time) and seen as a candidate for a short-term pullback.

The thresholds are 10/90 rather than regular RSI's 30/70 because CRSI moves fast and reaches its limits easily. Connors closed the long position when CRSI recovered into the 50 to 80 zone. So he used CRSI both to screen entry spots and to time exits. It was built for short counter-trend trades (trades that bet on a snap-back against the trend) held 2 to 5 days, 8 days at most.

## How Siglens detects it

Siglens flags Connors RSI only when it reaches an extreme, very low or very high.

- The setting is CRSI(3, 2, 100).
- It flags 10 or below as an oversold extreme and 90 or above as an overbought extreme.

When Siglens isolated these extreme signals and checked them, later returns did not clearly improve, and in some cases got worse. Connors's published backtest (a run over past data) picked its parameters to fit 2001 to 2012 data. And the performance came from a full system combining all of the conditions below, not from the 10/90 signal alone.

- A stock with a clear trend, where [ADX](/guide/indicators/adx), a measure of trend strength, is above 30
- A drop of a certain size
- A position in the lower part of the recent range
- Limit orders (orders at a preset price)
- Exits timed by CRSI

Siglens does not follow that whole system. So it doesn't use this indicator as an entry signal. It uses it only as a reference for judging how trustworthy a pullback (a brief dip in a rising price) is and where the snap-back might end, in weakly trending, actively traded stocks.

## Watch out for

- Siglens does not treat below 10 or above 90 as a buy or sell signal by itself.
- It is a very fast indicator, so it keeps misfiring in trending markets. It is for ranges and pullbacks, not for trends.
- (3, 2, 100) is tuned for US daily stock charts. Moving it to other timeframes or markets without testing has no basis.
- It fits best for reading pullbacks in stocks with low ADX and no clear direction. That is a different use from Connors's original system, which required ADX above 30.
