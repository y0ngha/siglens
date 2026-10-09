---
title: "Williams %R"
aliases: [Williams %R, Williams Percent Range, "%R", Williams R]
summary: "A momentum indicator from 0 to -100 showing how far the close is below the highest high of the recent period."
seoTitle: "Williams %R: What -20 and -80 Mean"
seoDescription: "How Williams %R is calculated, the -20 and -80 levels, signals when it leaves a zone, why it is the same as the Stochastic, and where it misleads in trends."
demoCaption: "Synthetic, illustrative bars. Price drops close to its recent low, %R sits below -80, and then rises back above -80."
faq:
  - q: "How is Williams %R different from the Stochastic?"
    a: "It is the fast Stochastic %K minus 100, so it shows the same information on a different scale. Using both does not add new signals, so it makes sense to pick one."
  - q: "Should I buy when Williams %R is below -80?"
    a: "It only means an oversold zone, not a buy signal. The moment %R leaves the zone upward past -80 is usually treated as the signal rather than being inside it, and in a strong downtrend it can stay there for a long time."
---

## How it's calculated

Williams %R was created by Larry Williams. Over a recent period (standard 14), it shows how far below the highest high today's close sits within the range of the highest high and lowest low. It runs from 0 to -100: near 0 means the close is near the period high, and near -100 means it is near the period low.

It equals the fast [Stochastic](/guide/indicators/stochastic) %K minus 100 (%R = %K − 100), so it is the same indicator on a different scale.

## What it tells you

- Above -20 (0 to -20) is the overbought zone. In a sideways market it points to a possible pullback; in a strong uptrend it can mean the trend continuing while it stays there for a long time.
- Below -80 (-80 to -100) is the oversold zone. In a sideways market, a bounce is the thing to watch for.
- Between -20 and -80 is neutral.
- %R crossing up through -80 is a sign of upward momentum turning away from the low, and crossing down through -20 is a sign of downward momentum turning. Treating the moment of leaving a zone as the signal, rather than being inside it, filters out many false signals during strong trends.
- Failure swings and divergence are watched too. They are said to be more reliable when they occur in the overbought or oversold zones.

## How Siglens detects it

Siglens uses a period of 14 and marks the last bar's %R at -20 or above as overbought and at -80 or below as oversold. It reads the cross out of a zone as the basic signal, and failure swings and divergence as supporting ones.

There is one exception. When the daily close is above the 200-day moving average, it looks at the value inside the zone itself rather than waiting for a cross. When Siglens checked data since 2000 across several periods, days when %R closed at -90 or below under this condition had better 5-day returns than usual in every period. In periods when the whole market fell sharply, the difference was in losing less. By contrast, waiting for the cross back above -80 and then entering made this difference disappear. This case is also covered in the [mean reversion strategy](/guide/strategies/mean-reversion).

Siglens also refers to pairing [MACD](/guide/indicators/macd) for trend direction with %R for timing, and to %R signals that coincide with the lower Bollinger Band.

## Watch out for

- In a strong trend, it can stay above -20 for several bars. Expecting a decline just because it is overbought tends to go wrong.
- It carries the same information as the Stochastic, so using both does not make signals twice as reliable.
- The 14 period is the standard for daily charts. Some use 10 on shorter timeframes and 21 for a longer view.
- It does not account for volume. Check with volume indicators such as [MFI](/guide/indicators/mfi) or OBV.
