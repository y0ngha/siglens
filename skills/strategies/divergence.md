---
name: 다이버전스 전략
description: 가격과 오실레이터(RSI, MACD, Stochastic)의 방향 불일치를 통해 추세 반전 또는 추세 지속을 예측하는 전략
type: strategy
category: neutral
indicators: ['rsi', 'macd', 'stochastic']
confidence_weight: 0.78
---

## Overview

Divergence Trading identifies discrepancies between price action and oscillator readings to anticipate trend reversals or confirm trend continuations. When price makes a new high or low but the corresponding oscillator fails to confirm, the underlying momentum has shifted — signaling a potential change in direction.

This strategy leverages oscillators already available in the system (RSI, MACD, Stochastic) without requiring additional indicators, maximizing the value of existing data.

---

## Divergence Types

### Regular Divergence (Trend Reversal Signals)

Regular divergences signal that the current trend is losing momentum and a reversal is likely.

| Type | Price Action | Oscillator Action | Signal | Reliability |
|---|---|---|---|---|
| Regular Bullish | Lower Low | Higher Low | Downtrend weakening → potential reversal to upside | High when at support |
| Regular Bearish | Higher High | Lower High | Uptrend weakening → potential reversal to downside | High when at resistance |

### Hidden Divergence (Trend Continuation Signals)

Hidden divergences confirm that the current trend remains intact despite a temporary pullback.

| Type | Price Action | Oscillator Action | Signal | Reliability |
|---|---|---|---|---|
| Hidden Bullish | Higher Low | Lower Low | Pullback within uptrend → continuation upward | High in strong uptrends |
| Hidden Bearish | Lower High | Higher High | Bounce within downtrend → continuation downward | High in strong downtrends |

### Key Distinction

- **Regular divergence** = momentum is failing to confirm the new extreme → potential reversal
- **Hidden divergence** = price is holding the trend while the oscillator overshoots → trend continuation

---

## Oscillator-Specific Guidelines

### RSI Divergence

- Most effective when RSI is in extreme zones (below 30 or above 70)
- Regular Bullish: price makes lower low while RSI makes higher low, especially if RSI was below 30 and is recovering
- Regular Bearish: price makes higher high while RSI makes lower high, especially if RSI was above 70 and is declining
- Hidden divergences are valid when RSI is in the neutral zone (40-60) during a strong trend

### MACD Divergence

- Use the MACD histogram for divergence detection (more sensitive than the MACD line)
- Regular Bullish: price makes lower low while MACD histogram makes shallower negative bar
- Regular Bearish: price makes higher high while MACD histogram makes shorter positive bar
- MACD signal line crossover after divergence adds confirmation
- MACD divergences tend to precede larger moves than RSI divergences

### Stochastic Divergence

- Best used in ranging or moderately trending markets
- Most effective when %K is in extreme zones (below 20 or above 80)
- %K/%D crossover after divergence provides entry timing
- Less reliable in strong trending markets where Stochastic can remain overbought/oversold for extended periods

### Multi-Oscillator Confirmation

When two or more oscillators show the same divergence simultaneously, signal reliability increases significantly:

| Combination | Estimated Win Rate | Notes |
|---|---|---|
| RSI + MACD | ~73% | Highest reliability — momentum + trend confirmation |
| RSI + Stochastic | ~65% | Good for ranging markets |
| MACD + Stochastic | ~62% | Momentum focus |
| All three | ~78% | Rare but most reliable |

---

## Entry Rules

### Regular Bullish Divergence Entry

1. **Identify divergence**: Price makes lower low while oscillator makes higher low
2. **Wait for confirmation**: Oscillator exits oversold zone (RSI crosses above 30, Stochastic %K crosses above 20, or MACD histogram turns positive)
3. **Double confirmation (optional)**: Price bounces from a known support level
4. **Entry trigger**: Enter long when the confirmation candle closes
5. **Stop loss**: Below the most recent swing low (the lower low in the divergence)
6. **Target**: Previous swing high or resistance level; alternatively, 1:2 risk-reward ratio

### Regular Bearish Divergence Entry

1. **Identify divergence**: Price makes higher high while oscillator makes lower high
2. **Wait for confirmation**: Oscillator exits overbought zone (RSI crosses below 70, Stochastic %K crosses below 80, or MACD histogram turns negative)
3. **Double confirmation (optional)**: Price rejects from a known resistance level
4. **Entry trigger**: Enter short when the confirmation candle closes
5. **Stop loss**: Above the most recent swing high (the higher high in the divergence)
6. **Target**: Previous swing low or support level; alternatively, 1:2 risk-reward ratio

### Hidden Bullish Divergence Entry

1. **Prerequisite**: Confirmed uptrend (higher highs, higher lows, price above key moving averages)
2. **Identify divergence**: Price makes higher low while oscillator makes lower low
3. **Entry trigger**: Enter long when oscillator begins recovering from the lower low
4. **Stop loss**: Below the higher low in the divergence
5. **Target**: Retest of the most recent high or next resistance

