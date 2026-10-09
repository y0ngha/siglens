---
title: Bollinger %B and BandWidth
aliases: ["%B", Percent B, BandWidth, Bollinger Band width, Bollinger %B]
summary: "%B gives price's position inside the Bollinger Bands as a number. BandWidth gives how wide the bands are."
seoTitle: "Bollinger %B Meaning and BandWidth Squeeze"
seoDescription: "How Bollinger %B and BandWidth are calculated, how to read the 0.95 and 0.05 pullback signals and the squeeze, and why a band touch alone is not a signal."
demoCaption: Synthetic, illustrative bars. They show %B dropping below 0.95 as price climbs near the upper band and then comes back down.
faq:
  - q: How do I read Bollinger %B?
    a: 0 means price is on the lower band and 1 means it is on the upper band. Above 1 is outside the upper band, and below 0 is outside the lower band.
  - q: "Should I sell if %B stays above 0.8?"
    a: Staying above 0.8 or below 0.2 without a crossing back is read as a trend moving along the band (a band walk), not as a move back toward the average. So it is not read as a counter-trend signal.
  - q: Which way does price move when BandWidth narrows?
    a: There's no way to know. BandWidth shows only the size of volatility and carries no direction, so a separate trend filter such as MACD or ADX is needed.
---

## How it's calculated

Both are derived from [Bollinger Bands](/guide/indicators/bollinger-bands) by John Bollinger (based on 20, 2).

- %B = (close - lower band) ÷ (upper band - lower band). It is 0 on the lower band and 1 on the upper band. Above 1 is outside the upper band, and below 0 is outside the lower band.
- BandWidth = (upper band - lower band) ÷ middle band × 100. It shows only the size of volatility, with no direction.

%B answers where price is within the bands. BandWidth answers how wide the bands themselves are.

## What it tells you

When BandWidth shrinks to the lowest level in many bars, that is a squeeze. Volatility is compressed, so a directional move is likely soon, but BandWidth alone can't tell you the direction. When BandWidth widens, it confirms that real volatility is behind a breakout.

For %B, a crossing that goes all the way to the edge and comes back is read as a mean-reversion signal (price moving back toward the average).

- %B falling through 0.95 from above means price has backed off from the upper edge, which is read as a downward pullback.
- %B rising through 0.05 from below means price has bounced off the lower edge, which is read as an upward pullback.
- A divergence, such as price making lower lows while %B makes higher lows, is what Bollinger himself names as a better-quality reversal pattern.

## How Siglens detects it

Siglens flags the two crossings above as signals. If the previous bar's %B was at or above 0.95 and this bar drops below 0.95, it is a downward pullback signal. If the previous bar was at or below 0.05 and this bar rises above 0.05, it is an upward pullback signal. If %B stays above 0.80 or below 0.20 without crossing back, it is treated as a trend and not traded against.

Siglens checked this on two years of data for 10 large US stocks. On daily bars, after %B came down below 0.95, price tended to drift lower on average over the next 5 to 10 bars. After %B rose back above 0.05, the tendency to rise was not clear. The downward effect wasn't large either, so the upward signal is weighted below the downward one, and neither is used alone without a confirming indicator.

For confirmation, Siglens adds money-flow indicators such as [MFI](/guide/indicators/mfi), volume, and reversal candles, rather than RSI or MACD, which repeat the same momentum. An extreme %B inside a squeeze, where BandWidth is narrow, is more likely the start of rising volatility than a pullback. So crossings are trusted more when BandWidth is normal or wide.

## Watch out for

- Bollinger himself said that touching a band is just a touch, not a signal. Don't decide on a %B crossing alone without confirmation.
- The tendency above is for a short horizon of about 5 to 10 bars on daily charts. Don't carry it over as is to minute charts or to spans of several weeks.
- In a clear trend, %B stays at the extreme for a long time, and counter-trend trades are likely to lose.
- BandWidth tells you only that volatility is growing. Direction has to be judged separately.
