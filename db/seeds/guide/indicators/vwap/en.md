---
title: "VWAP"
aliases: [VWAP, Volume Weighted Average Price, Anchored VWAP]
summary: "A line of the volume-weighted average trade price through the day, used intraday to judge whether the current price is expensive or cheap against today's average."
seoTitle: "VWAP Explained: Volume-Weighted Average Price"
seoDescription: What VWAP is, what it means when price is above or below it, how to use it as support and resistance, and why it is hard to use on daily charts.
demoCaption: "Synthetic, illustrative bars. Intraday bars with the VWAP line built up from the session open, and the point where a high-volume bar crosses above VWAP marked."
faq:
  - q: "Can VWAP be used on daily charts?"
    a: "It is an indicator built for intraday charts. On daily charts and above it loses meaning, and it only has analytical value as an anchored VWAP drawn from an important day such as an earnings date or a gap day."
  - q: "Does price above VWAP mean strong buying?"
    a: "It means most of the volume traded today changed hands at lower prices than the current one, so the intraday flow is read as favoring buyers. VWAP alone is not enough; volume and trend are checked as well."
---

## How it's calculated

VWAP (Volume Weighted Average Price) is an average price weighted by volume. For each bar, the typical price, (high + low + close) ÷ 3, is multiplied by that bar's volume and accumulated, then divided by cumulative volume. Prices where more trading happened carry more weight.

The value restarts from scratch every trading day. It shows the average price at which today's volume has traded, and institutional investors often use it as a benchmark for judging their intraday execution prices. That is why VWAP is often treated as the day's fair value (the price at which today's trading has, on average, taken place).

Instead of restarting every day, you can also pick an important day, such as an earnings date or a gap day, as the starting point and keep accumulating from there. This is called an anchored VWAP.

## What it tells you

- When price is above VWAP, most of today's volume traded at lower prices than now, so it is read as favoring buyers; below it, favoring sellers. Moving up and down around VWAP is a flat stretch where neither side has the upper hand.
- Price coming down from above and holding at VWAP is support, and price rising from below and getting blocked at VWAP is resistance. The more volume has piled up nearby, the stronger it is considered.
- A cross above VWAP with above-average volume reads as a sign of buyers coming in, and a break below as sellers taking over. A breakout on thin volume is more likely to be false.
- As a common rule of thumb in stocks, when price moves more than 1–2% away from VWAP, it is considered far from the average, and traders watch for a return toward VWAP. This is thought to hold more on low-volatility days.

## How Siglens detects it

Siglens looks at whether price is above or below today's VWAP, whether it is hovering near it, and whether it crosses VWAP with volume behind it. VWAP restarts from the open of every trading day. Dates are split on Coordinated Universal Time (UTC), but the US and Korean regular sessions both fall within that one day.

- On an intraday chart, when price is 1× [ATR](/guide/indicators/atr) (the average size of recent bars' moves) or more away from VWAP, Siglens flags it as worth watching. The 1–2% above is a common rule of thumb; Siglens uses this ATR yardstick instead of a percentage.
- On a daily chart it does not check this distance, because one bar is one day and VWAP equals that day's (high + low + close) ÷ 3.
- When VWAP sits near the POC (the price where the most volume traded) of the [volume profile](/guide/indicators/volume-profile), the volume-weighted average price and the most-traded price point to the same place, so support or resistance there is considered stronger.

Siglens also refers to the pairing of VWAP for the broad direction and [Stochastic RSI](/guide/indicators/stochastic-rsi) for short-term timing within it.

## Watch out for

- It resets every day, so it is mostly useless as support or resistance across several days.
- On daily charts and above, the interpretation differs from intraday VWAP. Unless it is an anchored VWAP, its analytical value drops.
- Large trades near the close or a single bar with a news-driven spike or drop can pull VWAP strongly. An anchored VWAP is meant to run for days, so starting one from such a spike bar carries that distortion forward for days. On days when volume is concentrated, check again whether VWAP can be trusted.
- Do not judge by VWAP alone; look at volume and the trend context as well.
