---
title: MACD Grand Cycle Analysis
aliases: [MACD grand cycle, MACD upper middle lower, exponential moving average grand cycle, MACD cycle]
summary: "Builds upper, middle and lower MACD from three EMAs and reads the market as one of six stages by their signs."
seoTitle: "MACD Grand Cycle: Reading the 6 Stages"
seoDescription: What the upper, middle and lower MACD built from EMA 9, 21 and 60 are, the six stages set by their signs, and the signals when the stage changes.
demoCaption: Synthetic, illustrative candles. Shows where the order of EMA 9, 21 and 60 changes and the three MACD values dropping below the zero line one after another at those points.
faq:
  - q: What are the upper, middle and lower MACD?
    a: The upper is EMA 9 minus EMA 21, the middle is EMA 9 minus EMA 60, and the lower is EMA 21 minus EMA 60. Whether each is above or below zero tells you the order of the EMAs.
  - q: How is it different from the regular MACD?
    a: The regular MACD looks at one gap only, between EMA 12 and 26. The grand cycle analysis looks at all three EMA pairs and tells the six stages apart by the combination of signs. The regular MACD (12, 26, 9) is used only as a secondary reference.
  - q: Is it the same as the moving average grand cycle analysis?
    a: The framework is the same, but the lines differ. The moving average grand cycle uses simple 5-, 20- and 60-day averages, and the MACD grand cycle uses exponential 9, 21 and 60, so the results differ.
---

## How it's calculated

Three exponential moving averages ([EMA](/guide/indicators/ema)) produce three difference values.

- **MACD (upper)** = EMA 9 − EMA 21
- **MACD (middle)** = EMA 9 − EMA 60
- **MACD (lower)** = EMA 21 − EMA 60

A value above 0 means the first EMA is on top, and the moment a value crosses 0 is the moment the two EMAs cross. The combination of the three signs divides the market into six stages.

| Stage | Description | Upper | Middle | Lower |
|---|---|---|---|---|
| 1 | Stable uptrend | + | + | + |
| 2 | Turning down, phase 1 | − | + | + |
| 3 | Turning down, phase 2 | − | − | + |
| 4 | Stable downtrend | − | − | − |
| 5 | Turning up, phase 1 | + | − | − |
| 6 | Turning up, phase 2 | + | + | − |

## What it tells you

What follows is the traditional reading from grand cycle theory. Siglens uses it as context for describing what state the market is in.

The stages cycle in the order 1 to 2 to 3 to 4 to 5 to 6 and back to 1. The upper crosses 0 first, then the middle, and the lower last. So a value close to 0 means the next stage is close.

A return from stage 2 to stage 1 is treated as a pullback inside an uptrend (a brief dip before the rise resumes). A move to stage 5 and back to stage 4 is treated as a temporary bounce inside a downtrend. Whether it is a temporary retracement or a real turn is judged by whether EMA 60 keeps moving in its original direction.

Some interpretations split how far an upside turn has progressed into three steps.

- **Earliest hint**: late in stage 4, when the lower is approaching 0
- **Early**: in stage 5, when the upper has just turned positive and the middle is approaching 0
- **Mature**: in stage 6, when all three values point up and the regular MACD (12, 26, 9) histogram (the MACD line minus its 9-period average, called the signal line) is positive and growing

Siglens does not use these steps as times to buy or sell. It refers to them only to describe how far a turn has come.

## How Siglens detects it

Siglens calculates the upper, middle and lower from the last bar's EMA 9, 21 and 60, and matches whether each of the three values is above or below 0 to the table above to set the current stage.

When the regular [MACD](/guide/indicators/macd) (12, 26, 9) line crosses above its signal line (golden cross) or below it (death cross) within the last 3 bars, Siglens looks at this analysis too. For interpretation, it checks:

- Whether the values are far enough from 0. If even one is close to 0, a transition is considered in progress and it is read as neutral.
- Whether the slope of EMA 60 points the same way as the stage
- The direction of the regular MACD histogram. It is built from EMA 12 and 26, so it is not identical to the middle MACD and is used only as a secondary check.

The original theory anticipates transitions from the signal-line crossover of each of the upper, middle and lower, but Siglens judges it by how close the three values are to the zero line. Stages 1, 5 and 6 are treated as leaning upward, and stages 2, 3 and 4 as leaning downward.

A study found that timing trades with moving average crossovers lost its edge when tested on new data from after 1986 (Sullivan, Timmermann & White, 1999).

## Watch out for

- In a sideways market all three values gather near 0 and the stage changes often.
- A gap such as one from an earnings release can briefly shake the EMA order.
- When the stage flips back and forth in a row, the signal is less reliable.
- The EMA periods 9, 21 and 60 are Siglens defaults and may differ from the periods the original theory recommends.
- Looking at one timeframe alone can miss a disagreement with the direction on a larger timeframe.
