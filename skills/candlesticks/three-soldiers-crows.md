---
name: Three Soldiers/Crows Guide
description: 적삼병/흑삼병 3봉 반전 패턴 해석 가이드
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.8
---

## Overview

Three White Soldiers(적삼병)와 Three Black Crows(흑삼병)는 3봉 반전 패턴으로, 강한 반전 신호를 제공한다.
연속 3개의 긴 캔들이 동일 방향으로 진행하며, 각 캔들이 새로운 고점/저점을 형성한다.

### Three White Soldiers (적삼병)
- 3연속 긴 양봉
- 각 봉이 전일 몸통 내에서 시작하여 더 높은 종가로 마감
- 하락 추세에서 상승 반전 신호

### Three Black Crows (흑삼병)
- 3연속 긴 음봉
- 각 봉이 전일 몸통 내에서 시작하여 더 낮은 종가로 마감
- 상승 추세에서 하락 반전 신호

## Signal Interpretation

### Three White Soldiers
- **Strong signal**: 명확한 하락 추세 후 출현 + 각 캔들 몸통이 크고 꼬리가 짧음(마루보즈에 가까움) + 거래량 점진적 증가
- **Moderate signal**: 하락 추세 후 출현, 캔들 몸통 비교적 크나 꼬리가 존재
- **Weak signal**: 이미 상당히 상승한 후 출현(과열 가능성)

### Three Black Crows
- **Strong signal**: 명확한 상승 추세 후 출현 + 각 캔들 몸통이 크고 꼬리가 짧음 + 거래량 점진적 증가
- **Moderate signal**: 상승 추세 후 출현, 캔들 몸통 비교적 크나 꼬리가 존재
- **Weak signal**: 이미 상당히 하락한 후 출현(과매도 가능성)

## Key Combinations

- **RSI + Soldiers/Crows**: RSI가 중립 구간에서 극단으로 이동 중일 때 패턴이 확인 역할
- **MACD + Soldiers/Crows**: MACD 방향 전환과 동시 출현 시 강력한 추세 전환 신호
- **Volume + Soldiers/Crows**: 3봉 각각의 거래량이 점진적으로 증가하면 추세 강도 확인
- **EMA(20) + Soldiers/Crows**: EMA(20) 돌파/이탈과 동시 출현 시 추세 전환 확인

## Caveats

- 세 번째 캔들이 과도하게 길면 오히려 과열/과매도 신호 — 추격 매수/매도 주의
- 이미 많이 오른/내린 후 출현 시 추세 피로 가능성이 있으므로 주의
- 각 캔들의 시가가 반드시 전일 몸통 범위 내에서 시작해야 함 (갭 업/다운으로 시작하면 패턴 불성립)
- 상위 저항선/지지선에 근접한 상태에서 출현 시 돌파 실패 가능성 고려

## AI Analysis Instructions

When Three White Soldiers or Three Black Crows is detected:

- Evaluate each candle's body size and shadow ratio — smaller shadows indicate stronger conviction
- Check if the pattern emerges after a clear opposing trend using EMA(20) and EMA(60)
- Assess volume progression across the three candles: increasing volume confirms the signal
- If the third candle is exceptionally long relative to the first two, warn about potential overextension: "세 번째 캔들이 과도하게 길어 과열 가능성 주의"
- Cross-reference with nearby resistance/support levels to evaluate continuation potential
- State the pattern strength based on body-to-shadow ratios of all three candles
