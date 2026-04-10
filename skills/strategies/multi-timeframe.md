---
name: 다중 시간대 분석
description: 상위 시간대에서 추세 방향을 확인하고 하위 시간대에서 최적의 진입 타이밍을 잡는 체계적 분석 프레임워크
type: strategy
category: neutral
indicators: ['ma', 'rsi', 'macd']
confidence_weight: 0.75
---

## Overview

Multi-Timeframe Analysis (MTA) is a systematic framework used by professional traders to align trade direction with the dominant trend while optimizing entry timing on lower timeframes. The core principle is simple: **trade in the direction of the higher timeframe trend, enter on the lower timeframe signal**.

This approach dramatically reduces false signals by filtering out trades that conflict with the dominant trend. A buy signal on a 1-hour chart that contradicts a clear downtrend on the daily chart is far more likely to fail than one that aligns with a daily uptrend.

MTA is not a standalone trading system — it is a **meta-strategy** that enhances the accuracy of all other strategies (breakout, divergence, mean reversion, etc.) by adding a directional filter.

---

## Three-Tier Timeframe Structure

Analysis proceeds from the highest timeframe to the lowest, with each tier serving a distinct purpose:

| Tier | Purpose | Typical Timeframes | What to Analyze |
|---|---|---|---|
| Higher TF (Direction) | Determine the dominant trend direction | Weekly / Daily | Trend direction, major support/resistance, market phase |
| Middle TF (Strategy) | Identify trading setups and patterns | Daily / 4-Hour | Chart patterns, indicator setups, key levels, entry zones |
| Lower TF (Timing) | Pinpoint precise entry and exit | 1-Hour / 15-Min | Entry triggers, candlestick patterns, micro-level support/resistance |

### Timeframe Combinations

| Trading Style | Higher TF | Middle TF | Lower TF |
|---|---|---|---|
| Position | Monthly | Weekly | Daily |
| Swing | Weekly | Daily | 4-Hour |
| Short-term | Daily | 4-Hour | 1-Hour |
| Intraday | 4-Hour | 1-Hour | 15-Min |

**Rule**: Each tier should be approximately 4-6× the period of the next lower tier. Using timeframes too close together (e.g., 15-min and 30-min) provides redundant information; too far apart (e.g., monthly and 5-min) creates unactionable gaps.

---

## Core Rules

### Rule 1: Trade Only in the Higher TF Direction

- If the Higher TF shows an uptrend → only take long positions on the Middle and Lower TFs
- If the Higher TF shows a downtrend → only take short positions on the Middle and Lower TFs
- If the Higher TF is range-bound → both directions are acceptable, but with reduced position size

**Never take a counter-trend trade against the Higher TF direction.** This single rule eliminates the majority of losing trades.

### Rule 2: Higher TF Support/Resistance Takes Priority

- A resistance level on the daily chart outweighs a buy signal on the 1-hour chart
- A support level on the weekly chart outweighs a sell signal on the 4-hour chart
- Always check if the Middle/Lower TF trade would run into a Higher TF level before entering

### Rule 3: Minimum Two-Tier Agreement

- Enter only when at least 2 of 3 timeframes agree on direction
- Ideal entry: all 3 tiers align (trend, setup, and timing all bullish or all bearish)
- Never enter when only 1 tier supports the trade

### Rule 4: Higher TF Overrides Lower TF Extremes

- If the Higher TF shows an overbought condition (RSI > 70), ignore bullish signals on the Lower TF
- If the Higher TF shows an oversold condition (RSI < 30), ignore bearish signals on the Lower TF
- Higher TF extreme readings suggest the current trend phase is nearing exhaustion

---

## Analysis Procedure

### Step 1: Higher TF — Establish Direction

Analyze the Higher TF to determine the dominant trend:

