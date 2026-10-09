---
title: "MACD-V"
aliases: [MACD-V, MACD V, Volatility Normalised MACD, Volatility Normalized MACD]
summary: "Divides MACD by ATR to measure momentum against volatility, so levels like ±150 work across stocks and periods."
seoTitle: "MACD-V Explained: The ±150 Levels"
seoDescription: "How MACD-V differs from MACD, the calculation dividing by the 26-day ATR, the ±150 overbought and oversold levels, and how to read it under a trend filter."
demoCaption: "Synthetic, illustrative bars. The marked stretch is where MACD-V rises above +150 and then drops back below it."
faq:
  - q: "How is MACD-V different from MACD?"
    a: "MACD uses the difference between two exponential moving averages in price units. MACD-V divides that difference by the 26-day ATR and turns it into a percentage, so the same reference levels work across different stocks."
  - q: "What does ±150 mean?"
    a: "At +150 or above it is treated as overbought, and at −150 or below as oversold. About 95% of values fall within ±150. In an uptrend, though, pullbacks often end near −100 rather than −150."
  - q: "Should I buy when MACD-V goes through −150?"
    a: "No. On its own this reading did not produce clearly better returns afterward. It is a supporting indicator that describes the momentum state alongside trend direction."
---

## How it's calculated

Alex Spiroglou proposed it in his 2022 paper "MACD-V: Volatility Normalised Momentum" (SSRN 4099617). The same year it received the NAAIM Founders Award and the CMT Association's Charles H. Dow Award. It extends Gerald Appel's [MACD](/guide/indicators/macd).

MACD-V = (12-day EMA − 26-day EMA) ÷ 26-day [ATR](/guide/indicators/atr) × 100

The signal line is the 9-day EMA of MACD-V. By dividing momentum by average volatility, it expresses how strong the push is relative to normal wobble, as a percentage. PPO, which turns MACD into a ratio to price, only solves comparisons between different periods of the same stock; MACD-V can also compare across different markets. The original paper reports that the same ±150 levels held for the S&P, German Bunds and natural gas.

## What it tells you

- ±150: an absolute value of 150 or more is the outer zone that contains about 95% of readings, so it counts as overbought or oversold. Crossing −150 from below is read as oversold relief; crossing +150 from above is read as a turn down after overheating.
- ±50 marks the boundary between weak and strong momentum, and the zero line is where the momentum regime changes.
- Momentum lifecycle: Spiroglou reads the value together with its direction and sorts it into several states, such as ranging, rallying, rebounding, retracing, reversing and risk. It does not split things into just buy or sell.
- Asymmetry by trend: in an uptrend with price above the 200-day EMA, pullbacks often end near −100 instead of −150.

## How Siglens detects it

Siglens calculates it with the 12, 26, 9 settings, divided by the 26-day ATR, and flags the stretches where the value is at or above +150 or at or below −150. In interpretation it pays particular attention to oversold relief (crossing up through −150) and overheating relief (crossing down through +150).

When Siglens checked two years of data, simply entering these zones did not clearly change subsequent returns. The original paper classifies momentum states rather than claiming profits, so the two do not conflict. Siglens therefore uses MACD-V only as context that describes the momentum state alongside trend direction.

## Watch out for

- Used alone, it showed no clear effect. It carries weight only when it overlaps with other signals.
- ±150 is a convention, not a law. Under a trend filter, real oversold can be near −100.
- Because it divides by ATR, readings can be inflated when volatility is very low. Check extreme values against a volatility indicator such as [EWMA volatility](/guide/indicators/ewma-volatility) or Yang-Zhang.
- In a strong trend, ±150 can be the backdrop of trend continuation rather than a pullback. Read it together with a regime indicator such as the [Hurst exponent](/guide/indicators/hurst).
