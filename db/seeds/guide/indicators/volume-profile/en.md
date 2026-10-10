---
title: "Volume Profile"
aliases: [Volume Profile, POC, Point of Control, Value Area, Volume by Price]
summary: "Stacks volume by price level as horizontal bars, showing where trading clustered (POC) and the value area."
seoTitle: "Volume Profile: What POC, VAH and VAL Mean"
seoDescription: How to read the POC, the value area (VAH and VAL) and thinly traded price gaps on a volume profile, and where it falls short.
demoCaption: "Synthetic, illustrative bars. Volume-by-price bars sit beside the candles, with the longest bar (POC) and the upper and lower edges of the value area marked."
faq:
  - q: "What is the POC?"
    a: "It stands for Point of Control, the price with the most volume over the chosen period. It is the price market participants agreed on most, so it is seen as a magnet that price tends to return to."
  - q: "How is the value area set?"
    a: "It is the price range containing about 70% of total volume. The upper edge is the VAH and the lower edge is the VAL."
---

## How it's calculated

Volume Profile gathers volume along the price axis instead of the time axis. It splits the price range of a period into many slots, sums the volume traded in each slot, and draws a horizontal bar chart. The longer the bar, the more active trading was at that price.

There are three key reference lines.

- POC (Point of Control): the price with the most volume.
- VAH (Value Area High) and VAL (Value Area Low): the upper and lower edges of the value area, which holds about 70% of total volume.

## What it tells you

- When price is above the POC, it is trading above the price most participants agreed on, so the structure is read as bullish; below it, bearish. Price often returns to the POC, so it can act as support or resistance.
- A close through the POC with heavy volume can be read as a sign that control is shifting between buyers and sellers.
- While price is inside the value area, balanced, range-bound movement is likely. A move above the VAH with rising volume is read as the uptrend continuing, and a move below the VAL as the downtrend continuing.
- When price that had left the value area comes back inside, it is seen as a move to return to the original range. Traders pass around an "80% rule" that says it often travels all the way across to the opposite edge of the value area, but that is a rule of thumb, not a validated probability.
- Places with heavy trading (HVN) act as support or resistance where price tends to linger or turn, while places with little trading (LVN) tend to be crossed quickly.

## How Siglens detects it

Siglens splits the price range of the calculation window into 24 slots. A bar's volume is divided among the slots its high-to-low span covers, in proportion to the overlap length. The POC is the slot with the most volume, and the value area is the range grown outward from the POC, up and down, until it holds 70% of total volume. It does not calculate when there are fewer than 30 bars.

It reads where price sits relative to the POC, VAH and VAL, and whether a price level with short bars (little trading) is close by. When [VWAP](/guide/indicators/vwap) is near the POC, the time-based average and the volume distribution point to the same place, so it weighs that support or resistance more heavily. The same goes when the 20-day or 60-day moving average, or the Bollinger Band center line, overlaps with the POC.

## Watch out for

- The meaning changes with the period used. A profile built from 30 bars and one built from 500 bars are different information.
- The 80% rule is a rule of thumb. It does not hold every time.
- In thin pre-market trading or low-liquidity stocks, the distribution can be distorted.
- When bars are added, the POC, VAH and VAL move. A value you saw once does not stay fixed.
