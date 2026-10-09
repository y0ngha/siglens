---
title: "VWAP"
aliases: [VWAP, Volume Weighted Average Price, Anchored VWAP]
summary: "A line of the volume-weighted average trade price through the day, used as an intraday fair-value reference."
seoTitle: "VWAP Explained: Volume-Weighted Average Price"
seoDescription: "What VWAP is, what it means when price is above or below it, how to read breakouts and support and resistance, and why it is hard to use on daily charts."
demoCaption: "Synthetic, illustrative bars. Intraday bars with the VWAP line following them, and the point where a high-volume bar crosses above VWAP marked."
faq:
  - q: "Can VWAP be used on daily charts?"
    a: "It is an indicator built for intraday charts. On daily charts and above it loses meaning, and it only has analytical value as an anchored VWAP drawn from an important day such as an earnings date or a gap day."
  - q: "Does price above VWAP mean strong buying?"
    a: "It means most of the volume traded today changed hands at lower prices than the current one, so the intraday flow is read as favoring buyers. VWAP alone is not enough; volume and trend are checked as well."
---

## How it's calculated

VWAP (Volume Weighted Average Price) is an average price weighted by volume. For each bar, the typical price, (high + low + close) ÷ 3, is multiplied by that bar's volume and accumulated, then divided by cumulative volume. Prices where more trading happened carry more weight.

The value restarts from scratch every trading day. It shows the average price at which today's volume has traded, and institutional investors often use it as a benchmark for judging their intraday execution prices.

## What it tells you

- When price is above VWAP, most of today's volume traded at lower prices than now, so it is read as favoring buyers; below it, favoring sellers. Moving up and down around VWAP is a flat stretch where neither side has the upper hand.
- Price coming down from above and holding at VWAP is support, and price rising from below and getting blocked at VWAP is resistance. The more volume has piled up nearby, the stronger it is considered.
- A cross above VWAP with above-average volume reads as a sign of buyers coming in, and a break below as sellers taking over. A breakout on thin volume is more likely to be false.
- In stocks, when price moves more than 1–2% away from VWAP, it is considered far from the average, and a return toward VWAP is often watched for. This is more true on low-volatility days.

## How Siglens detects it

Siglens multiplies each bar's typical price (the average of high, low and close) by its volume and accumulates it by day, restarting when the date changes. Dates are split on Coordinated Universal Time (UTC), and the US and Korean regular session hours both fall within that one day. So on an intraday chart, you can treat it as recalculated from the open of every trading day. If there is no volume, the value is left empty.

It reads whether price is above or below VWAP, whether it is hovering near it, and whether it breaks out with volume. On an intraday chart, it flags the state as worth watching when price is 1 times [ATR](/guide/indicators/atr) or more away from VWAP. On a daily chart, one bar is one day, so VWAP equals that day's (high + low + close) ÷ 3, and it does not make this distance judgment. When it gets close to the POC of the [volume profile](/guide/indicators/volume-profile), the time-based average and the volume distribution overlap and support or resistance is considered stronger. Siglens also refers to pairing it with [Stochastic RSI](/guide/indicators/stochastic-rsi) for entry timing.

## Watch out for

- It resets every day, so it is mostly useless as support or resistance across several days.
- On daily charts and above, the interpretation differs from intraday VWAP. Unless it is an anchored VWAP, its analytical value drops.
- Large trades near the close or a single bar with a news-driven spike or drop can pull VWAP strongly. Carrying an anchored VWAP into the next day leaves a distorted reference. On days when volume is concentrated, check again whether VWAP can be trusted.
- Do not judge by VWAP alone; look at volume and the trend context as well.
