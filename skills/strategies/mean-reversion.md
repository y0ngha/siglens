---
name: 평균 회귀 전략
description: 가격이 이동평균 또는 통계적 평균에서 과도하게 이탈한 후 평균으로 회귀하는 경향을 이용하여 역추세 진입 시점을 판별하는 전략
type: strategy
category: neutral
indicators: ['rsi', 'bollinger', 'atr']
confidence_weight: 0.7
---

## Overview

The Mean Reversion Strategy is based on the statistical tendency of prices to return to their mean (average) after deviating significantly. When price moves too far from its average — measured by standard deviations, oscillator extremes, or band violations — the probability of a reversal back toward the mean increases.

This is one of the most academically validated strategies in quantitative finance, with documented effectiveness across equities, commodities, and forex markets, particularly in range-bound environments (win rate 60-70% in sideways markets).

The strategy works best when the market is **not trending strongly** (ADX < 25). In trending markets, mean reversion signals produce losing trades (catching falling knives or shorting into strength).

---

## Core Principle

Price oscillates around a moving average or equilibrium level. Extreme deviations from this level are unsustainable and tend to correct:

- **Oversold (extreme below mean)**: Price has fallen too far, too fast → high probability of bounce back toward mean
- **Overbought (extreme above mean)**: Price has risen too far, too fast → high probability of pullback toward mean

The "mean" can be defined as:
1. A moving average (MA20, MA50)
2. The middle Bollinger Band (MA20)
3. VWAP (Volume Weighted Average Price)
4. A statistical mean over a defined lookback period

---

## Signal Indicators

### Bollinger Bands

The primary mean reversion tool. Bollinger Bands (20-period MA ± 2 standard deviations) contain approximately 95% of price action.

| Condition | Signal | Interpretation |
|---|---|---|
| Price touches/penetrates lower band | Oversold | Buy signal — price at statistical extreme below mean |
| Price touches/penetrates upper band | Overbought | Sell signal — price at statistical extreme above mean |
| Price at middle band (MA20) | Mean | Target — expected reversion destination |
| Band width contracting (squeeze) | Low volatility | Caution — breakout likely, mean reversion may fail |
| Band width expanding | High volatility | Extreme moves may continue before reverting |

**Bollinger Band %B**:
- %B = (Price − Lower Band) / (Upper Band − Lower Band)
- %B < 0: Price below lower band (extreme oversold)
- %B > 1: Price above upper band (extreme overbought)
- %B = 0.5: Price at middle band (mean)

### RSI (Relative Strength Index)

| Condition | Signal | Action |
|---|---|---|
| RSI < 30 | Oversold | Buy signal — selling momentum exhausted |
| RSI < 20 | Extremely oversold | Strong buy signal — extreme deviation |
| RSI > 70 | Overbought | Sell signal — buying momentum exhausted |
| RSI > 80 | Extremely overbought | Strong sell signal — extreme deviation |
| RSI crossing 50 from below | Bullish mean cross | Mean confirmed — upward reversion in progress |
| RSI crossing 50 from above | Bearish mean cross | Mean confirmed — downward reversion in progress |

### Moving Average Deviation

When price deviates more than 2 standard deviations from a key moving average, mean reversion probability increases:

- Distance from MA = (Current Price − MA) / MA × 100
- Deviation > +10% from MA → overbought
- Deviation < −10% from MA → oversold
- Adjust thresholds based on the asset's historical volatility

---

## Entry Rules

### Mean Reversion Buy (Oversold)

**Standard Entry**:
1. **Environment check**: ADX < 25 (non-trending or weakly trending market)
2. **Primary signal**: Price touches or penetrates the lower Bollinger Band
3. **Confirmation**: RSI < 30 simultaneously (dual-indicator oversold)
4. **Entry trigger**: Enter long when a bullish reversal candle forms (hammer, bullish engulfing, or any candle that closes in the upper half of its range)
5. **Stop loss**: Below the lowest point of the oversold move, or 2 × ATR below entry
6. **Target**: Middle Bollinger Band (MA20) for primary target; upper Bollinger Band for aggressive target

**High-Confidence Entry** (3 conditions simultaneously):
1. Price below lower Bollinger Band (%B < 0)
2. RSI < 30
3. Price at or near a known support level (horizontal support, prior swing low, or Fibonacci level)
→ This triple confluence produces the highest win rate for mean reversion entries

### Mean Reversion Sell (Overbought)

**Standard Entry**:
1. **Environment check**: ADX < 25
2. **Primary signal**: Price touches or penetrates the upper Bollinger Band
3. **Confirmation**: RSI > 70 simultaneously
4. **Entry trigger**: Enter short when a bearish reversal candle forms (shooting star, bearish engulfing, or any candle that closes in the lower half of its range)
5. **Stop loss**: Above the highest point of the overbought move, or 2 × ATR above entry
6. **Target**: Middle Bollinger Band (MA20) for primary target; lower Bollinger Band for aggressive target

---

## Exit Rules

