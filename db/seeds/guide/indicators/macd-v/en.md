---
title: "MACD-V"
aliases: [MACD-V, MACD V, Volatility Normalised MACD, Volatility Normalized MACD]
summary: "Divides MACD by ATR to measure momentum against volatility, so levels like ±150 work across stocks and periods."
seoTitle: "MACD-V Explained: The ±150 Levels"
seoDescription: How MACD-V differs from MACD, how dividing by ATR(26) works, and how to read its ±150 overbought and oversold levels with a trend filter.
demoCaption: "Synthetic, illustrative bars. The marked stretch is where MACD-V rises above +150 and then drops back below it."
faq:
  - q: "How is MACD-V different from MACD?"
    a: "MACD uses the difference between two exponential moving averages in price units. MACD-V divides that difference by the 26-day ATR and turns it into a percentage, so the same reference levels work across different stocks."
  - q: "What does ±150 mean?"
    a: "At +150 or above it is treated as overbought, and at −150 or below as oversold. About 95% of values fall within ±150. In an uptrend, though, pullbacks often end near −100 rather than −150."
  - q: "Should I buy when MACD-V goes through −150?"
    a: "That is not how it is read. MACD-V is not a trading signal; it is supporting information that describes the momentum state alongside trend direction."
---

## How it's calculated

In one line: it divides the [MACD](/guide/indicators/macd) value by the stock's normal wobble, so different stocks can be read on the same scale.

MACD-V = (12-day EMA − 26-day EMA) ÷ 26-day [ATR](/guide/indicators/atr) × 100

ATR is the average size of recent bars' moves. Dividing momentum (the force behind price moves) by this average range shows, as a percentage, how strong the push is compared with normal wobble. The signal line is the 9-day EMA of MACD-V.

A similar idea is PPO, which divides MACD by price to turn it into a percentage. PPO only solves comparisons between different periods of the same stock; MACD-V can also compare across different markets. The original paper reports that the same ±150 levels held for the S&P, German Bunds and natural gas.

Alex Spiroglou proposed it in his 2022 paper "MACD-V: Volatility Normalised Momentum" (SSRN 4099617).

## What it tells you

What follows is the traditional reading Spiroglou proposed. Siglens uses it as context about the momentum state, not as a trading signal.

- ±150: the outer boundary that values reach only rarely. Most values (about 95%) move inside these lines; +150 or above is read as overbought (risen too far), and −150 or below as oversold (fallen too far). Crossing −150 from below is read as oversold relief; crossing +150 from above as a turn down after being overbought.
- ±50 marks the boundary between weak and strong momentum, and the zero line is where momentum changes direction.
- Momentum stages: Spiroglou reads the value together with its direction and sorts it into stages such as ranging, rallying, rebounding, retracing, reversing and risk. It does not split things into just buy or sell.
- Asymmetry by trend: when Spiroglou used the 200-day EMA as the trend reference, pullbacks (temporary dips within an uptrend) in an uptrend with price above it often ended near −100 instead of −150.

## How Siglens detects it

Siglens flags the stretches where MACD-V moves outside ±150.

- Calculation: the 12, 26, 9 settings, divided by the 26-day ATR.
- Flag: when the value enters the zone at or above +150 or at or below −150.
- Interpretation: it pays particular attention to oversold relief (crossing up through −150) and overbought relief (crossing down through +150).

When Siglens checked two years of data, simply entering these zones did not clearly change subsequent returns. The original paper classifies momentum states rather than claiming profits, so the two do not conflict. Siglens therefore uses MACD-V only as context that describes the momentum state alongside trend direction, and gives it weight only when it overlaps with other signals.

## Watch out for

- ±150 is a convention, not a law. In an uptrend above the trend reference line, real oversold can be near −100.
- Because it divides by ATR, readings can be inflated when volatility is very low. Check extreme values against a volatility indicator such as [EWMA volatility](/guide/indicators/ewma-volatility) or Yang-Zhang.
- In a strong trend, ±150 can be the backdrop of trend continuation rather than a pullback. A regime indicator such as the [Hurst exponent](/guide/indicators/hurst) helps tell the two apart.
