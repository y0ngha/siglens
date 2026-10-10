---
title: Ichimoku Cloud
aliases: [Ichimoku Kinko Hyo, Ichimoku, Ichimoku Cloud, Ichimoku Sanjin]
summary: Uses the Tenkan-sen, the Kijun-sen, a cloud built from two leading spans, and a lagging span to show trend, support and resistance on one chart.
seoTitle: How to Read the Ichimoku Cloud and Its Lines
seoDescription: How to read Ichimoku's five lines and the cloud, cloud breakouts and Tenkan-Kijun crosses, confirming with the Chikou span, and its limits in ranging markets.
demoCaption: Synthetic, illustrative bars. Price has risen above the cloud and the Tenkan-sen sits above the Kijun-sen.
faq:
  - q: What is the cloud in Ichimoku?
    a: It's the shaded area between Leading Span 1 and Leading Span 2. Price above the cloud is often read as an uptrend, below it as a downtrend, and inside it as a zone where direction hasn't been decided.
  - q: What are 9, 26 and 52?
    a: The Tenkan-sen uses 9 bars, the Kijun-sen 26 bars, and Leading Span 2 52 bars. The numbers were fitted to the Japanese market of the time, when exchanges were open on Saturday and traded six days a week, so some people use 10, 30 and 60 for five-day markets.
  - q: What does a thick cloud mean?
    a: A thick cloud is seen as strong support or resistance, and a thin one as relatively easy to break through. Breaking through a thick cloud needs extra confirmation.
---

## How it's calculated

Ichimoku Kinko Hyo (一目均衡表) means "equilibrium chart at a glance." It was created by Goichi Hosoda of Japan (pen name Ichimoku Sanjin) and published in a book in 1969. It draws support and resistance, trend direction, momentum and the balance zone ahead on one chart, and consists of five lines.

- Tenkan-sen (conversion line): the midpoint of the highest high and lowest low over 9 bars
- Kijun-sen (base line): the midpoint of the highest high and lowest low over 26 bars
- Leading Span 1: the average of the Tenkan-sen and Kijun-sen, plotted 26 bars ahead
- Leading Span 2: the midpoint of the highest high and lowest low over 52 bars, plotted 26 bars ahead
- Lagging span: today's close, plotted 26 bars back

The shaded area between Leading Span 1 and 2 is the cloud.

## What it tells you

- Price position: above the cloud is an uptrend, below is a downtrend, and inside is neutral or a transition zone.
- Tenkan-sen and Kijun-sen cross: the Tenkan-sen crossing above the Kijun-sen is called a bullish turn (koten), and crossing below is called a reversal (gyakuten). A bullish turn above the cloud and a reversal below the cloud carry more weight, and a cross inside the cloud is treated as neutral.
- Cloud breakout: a close that moves from below the cloud to above it is considered the biggest event in Ichimoku. The thinner the cloud, the more likely it is to succeed.
- Lagging span: above the price of 26 bars ago confirms the rise, and below confirms the fall.
- Cloud shape: Leading Span 1 on top (a bullish cloud) means the balance ahead leans up, and Span 2 on top (a bearish cloud) means it leans down.

## How Siglens detects it

Siglens uses the 9, 26 and 52 periods and the 26-bar shift as they are. It flags two things as signals.

- Cloud breakout: the previous bar closed at or below the top edge of the cloud, and this bar closes above the top edge.
- Cloud exit: the previous bar closed at or above the bottom edge of the cloud, and this bar closes below the bottom edge.

Beyond these signals, it checks whether price is above, inside or below the cloud and whether the Tenkan-sen is above or below the Kijun-sen. Judgment rests on whether three layers point the same way: price above the cloud, the Tenkan-sen above the Kijun-sen, and the lagging span above the price of 26 bars ago. When all three hold, it's read as the strongest bullish shape. When [ADX](/guide/indicators/adx) is above 25 and price is above the cloud, the trend has both structure and strength behind it, and with price above the 200-day [moving average](/guide/indicators/ma) as well, the larger-timeframe trend points the same way.

## Watch out for

- In a sideways market, price keeps moving in and out of the cloud, producing many conflicting signals. It doesn't work well in such markets.
- Interpretations over short periods are noisy, and meaningful signals come from relatively long timeframes.
- The lagging span is plotted shifted back, so it is tricky to read on a chart. The accurate way to read it is as a comparison of today's close with the price of 26 bars ago.
