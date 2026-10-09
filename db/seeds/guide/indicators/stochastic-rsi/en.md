---
title: "Stochastic RSI"
aliases: [Stochastic RSI, StochRSI, Stoch RSI]
summary: "Applies the stochastic formula to RSI itself, showing momentum turns earlier than RSI on a 0 to 1 scale."
seoTitle: "Stochastic RSI: How to Read 0.8 and 0.2"
seoDescription: "How Stochastic RSI is calculated, the 0.8 and 0.2 levels, %K and %D crossovers, and why it reacts faster than RSI but gives more false signals."
demoCaption: "Synthetic, illustrative bars. Price drifts down and stalls, and Stochastic RSI crosses up through %D below 0.2."
faq:
  - q: "How is Stochastic RSI different from RSI?"
    a: "RSI is calculated from price. Stochastic RSI recalculates where that RSI value sits within its own recent range. That makes it much more sensitive, and it swings between 0 and 1 often."
  - q: "Should I sell when Stochastic RSI goes above 0.8?"
    a: "It is read as short-term overbought, but not as an automatic sell signal. In a strong trend it can stay above 0.8 for a long time, so the trend direction is often checked first."
---

## How it's calculated

Stochastic RSI was introduced by Tushar Chande and Stanley Kroll in 1994. Instead of price, it applies the [stochastic](/guide/indicators/stochastic) formula to RSI values. It shows, on a scale from 0 to 1, where the current RSI sits within the range of recent RSI values. Think of it as the RSI of the RSI.

The standard setting is [RSI](/guide/indicators/rsi) 14 and a stochastic window of 14. %K is smoothed over 3 bars, and %D is the 3-bar simple moving average of %K.

## What it tells you

- With %K above 0.8, RSI is near the top of its own recent range and a short-term pullback is possible. Below 0.2, the opposite: a short-term recovery is possible.
- %K crossing above %D below 0.2 is a sign that RSI is turning up from the bottom. It is regarded as the highest-quality signal. Crossing below %D from above 0.8 is a sign of turning down from the top.
- Crosses between 0.4 and 0.6 are less reliable and are checked against other indicators.
- If RSI is still below 50 but Stochastic RSI jumps from near 0 to above 0.5, it is sometimes read as a leading sign that RSI and price may follow upward.
- If price makes a lower low but the Stochastic RSI low is higher, that is bullish divergence; the opposite shape is bearish divergence.

## How Siglens detects it

Siglens uses the standard setting: RSI 14, stochastic window 14, %K 3, %D 3. When the last bar's %K is 0.8 or above, it is marked overbought, and at 0.2 or below oversold; the %K/%D cross at that point is the main thing it reads.

%K crossing up through %D below 0.2, or crossing down above 0.8, is treated as a quality signal, and crosses in the middle range are weighted lightly. It does not judge on its own, and checks with these combinations.

- Set the trend direction first with [MACD](/guide/indicators/macd) or ADX, and use Stochastic RSI only for entry timing.
- Look for short-term turning points at price zones that overlap with [VWAP](/guide/indicators/vwap) and the volume profile.
- Give more weight to a bounce signal that appears near the lower Bollinger Band.

## Watch out for

- It is very sensitive, so in low-volatility or sideways markets it gives many false signals. Do not use it as a standalone signal.
- It is a further-processed version of RSI, so even though it is designed to lead, it can sometimes look late relative to price. Interpret it against RSI, not price.
- It is better used for entry timing after the trend has been decided. Check direction first with moving averages, MACD or ADX.
- In a trending market it can stay above 0.8 or below 0.2 for a long time, so assuming it will return to the average goes wrong.
