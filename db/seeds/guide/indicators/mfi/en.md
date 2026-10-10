---
title: "MFI (Money Flow Index)"
aliases: [MFI, Money Flow Index, Volume-Weighted RSI, Money Flow]
summary: "An oscillator from 0 to 100 that uses price and volume to show the flow of money from buyers and sellers."
seoTitle: "MFI Money Flow Index: How to Read 80 and 20"
seoDescription: How MFI differs from RSI, its 80 and 20 overbought and oversold levels, and how to read money-flow divergences and failure swings.
demoCaption: "Synthetic, illustrative bars. The marked stretch is where MFI drops below 20 and then rises back above it."
faq:
  - q: "How is MFI different from RSI?"
    a: "RSI uses only changes in the close, while MFI uses the typical price (the average of high, low and close) multiplied by volume. That is why it is also called a volume-weighted RSI."
  - q: "What do MFI 80 and 20 mean?"
    a: "Above 80 is treated as overbought and below 20 as oversold. In a strong trend, MFI can stay above 80 or below 20 for a long time, so it should not be treated as an automatic reversal signal."
  - q: "What is the default MFI period?"
    a: "14 bars is the standard. SIGLENS uses 14 too."
---

## How it's calculated

MFI was created by Gene Quong and Avrum Soudack. It uses price and volume together to show the force behind moves (momentum) within a 0 to 100 range. An indicator that swings within a fixed range like this is called an oscillator. It multiplies the typical price (the average of high, low and close) by volume to get money flow, then compares the sum of money flow on bars where the typical price rose against the sum on bars where it fell, over 14 bars. The result runs from 0 to 100.

Think of it as the volume version of [RSI](/guide/indicators/rsi). Moves backed by heavy volume count for more, so it is sensitive to large amounts of money moving.

## What it tells you

- Above 80 is read as overbought (buying heavily one-sided, so a pullback may come) and a short-term pullback is watched for; below 20 is read as oversold (selling one-sided) and a short-term bounce is watched for. Readings above 90 or below 10 are rare and carry more weight.
- If price makes lower lows while MFI makes higher lows, that is a divergence (price and indicator moving in different directions): selling pressure is easing even as price falls. Because volume is built in, some give it more weight than RSI divergence. The opposite shape means buying pressure is weakening.
- If MFI drops below 20, recovers, falls again but holds above the earlier low, then breaks above the high in between, that is a bullish failure swing. The mirror image above 80 is a bearish failure swing.
- A cross above 50 suggests money inflow is stronger, and a cross below suggests outflow is stronger.

## How SIGLENS detects it

SIGLENS watches not whether MFI is sitting in the oversold or overbought zone, but the moment it leaves that zone.

- It uses a 14-bar MFI.
- If MFI crosses above 20 from below within the last 3 bars, it flags an oversold bounce.
- If MFI comes down through 80 from above within the last 3 bars, it flags an overbought turn.
- Simply staying below 20 or above 80 does not count as a signal.

When MFI moves the same way as [OBV](/guide/indicators/obv), volume is seen as telling the same story. Price near the lower Bollinger Band with MFI below 20 is read as a bounce candidate that volume also supports. In a strong trend, SIGLENS does not call a reversal from MFI above 80 or below 20 alone, and looks at trend information such as [ADX](/guide/indicators/adx), a measure of trend strength, as well.

## Watch out for

- Bars with long wicks can distort the typical price.
- In a strong trend it stays in the extreme zones for a long time. It is not an automatic reversal signal.
- Volume has to be accurate. Reliability can drop for instruments whose volume is split across several exchanges.
- Volume means more on daily charts and above. On minute charts, volume spikes from algorithmic trading add noise.