### Hidden Bearish Divergence Entry

1. **Prerequisite**: Confirmed downtrend (lower highs, lower lows, price below key moving averages)
2. **Identify divergence**: Price makes lower high while oscillator makes higher high
3. **Entry trigger**: Enter short when oscillator begins declining from the higher high
4. **Stop loss**: Above the lower high in the divergence
5. **Target**: Retest of the most recent low or next support

---

## Exit Rules

- **Primary exit**: Target price reached (support/resistance level or risk-reward ratio target)
- **Trailing stop**: Move stop to breakeven after 1:1 risk-reward is reached, then trail behind swing points
- **Invalidation exit**: Close position if a new divergence forms in the opposite direction
- **Time-based exit**: If price fails to move in the expected direction within 10-15 bars after entry, consider closing for a small loss or breakeven

---

## Confidence Weight Rationale

confidence_weight: 0.78 — Divergence is a well-documented, statistically validated phenomenon across markets. Multi-oscillator confirmation substantially improves reliability: the RSI+MACD combination reaches roughly 73% win rate, and full three-oscillator agreement approaches 78%. This places divergence among the more reliable single-strategy signals in the skill set. The 0.78 weight reflects this strong statistical backing while acknowledging that divergences can persist for extended periods before resolving (especially in strong trends), so entry timing still requires additional confirmation such as an oscillator exit from the extreme zone, a candlestick pattern, or a support/resistance test.

Factors that increase confidence:
- Multiple oscillators show the same divergence simultaneously
- Divergence occurs at a known support/resistance level
- Volume confirms the divergence (decreasing volume on the price extreme)
- Divergence appears on a higher timeframe (daily or weekly)

Factors that decrease confidence:
- Only one oscillator shows divergence
- Strong trending market (regular divergences can persist through multiple swings)
- No clear support/resistance confluence
- Divergence on very low timeframes (1-minute, 5-minute) — higher noise ratio

---

## Limitations and Caveats

- **Never trade divergence alone**: Divergence is a warning signal, not an entry signal by itself. Always require confirmation (oscillator exit from extreme zone, candlestick pattern, or support/resistance test)
- **Strong trend danger**: In a powerful trend, regular divergence can appear at multiple consecutive swings before the trend actually reverses. This leads to premature entries and repeated stop-outs. Check the higher timeframe trend direction first
- **Hidden divergence misconception**: Hidden divergence confirms trend continuation — it is NOT a reversal signal. Do not confuse hidden bullish (continuation) with regular bullish (reversal)
- **Timeframe consistency**: The divergence and the entry confirmation should be observed on the same timeframe. Do not mix timeframes (e.g., divergence on daily, entry on 5-minute)
- **Oscillator recalculation**: Oscillator values change with each new bar. A divergence visible on incomplete bars may disappear when the bar closes. Always confirm on closed bars

---

## AI Analysis Instructions

Scan the most recent price data and available oscillator values (RSI, MACD histogram, Stochastic %K) for divergence patterns. Check both the most recent swing and the prior swing for comparison.

For each divergence detected:
1. Identify the type (Regular Bullish, Regular Bearish, Hidden Bullish, Hidden Bearish)
2. Specify which oscillator(s) show the divergence
3. Assess whether confirmation conditions have been met

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**감지된 다이버전스**: [Regular Bullish / Regular Bearish / Hidden Bullish / Hidden Bearish / 감지 없음]
**관련 오실레이터**: [다이버전스를 보이는 오실레이터 목록, 예: "RSI + MACD 동시 다이버전스"]
**가격 패턴**: [다이버전스 구성 설명, 예: "가격 Lower Low($142→$138) + RSI Higher Low(28→32)"]
**확인 상태**: [확인 완료 / 확인 대기 중 / 미확인, 예: "RSI 30선 상향 돌파 확인 — 진입 조건 충족"]
**매매 신호**: [구체적 진입 신호, 예: "Regular Bullish 확인 — RSI+MACD 동시 다이버전스로 높은 신뢰도 매수 신호" / "명확한 다이버전스 신호 없음"]
**상세 분석**: [다이버전스 맥락, 지지/저항 수렴 여부, 멀티 오실레이터 일치 여부, 주의사항을 포함한 상세 분석 문단]
```

Additional output rules:
- If **multiple oscillators** show the same divergence, explicitly note this as higher confidence
- If divergence is detected but **confirmation is pending**, state the specific condition needed (e.g., "RSI가 30선을 상향 돌파하면 확인 완료")
- If **hidden divergence** is detected, emphasize that it is a continuation signal, not a reversal
- If no divergence is found, state "현재 가격-오실레이터 간 다이버전스 미감지" and briefly describe the current momentum alignment
- Set the `trend` field: `bullish` if regular bullish or hidden bullish divergence confirmed, `bearish` if regular bearish or hidden bearish divergence confirmed, `neutral` if no divergence or unconfirmed
