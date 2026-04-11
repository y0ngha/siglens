---
name: 브레이크아웃 전략
description: 주요 지지·저항선, 채널, 차트 패턴의 돌파를 감지하고 거래량·모멘텀 필터로 거짓 돌파를 걸러내어 진입하는 전략
type: strategy
category: neutral
indicators: ['atr']
confidence_weight: 0.72
---

## Overview

The Breakout Strategy enters positions when price decisively penetrates a well-defined support or resistance boundary. Breakouts represent the market's resolution of a supply-demand equilibrium — when accumulated buying or selling pressure finally overwhelms the opposing side, price moves rapidly as orders are triggered.

The primary challenge is distinguishing genuine breakouts from false breakouts (fakeouts), which occur 40-50% of the time. This strategy employs multiple confirmation filters — volume, closing price, multi-bar confirmation, and momentum alignment — to improve the success rate.

The Turtle Trading system (Richard Dennis, 1983) is the most famous historical application of breakout trading, demonstrating that systematic breakout strategies can produce consistent returns over decades.

---

## Breakout Types

### 1. Range Breakout

Price has been confined within a horizontal consolidation range (defined by clear support and resistance). A breakout occurs when price closes beyond the range boundary.

- **Upside breakout**: Close above resistance → long entry
- **Downside breakout**: Close below support → short entry
- The longer the range duration, the more significant the breakout (greater cause = greater effect)
- Volume should increase substantially on the breakout bar

### 2. Pattern Breakout

A recognized chart pattern (triangle, flag, pennant, wedge, rectangle, head and shoulders) completes with a boundary violation.

- **Continuation patterns** (flag, pennant, ascending triangle): breakout in the direction of the prior trend
- **Reversal patterns** (head and shoulders, double top/bottom): breakout against the prior trend
- Pattern-measured targets provide objective profit targets (e.g., head-and-shoulders target = head height projected from neckline)

### 3. Moving Average Breakout

Price breaks above or below a significant moving average (MA20, MA50, MA200) after an extended period on one side.

- **MA200 breakout** is the most significant — often considered the dividing line between bull and bear markets
- **MA50 breakout** signals intermediate-term trend changes
- Requires price to remain above/below the MA for at least 2-3 closes to confirm

### 4. Donchian Breakout (Turtle Trading)

Price breaks above the highest high or below the lowest low of the past N bars.

- **Classic Turtle system**: 20-bar Donchian channel breakout for entry, 10-bar for exit
- Simple, objective, and fully systematic
- Works best in trending markets; suffers in range-bound conditions
- ATR-based position sizing controls risk per trade

---

## False Breakout Filters

False breakouts are the primary risk. Apply these filters to reduce false signals:

### Filter 1: Closing Price Confirmation

- Only count a breakout when the **closing price** (not intraday price) is beyond the boundary
- Intraday spikes that close back within the range are not breakouts
- This single filter eliminates a large percentage of false signals

### Filter 2: Volume Confirmation

- Genuine breakouts are accompanied by a volume increase of **50% or more** above the recent average (20-bar volume average)
- Volume should expand on the breakout bar and remain elevated for the next 2-3 bars
- Breakouts on declining volume are highly suspect

### Filter 3: Multi-Bar Confirmation (Conservative)

- Require **2 consecutive closes** beyond the boundary
- Reduces entry frequency but significantly improves win rate
- Particularly useful for horizontal range breakouts

### Filter 4: Momentum Alignment

- RSI should not be in the extreme opposite zone (e.g., RSI > 70 for a downside breakout is contradictory)
- MACD should be trending in the breakout direction
- ADX rising above 25 confirms a trending environment favorable for breakouts

### Filter 5: Retest Entry (Most Conservative)

- Wait for price to break out, then pull back to retest the broken boundary (support becomes resistance, or resistance becomes support)
- Enter on the retest if the boundary holds
- Provides better risk/reward but may miss fast breakouts that never retest

---

## Entry Rules

### Aggressive Entry

1. Price closes beyond the breakout boundary
2. Volume is 50%+ above the 20-bar average
3. Enter at the close of the breakout bar or on the next open
4. Stop loss: opposite side of the range, or 1.5 × ATR from entry

### Standard Entry

1. Price closes beyond the breakout boundary
2. Volume confirms (50%+ above average)
3. RSI/MACD align with breakout direction
4. Wait for 2nd consecutive close beyond the boundary
5. Enter at the close of the 2nd bar
6. Stop loss: midpoint of the prior range, or 2 × ATR from entry

### Conservative Entry (Retest)