1. **Trend identification**: Is price making higher highs and higher lows (uptrend), lower highs and lower lows (downtrend), or neither (range)?
2. **Moving average position**: Is price above or below MA50 and MA200?
3. **Key levels**: Identify the nearest major support and resistance levels
4. **Momentum**: Is RSI trending above 50 (bullish) or below 50 (bearish)?

**Output**: A directional bias — LONG ONLY, SHORT ONLY, or NEUTRAL (range-bound)

### Step 2: Middle TF — Identify Setup

With the directional bias established, analyze the Middle TF for trading setups:

1. **Setup identification**: Look for chart patterns, indicator setups, or price action that aligns with the Higher TF direction
2. **Entry zone**: Identify the price zone where a trade would offer good risk/reward (support for longs, resistance for shorts)
3. **Indicator alignment**: Confirm MACD, RSI, and other indicators support the direction
4. **Invalidation level**: Define the price level that would negate the setup

**Output**: A specific trade setup or "no setup available"

### Step 3: Lower TF — Time the Entry

With a valid setup identified on the Middle TF, use the Lower TF for precise entry timing:

1. **Entry trigger**: Look for a specific candlestick pattern, indicator crossover, or micro-level breakout that confirms the Middle TF setup
2. **Stop loss placement**: Place the stop below the Lower TF swing low (long) or above the Lower TF swing high (short)
3. **Position sizing**: Calculate position size based on the stop loss distance and risk per trade
4. **Execution**: Enter when the trigger fires; do not chase if missed

**Output**: A precise entry price, stop loss, and position size

---

## Alignment Scoring

Rate the multi-timeframe alignment to determine position sizing:

| Alignment | Description | Position Size |
|---|---|---|
| Strong (3/3) | All three timeframes agree on direction | Full position (100%) |
| Moderate (2/3) | Higher and Middle TFs agree; Lower TF neutral or not yet triggered | Reduced position (50-75%) |
| Weak (1/3) | Only one timeframe supports the trade | No entry — wait for better alignment |
| Conflicting | Higher TF contradicts Lower TF direction | No entry — signal is likely a false signal |

---

## Common Patterns by Alignment

### Trend Continuation (Highest Probability)

- **Higher TF**: Clear uptrend (above MA50, MA200, higher highs/lows)
- **Middle TF**: Pullback to support (Fibonacci retracement, MA20, trendline)
- **Lower TF**: Bullish reversal candle or indicator crossover at support
- → Enter long at the Lower TF trigger, targeting the Middle TF resistance

### Trend Reversal (Requires More Confirmation)

- **Higher TF**: Shows signs of exhaustion (RSI divergence, climactic volume)
- **Middle TF**: Bearish pattern forming (head and shoulders, double top)
- **Lower TF**: Breakdown below pattern boundary with volume
- → Enter short at the Lower TF confirmation, but with reduced size due to counter-Higher-TF risk

### Range-Bound Entry

- **Higher TF**: No clear trend; price oscillating between defined support and resistance
- **Middle TF**: Mean reversion setup (Bollinger Band extreme, RSI extreme)
- **Lower TF**: Reversal candle at the range boundary
- → Enter in the direction of mean reversion, targeting the opposite range boundary

---

## Indicator Usage Across Timeframes

| Indicator | Higher TF Usage | Middle TF Usage | Lower TF Usage |
|---|---|---|---|
| Moving Averages | Trend direction (above/below MA50, MA200) | Dynamic support/resistance (MA20, MA50) | Entry trigger (MA5 crossover) |
| RSI | Trend strength (above/below 50) | Overbought/oversold zones | Divergence detection, timing |
| MACD | Trend direction (above/below zero line) | Signal crossovers, histogram direction | Momentum confirmation |
| Bollinger Bands | Trend channel identification | Entry zones (band touches) | Timing (squeeze breakout) |
| Volume | Trend health (expanding/contracting) | Setup confirmation | Entry bar volume confirmation |

---

## Confidence Weight Rationale

