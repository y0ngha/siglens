---
title: Bollinger %B and BandWidth
aliases: ["%B", Percent B, BandWidth, Bollinger Band width, Bollinger %B]
summary: "%B gives price's position inside the Bollinger Bands as a number. BandWidth gives how wide the bands are."
seoTitle: "Bollinger %B Meaning and BandWidth Squeeze"
seoDescription: How Bollinger %B and Bandwidth are calculated, what it signals when %B turns back from 0.95 or 0.05, and how to read a squeeze.
demoCaption: Synthetic, illustrative bars. They show %B dropping below 0.95 as price climbs near the upper band and then comes back down.
faq:
  - q: How do I read Bollinger %B?
    a: 0 means price is on the lower band and 1 means it is on the upper band. Above 1 is outside the upper band, and below 0 is outside the lower band.
  - q: "Should I sell if %B stays above 0.8?"
    a: Staying above 0.8 or below 0.2 without a crossing back is read as a trend moving along the band (a band walk), not as a move back toward the average. So it is not read as a counter-trend signal.
  - q: Which way does price move when BandWidth narrows?
    a: There's no way to know. BandWidth shows only the size of volatility and carries no direction, so a separate trend indicator such as MACD or ADX (which measures trend strength) is needed.
---

## How it's calculated

Both are derived from [Bollinger Bands](/guide/indicators/bollinger-bands) by John Bollinger (based on 20, 2).

- %B = (close - lower band) ÷ (upper band - lower band). It is 0 on the lower band and 1 on the upper band. Above 1 is outside the upper band, and below 0 is outside the lower band.
- BandWidth = (upper band - lower band) ÷ middle band × 100. It shows only the size of volatility, with no direction.

%B answers where price is within the bands. BandWidth answers how wide the bands themselves are.

## What it tells you

What follows is the traditional reading Bollinger laid out. SIGLENS uses it as context alongside other evidence, not as a standalone signal.

When BandWidth shrinks to the lowest level in many bars, that is a squeeze. Volatility is compressed, so a directional move is likely soon, but BandWidth alone can't tell you the direction. When BandWidth widens, it confirms that real volatility is behind a breakout.

For %B, a crossing that goes all the way to the edge and comes back is read as a mean-reversion signal (price moving back toward the average).

- %B falling through 0.95 from above means price has backed off from the upper edge, which is read as a downward pullback.
- %B rising through 0.05 from below means price has bounced off the lower edge, which is read as an upward pullback.
- When the two disagree, such as price making lower lows while %B makes higher lows (a divergence), Bollinger himself names it as a more reliable reversal pattern.

## How SIGLENS detects it

SIGLENS catches the moment %B reaches a band edge and turns back inside. While %B stays near the edge, it is not read as a pullback signal.

- Downward pullback: the previous bar's %B was at or above 0.95 and this bar drops below 0.95
- Upward pullback: the previous bar's %B was at or below 0.05 and this bar rises above 0.05
- Read as a trend: %B stays above 0.80 or below 0.20 without crossing back. In that case it is not read as a counter-trend signal.

There are several thresholds because each does a different job. 0.95 and 0.05 catch the turn back from the edge, 0.80 and 0.20 separate a trend that keeps hugging the edge, and the 0.98 and 0.02 in the [Bollinger Bands](/guide/indicators/bollinger-bands) article are a stricter check of whether price is pressed against a band on daily bars.

SIGLENS checked this on two years of data for 10 large US stocks. On daily bars, after %B came down below 0.95, price tended to drift lower on average over the next 5 to 10 bars. The downward tendency was small, and the upward side after %B rose back above 0.05 was not even that clear. So SIGLENS puts less weight on the upward signal, and uses neither alone without a confirming indicator.

For confirmation, SIGLENS adds money-flow indicators such as [MFI](/guide/indicators/mfi), volume, and reversal candles, rather than RSI or MACD, which measure the same momentum (the force behind a move) again. An extreme %B inside a squeeze, where BandWidth is narrow, is more likely the start of rising volatility than a pullback. So crossings carry more weight when BandWidth is normal or wide.

## Watch out for

- Bollinger himself said that touching a band is just a touch, not a signal. SIGLENS doesn't decide on a %B crossing alone without confirmation either.
- The tendency above is for a short horizon of about 5 to 10 bars on daily charts. There is no evidence that it holds on minute charts or over several weeks.
- In a clear trend, %B stays at the extreme for a long time, so reading it against the trend is easy to get wrong.
- BandWidth tells you only that volatility is growing. Direction has to be judged separately.