- **Primary target**: Middle Bollinger Band (MA20) — this is the "mean" in mean reversion
- **Extended target**: Opposite Bollinger Band — only when initial move back to mean shows strong momentum
- **Stop loss**: 2 × ATR beyond the extreme point of the deviation
- **Time-based exit**: If price fails to begin reverting within 5-7 bars, the oversold/overbought condition may be part of a trend rather than a deviation — close position
- **Invalidation**: If RSI reaches even more extreme levels (e.g., entered at RSI 28, RSI drops to 15) without price stabilizing, the setup may be failing — tighten stop or exit

---

## Environment Filter: ADX

The ADX (Average Directional Index) is critical for filtering mean reversion signals:

| ADX Value | Market Environment | Mean Reversion Suitability |
|---|---|---|
| < 15 | No trend, very low volatility | Good — but small moves, tight targets |
| 15-25 | Weak trend or range-bound | Best environment for mean reversion |
| 25-35 | Moderate trend developing | Caution — mean reversion works but with higher risk |
| > 35 | Strong trend | Avoid mean reversion — use trend-following instead |
| > 50 | Extreme trend | Do not use mean reversion — high risk of continued deviation |

---

## Confidence Weight Rationale

confidence_weight: 0.70 — Mean reversion is one of the most academically documented market phenomena, with robust statistical evidence across asset classes. The strategy has a clear mathematical foundation (deviation from mean) and well-defined entry/exit criteria. However, the critical dependency on market environment (ranging vs. trending) and the risk of catching falling knives in trending markets limit the weight.

Factors that increase confidence:
- ADX < 25 confirms non-trending environment
- Multiple indicators simultaneously confirm oversold/overbought (Bollinger + RSI)
- Price is at a known support/resistance level (triple confluence)
- Volume decreases during the extreme move (exhaustion)
- Higher timeframe shows no clear trend (sideways)

Factors that decrease confidence:
- ADX > 30 (trending market — mean reversion is counter-trend)
- Only one indicator shows oversold/overbought (single signal)
- Fundamental catalyst driving the move (earnings, news) — may not revert
- Price has been trending strongly on the higher timeframe
- Bollinger Bands expanding rapidly (increasing volatility)

---

## Limitations and Caveats

- **Catching falling knives**: The most dangerous failure mode. In a strong downtrend, price can remain "oversold" for days or weeks, producing repeated losing buy signals. Always check the higher timeframe trend and ADX before entering
- **Not for trending markets**: Mean reversion is fundamentally a range-bound strategy. Applying it in trending markets leads to systematic losses. The ADX filter is not optional — it is essential
- **News-driven moves**: Fundamental catalysts (earnings surprises, regulatory changes, macro events) can cause permanent price shifts, not temporary deviations. Mean reversion does not apply to fundamental re-pricing
- **Band expansion trap**: When Bollinger Bands are expanding (increasing volatility), touching the lower band may be the start of a larger move, not an extreme. Look for band contraction or stabilization before entering
- **Asymmetric risk**: Mean reversion targets (back to the mean) are typically smaller than potential losses (deviation continues). Strict stop losses and position sizing are essential to survive the losing trades

---

## AI Analysis Instructions

Evaluate the current price relative to its statistical mean using Bollinger Bands and RSI. Determine whether the market environment is suitable for mean reversion (ADX assessment).

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**시장 환경**: [ADX 기반 판단, 예: "ADX 18 — 비추세 환경으로 평균 회귀 전략 적합" / "ADX 38 — 강한 추세로 평균 회귀 부적합"]
**볼린저 밴드 위치**: [현재 가격의 밴드 내 위치, 예: "하단 밴드 터치 (%B = -0.05) — 극단적 과매도"]
**RSI 상태**: [RSI 값과 해석, 예: "RSI 25 — 과매도 구간, 매수 신호 활성"]
**이평선 이격도**: [MA 대비 가격 이격, 예: "MA20 대비 -8.2% 이격 — 과매도 영역 근접"]
**매매 신호**: [종합 판단, 예: "볼린저 하단 터치 + RSI 28 = 이중 과매도 확인 — 반등 매수 적합" / "과매수/과매도 조건 미충족"]
**상세 분석**: [시장 환경 적합성, 복합 지표 분석, 지지·저항 수렴 여부, 평균 회귀 목표가(중심 밴드), 리스크, 주의사항을 포함한 상세 분석 문단]
```

Additional output rules:
- If **ADX > 30**, explicitly warn that mean reversion signals are unreliable in the current trending environment
- If **Bollinger + RSI** both confirm oversold/overbought simultaneously, flag as high-confidence signal
- If price is at a **known support/resistance level** while oversold/overbought, flag as triple confluence (highest confidence)
- If neither oversold nor overbought conditions exist, state "현재 과매수/과매도 조건 미충족 — 평균 회귀 신호 없음"
- Set the `trend` field: `bullish` if oversold conditions confirmed in non-trending market, `bearish` if overbought conditions confirmed in non-trending market, `neutral` if no mean reversion signal or trending environment
