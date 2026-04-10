---
name: Marubozu Guide
description: 마루보즈 1봉 추세 지속 확인 패턴 해석 가이드
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.75
---

## Overview

Marubozu는 꼬리가 없거나 극히 짧은(전체 범위의 1% 이내) 긴 캔들로,
한 방향으로의 압도적인 힘을 나타낸다. 반전 신호가 아닌 **추세 강도 확인** 신호이다.

### Bullish Marubozu (양봉 마루보즈)
- 시가 = 저가, 종가 = 고가 (또는 매우 근접)
- 꼬리 없는 긴 양봉
- 강한 매수 압력, 추세 지속 확인

### Bearish Marubozu (음봉 마루보즈)
- 시가 = 고가, 종가 = 저가 (또는 매우 근접)
- 꼬리 없는 긴 음봉
- 강한 매도 압력, 추세 지속 확인

## Signal Interpretation

### Bullish Marubozu
- **Strong signal**: 거래량이 평균 대비 150% 이상 + 상승 추세 중 출현 + 주요 저항선 돌파와 동시
- **Moderate signal**: 평균 이상 거래량 + 상승 추세 중 출현
- **Weak signal**: 거래량 평균 이하 또는 횡보 구간에서 단발 출현

### Bearish Marubozu
- **Strong signal**: 거래량이 평균 대비 150% 이상 + 하락 추세 중 출현 + 주요 지지선 이탈과 동시
- **Moderate signal**: 평균 이상 거래량 + 하락 추세 중 출현
- **Weak signal**: 거래량 평균 이하 또는 횡보 구간에서 단발 출현

## Key Combinations

- **Volume + Marubozu**: 거래량이 평균 이상이면 추세 강도 확인, 이하이면 신뢰도 감소
- **Support/Resistance + Marubozu**: 주요 가격대 돌파/이탈 시 Marubozu 출현은 돌파 유효성 확인
- **EMA + Marubozu**: EMA(20/60) 돌파와 동시 Marubozu 출현 시 추세 전환 확인
- **RSI + Marubozu**: 연속 Marubozu + RSI 극단값은 과열/과매도 경고

## Caveats

- Marubozu는 반전 신호가 아닌 **추세 강도 확인** 신호로 해석해야 한다
- 연속 Marubozu 출현 시 오히려 과열/과매도 가능성 경고
- 단독 Marubozu만으로 진입 판단은 부적절 — 추세 맥락과 거래량 확인 필수
- 거래량이 평균 이하인 Marubozu는 유동성 부족에 의한 왜곡일 수 있음

## AI Analysis Instructions

When a Bullish Marubozu or Bearish Marubozu is detected:

- Clarify that Marubozu is a trend continuation confirmation, not a reversal signal
- Evaluate current volume relative to the recent average for confirmation strength
- Check if the Marubozu coincides with a key level breakout (support/resistance, EMA crossover)
- If consecutive Marubozu candles appear, warn about potential overextension: "연속 Marubozu 출현으로 과열 가능성 주의"
- Cross-reference with RSI to assess whether the trend is becoming overextended
- State the interpretation clearly: "Bullish Marubozu는 현재 상승 추세의 강도를 확인하는 신호입니다"
