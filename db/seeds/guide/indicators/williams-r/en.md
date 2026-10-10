---
title: "Williams %R"
aliases: [Williams %R, Williams Percent Range, "%R", Williams R]
summary: "A momentum indicator from 0 to -100 showing how far the close is below the highest high of the recent period."
seoTitle: "Williams %R: What -20 and -80 Mean"
seoDescription: Williams %R's -20 and -80 levels, the signal when it leaves those zones, why it is essentially the same indicator as the stochastic, and when it misleads in a trend.
demoCaption: "Synthetic, illustrative bars. Price drops close to its recent low, %R sits below -80, and then rises back above -80."
faq:
  - q: "How is Williams %R different from the Stochastic?"
    a: "It is the Stochastic %K before smoothing, minus 100, so it shows the same information on a different scale. Reading both does not double your confidence. But SIGLENS's Stochastic is slow %K, smoothed once, so comparing which one reaches an extreme first can be a hint."
  - q: "Should I buy when Williams %R is below -80?"
    a: "It only means an oversold zone, not a buy signal. The moment %R leaves the zone upward past -80 is usually treated as the signal rather than being inside it, and in a strong downtrend it can stay there for a long time. One exception: when the daily close is above the 200-day moving average, SIGLENS looks at a close at -90 or below by itself. In the past, 5-day returns after such days were better than usual, and waiting for the -80 cross made that difference disappear. This too is a past tendency, not a buy signal."
---

## How it's calculated

Williams %R was created by Larry Williams. Over a recent period (standard 14), it shows how far below the highest high today's close sits within the range of the highest high and lowest low. It runs from 0 to -100: near 0 means the close is near the period high, and near -100 means it is near the period low.

It equals the [Stochastic](/guide/indicators/stochastic) %K before smoothing (fast %K) minus 100 (%R = %K − 100), so it is the same indicator on a different scale.

## What it tells you

- Above -20 (0 to -20) is the overbought zone, meaning the close is near the top of the recent range. In a sideways market it can be read as a possible pullback; in a strong uptrend, as the trend continuing while %R stays there for a long time.
- Below -80 (-80 to -100) is the oversold zone, meaning the close is near the bottom of the recent range. In a sideways market, a bounce is the thing to watch for.
- Between -20 and -80 is neutral.
- %R crossing up through -80 is read as the close moving away from the low and upward force (momentum) returning, and crossing down through -20 as the force turning downward. Treating the moment of leaving a zone as the signal, rather than being inside it, filters out many false signals during strong trends.
- Failure swings (the indicator turning back without clearing its earlier high or low) and divergence (price and indicator moving in different directions) are watched too. They get more weight when they occur in the overbought or oversold zones.

## How SIGLENS detects it

SIGLENS checks whether the close is pinned to the top or bottom of the recent range, and reads the moment it leaves that zone as the basic signal.

- It uses a period of 14.
- It marks the last bar's %R at -20 or above as overbought and at -80 or below as oversold.
- It reads the cross out of a zone as the basic signal, and failure swings and divergence as supporting signals.

There is one exception. When the daily close is above the 200-day moving average, it looks at the value inside the zone itself rather than waiting for a cross. When SIGLENS checked data since 2000 across several periods, days when %R closed at -90 or below under this condition had better 5-day returns than usual in every period. In periods when the whole market fell sharply, the difference was in losing less. By contrast, counting from the cross back above -80 made this difference disappear. This describes a past tendency, not a buy signal. This case is also covered in the [mean reversion strategy](/guide/strategies/mean-reversion).

SIGLENS also refers to pairing [MACD](/guide/indicators/macd) for trend direction with %R for timing, and to cases where an oversold %R coincides with the lower Bollinger Band.

## Watch out for

- In a strong trend, it can stay above -20 for several bars. Expecting a decline just because it is overbought tends to go wrong.
- It carries the same information as the Stochastic, so using both does not make signals twice as reliable. But SIGLENS's Stochastic is the smoothed slow %K, so comparing which one reaches an extreme first can be a hint.
- The 14 period is the standard for daily charts. Some use 10 on shorter timeframes and 21 for a longer view.
- It does not account for volume. Check with volume indicators such as [MFI](/guide/indicators/mfi) or OBV.
