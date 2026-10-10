---
title: "OBV (On-Balance Volume)"
aliases: [OBV, On-Balance Volume, On Balance Volume, Cumulative Volume Indicator]
summary: "A running total that adds volume on up days and subtracts it on down days, showing whether volume is backing price."
seoTitle: "OBV Indicator: How to Read On-Balance Volume"
seoDescription: How OBV builds up volume, what it means when it moves with price or diverges from it, and its limits around gaps and small, thinly traded stocks.
demoCaption: "Synthetic, illustrative bars. The marked stretch is where price makes lower lows while OBV makes higher lows."
faq:
  - q: "How is OBV calculated?"
    a: "If the close is higher than the previous day's, that day's volume is added; if lower, it is subtracted, and the total keeps accumulating. Days with no change leave it as is. The starting value means nothing; the direction and slope of the line are what matter."
  - q: "What is OBV divergence?"
    a: "It is when price makes lower lows while OBV makes higher lows. It reads as volume accumulating on the buy side even as price falls. The opposite, price making higher highs while OBV makes lower highs, means volume is draining away."
  - q: "Is a high OBV value a good sign?"
    a: "No. OBV is a cumulative total, so its absolute value means nothing. Only the direction and slope matter."
---

## How it's calculated

Joe Granville introduced this cumulative volume indicator in 1963. On days when the close is higher than the previous day's, that day's volume is added; on days when it is lower, the volume is subtracted, and the total keeps building.

Granville held that shifts between accumulation (buying up) and distribution (selling off) often show up in volume before price turns. That does not mean volume always leads price. The use is in flagging moments when the accumulated volume flow and price point in different directions.

## What it tells you

- Trend confirmation: if OBV rises with price, volume is following the advance; if both fall, volume is following the decline.
- Divergence: if price makes lower lows while OBV makes higher lows, volume may be quietly building. If price makes higher highs while OBV makes lower highs, volume is draining. It carries more weight near major support and resistance or after a long trend.
- Leading breakout: sometimes OBV makes a new high or low before price does, or breaks its own trendline first. These moves can come several bars ahead of the price breakout.
- Sideways: if price swings up and down but OBV stays flat, there is no directional volume.

## How Siglens detects it

Siglens calculates OBV for every stock it analyzes and includes it. Rather than issuing a signal of its own, it uses the trend confirmation, divergence and early breakout described above to check whether volume is following price. It looks only at direction and slope, not the absolute value.

If an [RSI](/guide/indicators/rsi) divergence shows up at the same point, it puts more trust in it, and when OBV moves the same way as [MFI](/guide/indicators/mfi), it sees agreement in volume. If OBV breaks out during a Bollinger squeeze, it reads that as force building behind a direction inside a volatility contraction.

## Watch out for

- Whether price rose 0.01% or 5%, the same volume is added the same way. The size of the move is not reflected.
- Stocks with low volume or thin trading produce a lot of noise.
- Days with gap ups or gap downs can distort OBV heavily. Even on a day with a wide gap and ordinary volume, the whole day's volume is added or subtracted in one piece.
- It works better on daily charts and above. Minute-chart OBV is strongly affected by market microstructure noise.
