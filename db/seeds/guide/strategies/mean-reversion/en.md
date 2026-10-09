---
title: Mean Reversion (Short-Term Oversold Pullback)
aliases: [mean reversion strategy, short-term oversold bounce, buy the dip, pullback bounce, Williams %R oversold]
summary: "Looks at the tendency of stocks in a long-term uptrend to bounce after a sharp drop over a few days."
seoTitle: "Mean Reversion Strategy: Oversold Bounce Rules"
seoDescription: The rule that treats a daily bar above the 200-day line with Williams %R at -90 or below as a pullback candidate, when it ends, and when it fails.
demoCaption: Synthetic, illustrative candles. Shows a bar closing near the bottom of its 2-week range above the 200-day line, and the bounce back above the 5-day line.
faq:
  - q: Does mean reversion only work in sideways markets?
    a: Siglens found otherwise. Filtering for sideways markets only (ADX below 25), or stacking the lower Bollinger Band with RSI below 30, did worse than simple oversold, and sharp short-term drops inside a long-term uptrend were more consistent.
  - q: What conditions have to be met?
    a: On a daily chart, the close must be above the 200-day line and Williams %R(14) must be -90 or below. A reading of -80 to -90 is the near stage, treated as a weaker version.
  - q: Does it work below the 200-day line?
    a: On average prices did bounce, but a further drop of more than 10% within 10 days was far more frequent. So Siglens does not treat it as this setup and describes it only as a higher-risk bounce candidate.
---

## What it is

The strategy comes from the idea that when price moves far from its average, it tends to come back. The short-term reversal effect in stocks has been studied for a long time, and the "RSI(2) pullback" popularized by Larry Connors belongs to the same family.

The rule Siglens uses is a narrow one. It looks only at the tendency of a stock in a long-term uptrend that has dropped sharply over a few days to come back within a few days.

- **Long-term trend**: close above the 200-day moving average
- **Short-term oversold**: [Williams %R](/guide/indicators/williams-r)(14) at -90 or below. This means the bar closed within the bottom 10% of its last 14-bar range.
- **Timeframe**: daily bars

## What it tells you

When all three conditions hold, it is read as "a short-term pullback in a stock in a long-term uptrend", a candidate with room to bounce within a few days. It is not a signal that predicts the future. It is a reference for how things turned out on average after days like this in the past.

- When the close returns above the 5-day moving average, or about 10 trading days pass, one pullback cycle is treated as over.
- If [Connors RSI](/guide/indicators/connors-rsi) is 10 or below, it is treated as confirming the same pullback from another angle, but it is not required.
- A Williams %R of -80 to -90 counts as "near". It points the same way but is a weaker version with a smaller effect.

## How Siglens detects it

With at least 200 daily bars, Siglens judges from the last bar's close, the 200-day line and Williams %R(14). The result is one of four: setup met (above the 200-day line, -90 or below), near (above the 200-day line, -80 to -90), a sharp drop below the 200-day line, or not applicable.

Siglens checked this rule on daily bars of large US stocks from 2000 to 2026. When the period was split into five segments, the average return over the 5 trading days after a setup day was higher than for "any day above the 200-day line" in every segment, including the financial crisis segment.

Some conditions were checked on the same data but did not improve results: requiring ADX below 25, combining the lower Bollinger Band with RSI(14) below 30, waiting for Williams %R to come back above -80 before entering, bullish confirmation such as a reversal candle, and a tight stop. So these are not used as requirements for the setup. The overbought side (-20 or above) is not treated as a bearish signal either.

If there was major news about earnings, guidance or regulation within the last 3 trading days, this record is not applied.

## Watch out for

- The edge is relative. In the financial crisis segment, even the setup had negative 10-day returns; it just lost less than other days.
- The past record of this rule does not cover stocks that fell on information, such as weak earnings or a regulatory shock. Most of the large failures of this setup fall here.
- A sharp drop below the 200-day line more often fell another 10% or more within 10 days.
- The rule was not checked on minute or hourly bars.
- On days when the setup appears, most other indicators are leaning bearish about two times out of three. That does not invalidate the setup.
