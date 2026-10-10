---
title: 52-Week High Momentum
aliases: [52-week high, 52-week low, 52-week high breakout, new high momentum, George and Hwang 52-week high]
summary: "A 52-week high is read as strength that tends to continue, a 52-week low as weakness that tends to continue."
seoTitle: Trading 52-Week Highs as a Momentum Signal
seoDescription: Why stocks near their 52-week high tend to keep rising, how to screen new highs with Minervini's trend template, and where the approach falls short.
demoCaption: Synthetic, illustrative candles. Shows the 52-week high line, the bar that closes above it, and the 20- and 60-day moving averages stacked in rising order (Siglens' own check uses the 60-, 120- and 200-day lines).
faq:
  - q: Isn't a 52-week high a risky sign because the stock has already run up?
    a: The research points the other way. Stocks near their 52-week high tended to keep outperforming. But the study looked at averages across groups of stocks, so it does not promise anything for a single stock.
  - q: Can I expect a bounce from a 52-week low?
    a: In the same study, stocks near their lows tended to keep underperforming. A new low alone is not evidence of a bottom. You need separate evidence, such as a reversal pattern or a structural breakout.
  - q: Isn't RSI above 70 a sell signal?
    a: In strong trends that make new highs, RSI above 70 (the overbought zone) is common, so it is not evidence of weakness by itself.
---

## What it is

A close above every high of the past year is a 52-week high. A close below every low of the past year is a 52-week low. On a chart, a new high looks like price clearing the one-year high line for the first time.

The intuition says "it has risen this much, so it must fall soon." The research points in the opposite direction.

## What it tells you

George and Hwang (2004, Journal of Finance) showed that ranking stocks by how close they are to their 52-week high helps explain later returns. They compared it with two other measures: "past-return momentum," the idea that stocks that rose most over recent months keep rising (momentum is the tendency of a rising price to keep rising), and "industry momentum," the idea that stocks in the strongest industries keep rising. Nearness to the 52-week high did better even when tested alongside both, and the effect did not reverse over the long run. The authors explain it by investors anchoring on the 52-week high and reacting slowly to good news.

So a new high is read as a candidate for continuing momentum, not as a sell signal warning that the stock is overbought (risen so far that it may be pushed back). It counts as a stronger signal when the [moving averages](/guide/indicators/ma) are stacked upward and the breakout bar's volume is above normal. Mark Minervini's trend template, which comes from practical experience, also picks stocks that are rising above their long moving averages and sit near the 52-week high.

A move through a prior high is also a form of [breakout](/guide/strategies/breakout).

A new low is a sign that weakness is continuing. A low alone does not point to a bounce or a bottom.

## How Siglens detects it

Siglens checks whether the last close has broken above or below the past year's price range. The rules are:

- **New high**: the last close is above every high in the prior 52 weeks (from 365 days before the last bar up to just before the last bar).
- **New low**: the last close is below every low in the same window.
- **History length**: at least 358 days of data are required. If the date 365 days back falls on a weekend or holiday there is no bar for it, so a few days of slack are allowed. A stock listed less than a year ago produces no signal.

When a new high appears, Siglens also checks the moving-average alignment:

- The 60-day line is above the 120-day line.
- The 120-day line is above the 200-day line.
- The 200-day line is rising.

Whether the close is above the 120-day and 200-day lines is not counted separately. A close above the one-year high is bound to be above both.

Siglens does not state a hit rate, returns by holding period, or a price target for a single stock. The research covers groups of stocks and does not promise figures for any single new high.

## Watch out for

- The research reports portfolio-level, monthly results. A daily signal on one stock is noisier.
- Using a new low as a contrarian buy signal (buying against the crowd) has no support.
- A new high with mixed moving-average alignment does not meet the trend template.
- A new high on ordinary volume gives little confirmation of breakout strength.
- For recently listed stocks, the 52-week basis does not exist yet.