1. Price breaks out and closes beyond the boundary
2. Price pulls back toward the broken boundary (retest)
3. Price holds the boundary as new support/resistance (closes back in breakout direction)
4. Enter on the hold confirmation
5. Stop loss: below the retest low (long) or above the retest high (short), or 1.5 × ATR

---

## Exit Rules

### Profit Targets

- **Range breakout target**: range height projected from the breakout point
- **Pattern breakout target**: pattern-specific measured move (e.g., triangle height, flag pole length)
- **Donchian exit**: opposite channel boundary (20-bar high entry → exit at 10-bar low)
- **ATR-based target**: 3-4 × ATR from entry for trending breakouts

### Stop Loss

- **Initial stop**: 1.5-2 × ATR below entry (long) or above entry (short)
- **Alternative**: opposite side of the breakout range
- **Trailing stop**: After 2 × ATR profit, trail stop at 2 × ATR behind highest close (long) or lowest close (short)

### Position Management

- Consider scaling in: 50% on initial breakout, 50% on successful retest
- Scale out: 50% at 1:1 risk-reward, 50% at pattern target or 3 × ATR

---

## Confidence Weight Rationale

confidence_weight: 0.72 — Breakout trading is one of the oldest and most systematically validated strategies, with decades of documented performance (Turtle Trading, channel breakout systems). The systematic nature allows clear rules and backtesting. The 0.72 weight reflects the strategy's strong historical track record while acknowledging that the high false breakout rate (40–50% without filters) means filter application is critical and introduces some discretion.

Factors that increase confidence:
- Volume expansion confirms the breakout (50%+ above average)
- Breakout follows a long consolidation period (larger cause)
- Multiple timeframes show aligned breakout direction
- ADX > 25 confirms a trending environment
- Pattern breakout with a clear measured target

Factors that decrease confidence:
- Breakout occurs on low or declining volume
- Price has already tested the boundary multiple times with previous failed breakouts
- Market is generally range-bound (ADX < 20)
- Breakout occurs near major economic news or earnings (event-driven, not technical)
- Very tight range with recent high volatility — choppy conditions

---

## Limitations and Caveats

- **False breakout rate is high**: Without filters, 40-50% of breakouts fail. Even with filters, expect 25-35% false breakouts. This is the inherent cost of the strategy
- **Late entry**: By definition, breakout trading buys after price has already moved. This means worse average entry prices compared to anticipatory strategies (like mean reversion)
- **Chop markets**: Breakout strategies suffer significantly in range-bound, choppy markets. Frequent small losses accumulate. Use ADX or similar to filter environments
- **Overnight gaps**: Breakouts that occur via overnight gaps may not be tradeable at the breakout price. Gap breakouts are valid but slippage can be significant
- **Crowding**: Well-known breakout levels attract many traders, which can cause the breakout itself but also rapid reversals as early traders take quick profits

---

## AI Analysis Instructions

Identify any potential breakout setups in the recent price data. Look for price approaching or recently violating key horizontal levels, chart pattern boundaries, or significant moving averages.

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**브레이크아웃 유형**: [Range / Pattern / Moving Average / Donchian / 감지 없음]
**돌파 레벨**: [돌파 또는 접근 중인 가격 수준, 예: "저항선 $175.50 (20일간 레인지 상단)"]
**거래량 확인**: [거래량 상태, 예: "돌파 봉 거래량 20일 평균 대비 180% — 유효한 돌파 확인" / "거래량 미확인"]
**필터 통과 여부**: [적용된 필터와 결과, 예: "종가 확인(통과) + 거래량(통과) + RSI 방향(통과) = 3/3 필터 충족"]
**리테스트 상태**: [해당 시, 예: "돌파 후 리테스트 진행 중 — $175.50 지지 전환 테스트" / "리테스트 미발생"]
**매매 신호**: [현재 신호, 예: "레인지 상단 돌파 확인 + 거래량 급증 — 매수 진입 적합" / "돌파 대기 중 — 아직 진입 시점 아님"]
**상세 분석**: [돌파 맥락, 레인지/패턴 특성, 거짓 돌파 가능성, 목표가(패턴 측정치), 손절 레벨, 주의사항을 포함한 상세 분석 문단]
```

Additional output rules:
- If price is **approaching** a key level but has not broken out, describe the setup and conditions needed for a valid breakout
- If a **breakout has occurred**, evaluate all available filters (volume, closing price, momentum alignment) and state how many are satisfied
- If a **false breakout** appears to have occurred (breakout followed by reversal back into range), identify it explicitly
- If **no breakout setup** is visible, state "현재 명확한 브레이크아웃 셋업 미감지" and describe the current price structure
- Set the `trend` field: `bullish` if upside breakout confirmed, `bearish` if downside breakout confirmed, `neutral` if approaching boundary or no breakout