confidence_weight: 0.75 — Multi-Timeframe Analysis is the most universal professional framework. It does not predict direction itself but dramatically improves the accuracy of any directional strategy by adding a structural filter. The framework is systematic, objective, and well-validated across decades of professional use.

Factors that increase confidence:
- All three timeframes align in the same direction (3/3 agreement)
- Higher TF trend is well-established (not early-stage or late-stage)
- Middle TF setup has clear pattern structure with defined invalidation
- Lower TF entry trigger fires with volume confirmation

Factors that decrease confidence:
- Higher TF is range-bound (no clear directional bias)
- Middle and Lower TFs conflict with each other
- Higher TF shows late-stage trend exhaustion (extended RSI, climactic volume)
- Only one timeframe available for analysis (single-timeframe data)

---

## Limitations and Caveats

- **Analysis paralysis**: Waiting for perfect 3/3 alignment across all timeframes can mean missing many valid trades. Perfect alignment is rare — 2/3 is often sufficient
- **Timeframe conflicts are common**: It is normal for timeframes to disagree. This is information, not a problem. When they conflict, the Higher TF takes precedence
- **Data requirements**: Multi-timeframe analysis requires sufficient historical data across all timeframes. Limited data on higher timeframes (e.g., only 30 weekly bars) may produce unreliable trend readings
- **Speed of analysis**: In fast-moving markets, completing a full three-tier analysis before the Lower TF trigger passes can be challenging. Preparation (pre-identifying Higher and Middle TF levels) helps
- **Not a prediction tool**: MTA aligns your trades with the dominant trend — it does not predict reversals or new trends. All three timeframes can agree and the trade can still lose if an unexpected catalyst appears

---

## AI Analysis Instructions

Analyze the available price data across the timeframes provided. Determine the trend on the highest available timeframe, identify setups on the middle timeframe, and note any entry triggers on the lowest timeframe.

If only one timeframe of data is available, analyze that timeframe's trend, support/resistance, and momentum, then recommend what to look for on higher and lower timeframes for confirmation.

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**상위 시간대 추세**: [추세 방향, 예: "일봉 기준 상승 추세 — 가격 MA50/MA200 상방, Higher High/Higher Low 패턴"]
**중간 시간대 셋업**: [감지된 셋업, 예: "4시간봉 MA20 지지 테스트 중 — 풀백 매수 셋업 형성"]
**하위 시간대 타이밍**: [진입 트리거, 예: "1시간봉 RSI 30선 상향 돌파 + 망치형 캔들 — 진입 트리거 발생"]
**시간대 정렬도**: [정렬 점수, 예: "3/3 강한 정렬 — 전 시간대 상승 방향 일치" / "2/3 보통 — 상위·중간 상승, 하위 미확인"]
**방향성 판단**: [종합 방향, 예: "LONG ONLY — 상위 시간대 상승 추세 확인. 하위 시간대에서 매수 진입만 허용"]
**매매 신호**: [현재 실행 가능한 신호, 예: "상위 상승 + 중간 풀백 지지 + 하위 반전 확인 = 매수 진입 적합" / "시간대 충돌로 진입 보류"]
**상세 분석**: [각 시간대별 분석 요약, 정렬 상태, 주요 지지·저항, 진입·손절·목표가, 주의사항을 포함한 상세 분석 문단]
```

Additional output rules:
- If **only one timeframe** is available, state what you can conclude from it and what additional timeframes would provide
- If **Higher TF conflicts** with the Middle/Lower TF trade direction, explicitly warn against counter-trend entry
- If **all three timeframes align**, flag as a high-confidence setup
- If the Higher TF shows **late-stage exhaustion** (extreme RSI, multiple divergences), warn even if direction aligns
- Set the `trend` field: `bullish` if Higher TF uptrend confirmed and at least 2/3 tiers agree, `bearish` if Higher TF downtrend confirmed and at least 2/3 tiers agree, `neutral` if Higher TF range-bound or timeframes conflict
