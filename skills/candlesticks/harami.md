---
name: Harami Pattern Guide
description: 잉태형 캔들 패턴(Bullish/Bearish Harami, Harami Cross) 해석 가이드
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.7
---

## Overview

Harami는 2봉 반전 패턴으로, Engulfing의 반대 구조이다.
두 번째 캔들이 첫 번째 캔들의 몸통 안에 완전히 포함되는 형태로, 추세 약화와 반전 가능성을 시사한다.
Engulfing보다 신뢰도가 낮으나, 장기 추세 후 출현 시 신뢰도가 높아진다.

### Bullish Harami (상승 잉태형)
- 긴 음봉 뒤에 작은 양봉이 전일 몸통 안에 포함
- 하락 추세의 약화 신호

### Bearish Harami (하락 잉태형)
- 긴 양봉 뒤에 작은 음봉이 전일 몸통 안에 포함
- 상승 추세의 약화 신호

### Harami Cross (잉태 십자형)
- 두 번째 캔들이 Doji — 더 강력한 반전 신호
- 우유부단과 추세 전환 가능성을 동시에 나타냄

## Signal Interpretation

### Bullish Harami
- **Strong signal**: 장기 하락 추세 후 출현 + Harami Cross(두 번째 캔들이 Doji) + 거래량 감소 패턴
- **Moderate signal**: 하락 추세 후 출현, 두 번째 캔들이 첫 번째 몸통의 25% 이내 크기
- **Weak signal**: 단기 하락 후 출현 또는 추세 불명확

### Bearish Harami
- **Strong signal**: 장기 상승 추세 후 출현 + Harami Cross + 거래량 감소 패턴
- **Moderate signal**: 상승 추세 후 출현, 두 번째 캔들이 첫 번째 몸통의 25% 이내 크기
- **Weak signal**: 단기 상승 후 출현 또는 추세 불명확

## Key Combinations

- **RSI + Harami**: 과매수/과매도 구간에서 Harami 출현 시 반전 확률 증가
- **MACD + Harami**: MACD 히스토그램이 줄어드는 중 Harami 출현 시 추세 약화 확인
- **Bollinger Band + Harami**: 밴드 극단에서 Harami 출현 시 밴드 수축과 함께 방향 전환 가능성
- **Volume + Harami**: 두 번째 캔들의 거래량 감소는 추세 약화의 추가 확인

## Caveats

- Engulfing보다 신뢰도가 낮으므로 단독 사용보다 확인 캔들과 함께 해석
- 두 번째 캔들이 첫 번째 캔들의 몸통을 벗어나면 Harami가 아님
- 추세가 짧거나 불명확한 구간에서는 신뢰도 급감
- 높은 거래량에서의 Harami는 오히려 추세 지속 신호일 수 있음

## AI Analysis Instructions

When a Bullish Harami, Bearish Harami, or Harami Cross is detected:

- Evaluate the length and strength of the preceding trend using EMA(20/60) and ADX
- Determine if the pattern is a standard Harami or a Harami Cross (Doji variant) for confidence adjustment
- Check the volume pattern: declining volume on the second candle confirms the interpretation
- Cross-reference with RSI and MACD momentum indicators
- Note the relative confidence: "Harami는 Engulfing보다 신뢰도가 낮으므로 확인 캔들이 필요합니다"
- For Harami Cross, emphasize the enhanced reliability: "Harami Cross는 일반 Harami보다 강력한 반전 신호입니다"
