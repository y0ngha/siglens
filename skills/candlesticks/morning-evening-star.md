---
name: Morning/Evening Star Guide
description: 샛별/석별 3봉 반전 패턴 해석 가이드
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.8
---

## Overview

Morning Star / Evening Star는 3봉 반전 패턴으로, 단일 캔들 패턴보다 높은 신뢰성을 가진다.
중간 캔들이 Doji인 경우 Morning/Evening Doji Star로 분류되며 신뢰도가 더 높다.

### Morning Star (샛별)
1. 긴 음봉 (하락 추세 지속)
2. 작은 몸통 캔들 (갭 다운, 우유부단)
3. 긴 양봉 (첫 봉의 50% 이상 회복)

### Evening Star (석별)
1. 긴 양봉 (상승 추세 지속)
2. 작은 몸통 캔들 (갭 업, 우유부단)
3. 긴 음봉 (첫 봉의 50% 이상 되돌림)

## Signal Interpretation

### Morning Star
- **Strong signal**: 명확한 하락 추세 + 중간 캔들이 Doji + 세 번째 캔들이 첫 번째의 60% 이상 회복 + 거래량 증가
- **Moderate signal**: 하락 추세 후 출현, 세 번째 캔들이 50~60% 회복
- **Weak signal**: 추세 불명확, 세 번째 캔들 회복 비율 50% 미만

### Evening Star
- **Strong signal**: 명확한 상승 추세 + 중간 캔들이 Doji + 세 번째 캔들이 첫 번째의 60% 이상 되돌림 + 거래량 증가
- **Moderate signal**: 상승 추세 후 출현, 세 번째 캔들이 50~60% 되돌림
- **Weak signal**: 추세 불명확, 세 번째 캔들 되돌림 비율 50% 미만

## Key Combinations

- **RSI + Star**: RSI 극단값(과매수/과매도)과 동시 출현 시 반전 신뢰도 크게 상승
- **MACD + Star**: MACD 히스토그램 방향 전환과 동시 출현 시 강력한 신호
- **Volume + Star**: 세 번째 캔들의 거래량 급증은 새로운 추세의 강도를 확인
- **Support/Resistance + Star**: 주요 지지/저항선 부근에서 출현 시 반전 확률 증가

## Caveats

- 암호화폐/FX 등 24시간 시장에서는 갭이 거의 형성되지 않아, 갭 조건을 완화하여 해석해야 한다
- 중간 캔들의 몸통이 지나치게 크면 Star 패턴이 아닌 일반 반전 패턴으로 분류해야 한다
- 단기 타임프레임(1Min, 5Min)에서는 노이즈가 많아 신뢰도가 낮다
- 3봉 모두의 거래량이 평균 이하이면 패턴 신뢰도 급감

## AI Analysis Instructions

When a Morning Star, Evening Star, Morning Doji Star, or Evening Doji Star is detected:

- Verify the preceding trend using EMA(20) and EMA(60) direction
- Evaluate the third candle's recovery/retracement ratio relative to the first candle
- Check if the middle candle is a Doji variant for enhanced reliability
- Cross-reference with volume changes across all three candles
- For 24-hour markets (crypto, FX), note that gap conditions are naturally relaxed
- State the specific variant detected: "Morning Doji Star는 일반 Morning Star보다 신뢰도가 높습니다"
