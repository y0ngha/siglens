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
    a: "14 bars is the standard. Siglens uses 14 too."
---

## How it's calculated

MFI is a momentum oscillator created by Gene Quong and Avrum Soudack that uses price and volume together. It multiplies the typical price (the average of high, low and close) by volume to get money flow, then compares the sum of money flow on bars where the typical price rose against the sum on bars where it fell, over 14 bars. The result runs from 0 to 100.

Think of it as the volume version of [RSI](/guide/indicators/rsi). Moves backed by heavy volume count for more, so it is sensitive to large amounts of money moving.

## What it tells you

- Overbought and oversold: above 80, buying is heavily one-sided and a short-term pullback is possible; below 20, selling is one-sided and a short-term bounce is possible. Readings above 90 or below 10 are rare and carry more weight.
- Divergence: if price makes lower lows while MFI makes higher lows, selling pressure is easing even as price falls. Because volume is built in, some regard it as more reliable than RSI divergence. The opposite shape means buying pressure is weakening.
- Failure swing: MFI drops below 20, recovers, falls again but holds above the earlier low, then breaks above the middle peak. The mirror image above 80 is a bearish failure swing.
- 50 line: a cross above 50 suggests money inflow is stronger, and a cross below suggests outflow is stronger.

## How Siglens detects it

Siglens calculates a 14-bar MFI and flags two situations as signals. If MFI crosses above 20 from below within the last 3 bars, it is an oversold bounce; if it comes down through 80 from above, it is an overbought turn. Simply staying below 20 or above 80 does not count as a signal. Siglens watches the moment MFI leaves that zone.

When it moves the same way as [OBV](/guide/indicators/obv), volume is telling the same story. When the lower Bollinger Band and MFI below 20 overlap, it is read as a pullback candidate with volume confirmation. In a strong trend, Siglens does not call a reversal from MFI above 80 or below 20 alone, and looks at trend information such as [ADX](/guide/indicators/adx) as well.

## Watch out for

- Bars with long wicks can distort the typical price.
- In a strong trend it stays in the extreme zones for a long time. It is not an automatic reversal signal.
- Volume has to be accurate. Reliability can drop for instruments whose volume is split across several exchanges.
- Volume means more on daily charts and above. On minute charts, volume spikes from algorithmic trading add noise.
