---
title: "Stochastic RSI"
aliases: [Stochastic RSI, StochRSI, Stoch RSI]
summary: "Applies the stochastic formula to RSI itself, showing momentum turns earlier than RSI on a 0 to 1 scale."
seoTitle: "Stochastic RSI: How to Read 0.8 and 0.2"
seoDescription: How Stochastic RSI is calculated, its 0.8 and 0.2 levels and %K/%D crosses, and why it reacts faster than RSI but gives more false signals.
demoCaption: "Synthetic, illustrative bars. Price drifts down and stalls, and Stochastic RSI crosses up through %D below 0.2."
faq:
  - q: "How is Stochastic RSI different from RSI?"
    a: "RSI is calculated from price. Stochastic RSI recalculates where that RSI value sits within its own recent range. That makes it much more sensitive, and it swings between 0 and 1 often."
  - q: "Should I sell when Stochastic RSI goes above 0.8?"
    a: "It is read as short-term overbought, but not as an automatic sell signal. In a strong trend it can stay above 0.8 for a long time, so the trend direction is often checked first."
---

## How it's calculated

Stochastic RSI was introduced by Tushar Chande and Stanley Kroll in 1994. Instead of price, it applies the [stochastic](/guide/indicators/stochastic) formula to RSI values. It shows, on a scale from 0 to 1, where the current RSI sits within the range of recent RSI values. Think of it as RSI with the stochastic formula applied on top. RSI measures the force behind price moves (momentum), so Stochastic RSI shows where that force sits within its recent range.

The stochastic uses a 0 to 100 scale, but Stochastic RSI is usually shown on a 0 to 1 scale. So 0.8 here corresponds to 80 on the stochastic, and 0.2 to 20.

The standard setting is [RSI](/guide/indicators/rsi) 14 and a stochastic window of 14. %K is smoothed over 3 bars, and %D is the 3-bar simple moving average of %K.

## What it tells you

- With %K above 0.8, RSI is near the top of its own recent range. This is read as overbought (up a lot in a short time, so a pullback may come), and a short-term pullback is watched for. Below 0.2 is read as oversold (the reverse: down a lot), and a short-term recovery is watched for.
- %K crossing above %D below 0.2 is read as RSI turning up from the bottom. It is regarded as this indicator's most reliable signal. Crossing below %D from above 0.8 is read as turning down from the top.
- Crosses between 0.4 and 0.6 are less reliable and are checked against other indicators.
- If RSI is still below 50 but Stochastic RSI jumps from near 0 to above 0.5, it is sometimes read as a leading sign that RSI and price may follow upward.
- If price makes a lower low but the Stochastic RSI low is higher, that is bullish divergence (price and indicator moving in different directions); the opposite shape is bearish divergence.

## How Siglens detects it

Siglens checks whether RSI has reached the top or bottom of its own recent range, and whether %K and %D cross there.

- It uses the standard setting (RSI 14, stochastic window 14, %K 3, %D 3).
- It marks the last bar's %K at 0.8 or above as overbought and at 0.2 or below as oversold.
- It treats %K crossing up through %D below 0.2, or crossing down above 0.8, as a reliable signal, and weights crosses in the middle range lightly.

It does not judge on its own, and checks with these combinations.

- It reads the trend direction first with [MACD](/guide/indicators/macd) or ADX (a measure of trend strength), and uses Stochastic RSI only for timing.
- Look for short-term turning points at price zones that overlap with [VWAP](/guide/indicators/vwap) and the volume profile.
- Give more weight to a bounce signal that appears near the lower Bollinger Band.

## Watch out for

- It is very sensitive, so in low-volatility or sideways markets it gives many false signals. Do not use it as a standalone signal.
- It is a further-processed version of RSI, so even though it is designed to lead, it can sometimes look late relative to price. What it tells you is not where price sits but where RSI sits within its own recent range. 0.8 means "RSI is high for lately," not "price is at the top."
- It suits timing once the trend has been decided. Check direction first with moving averages, MACD or ADX.
- In a trending market it can stay above 0.8 or below 0.2 for a long time, so expecting it to return to the middle soon goes wrong.
