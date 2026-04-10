---
name: Hammer/Shooting Star Guide
description: 망치형/유성형 1봉 반전 패턴 해석 가이드 (Hammer, Inverted Hammer, Shooting Star, Hanging Man)
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.75
---

## Overview

Hammer 계열은 1봉 반전 패턴으로, 동일한 캔들 모양이 추세 위치에 따라 다른 패턴으로 분류된다.
단독 사용 시 신뢰도가 낮으므로 반드시 다음 캔들 확인이 필요하다.

### Hammer (망치형)
- 하락 추세 바닥에서 등장
- 작은 몸통 + 긴 아래꼬리(몸통의 2배 이상) + 위꼬리 거의 없음
- 매도세가 한때 강했으나 매수세가 회복하여 반전 가능성 시사

### Inverted Hammer (역망치형)
- 하락 추세 바닥에서 등장
- 작은 몸통 + 긴 위꼬리 + 아래꼬리 거의 없음
- 신뢰도 60%로 Hammer 계열 중 가장 높음

### Shooting Star (유성형)
- 상승 추세 꼭대기에서 등장
- 작은 몸통 + 긴 위꼬리(몸통의 2배 이상) + 아래꼬리 거의 없음
- 매수세가 한때 강했으나 매도세에 밀려 하락 반전 가능성

### Hanging Man (교수형)
- 상승 추세 꼭대기에서 등장
- Hammer와 동일 모양이나 상승 추세에서 출현하여 하락 반전 신호

## Signal Interpretation

### 상승 반전 (Hammer, Inverted Hammer)
- **Strong signal**: 명확한 하락 추세 + 긴 꼬리(몸통 3배 이상) + 다음 캔들이 양봉으로 확인 + 거래량 증가
- **Moderate signal**: 하락 추세 후 출현, 꼬리 길이 2~3배
- **Weak signal**: 추세 불명확 또는 다음 캔들 확인 전

### 하락 반전 (Shooting Star, Hanging Man)
- **Strong signal**: 명확한 상승 추세 + 긴 꼬리(몸통 3배 이상) + 다음 캔들이 음봉으로 확인 + 거래량 증가
- **Moderate signal**: 상승 추세 후 출현, 꼬리 길이 2~3배
- **Weak signal**: 추세 불명확 또는 다음 캔들 확인 전

## Key Combinations

- **RSI + Hammer/Star**: RSI 과매수/과매도 구간과 동시 출현 시 반전 강도 증가
- **Bollinger Band + Hammer/Star**: 밴드 상/하단 터치와 동시 출현 시 반전 확률 증가
- **Support/Resistance + Hammer**: 주요 지지선 위에서 Hammer 출현 시 바닥 확인 신호
- **Volume + Hammer/Star**: 패턴 캔들의 거래량이 평균 대비 높을수록 신뢰도 상승

## Caveats

- 위치(추세 맥락)가 패턴 이름을 결정한다 — 동일 모양도 상승/하락 추세에 따라 다른 패턴
- **단독 사용 금지**: 반드시 다음 캔들의 방향으로 확인해야 한다
- 횡보 구간에서 출현 시 반전 신호로 해석하지 말 것
- 단기 타임프레임에서는 꼬리 길이 비율이 불안정하여 신뢰도 감소

## AI Analysis Instructions

When a Hammer, Inverted Hammer, Shooting Star, or Hanging Man is detected:

- First determine the trend context using EMA(20) direction to confirm the pattern classification
- Evaluate the shadow-to-body ratio for signal strength (2x = minimum, 3x+ = strong)
- Check the next candle's direction for confirmation (if available in the data)
- Cross-reference with RSI and Bollinger Band position
- Emphasize that single-candle patterns require next-bar confirmation: "Hammer 출현, 다음 캔들 양봉 확인 필요"
- If the pattern appears without a clear preceding trend, explicitly reduce the signal weight
