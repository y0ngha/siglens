---
name: Doji Pattern Guide
description: Doji 계열 캔들 패턴(Standard, Long-legged, Dragonfly, Gravestone) 해석 가이드
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.75
---

## Overview

Doji는 시가와 종가가 거의 같은 캔들로, 시장의 우유부단 또는 추세 전환 가능성을 나타낸다.
추세의 끝자락에서만 반전 신호로 유효하며, 횡보 구간의 Doji는 의미가 없다.

### Standard Doji (십자형)
- 시가 ≈ 종가, 위아래 꼬리 비슷한 길이
- 매수세와 매도세의 균형 상태

### Long-legged Doji (장다리 십자형)
- 매우 긴 위아래 꼬리
- 극심한 변동성 속 우유부단 — 추세 전환 가능성 높음

### Dragonfly Doji (잠자리형)
- 긴 아래꼬리만 존재, 위꼬리 없음
- 하락 추세 바닥에서 강세 반전 신호

### Gravestone Doji (비석형)
- 긴 위꼬리만 존재, 아래꼬리 없음
- 상승 추세 꼭대기에서 약세 반전 신호
- 신뢰도 57%

## Signal Interpretation

### Dragonfly Doji (상승 반전)
- **Strong signal**: 명확한 하락 추세 바닥 + 긴 아래꼬리 + 다음 캔들 양봉 확인 + RSI 과매도
- **Moderate signal**: 하락 추세 후 출현, 다음 캔들 확인 전
- **Weak signal**: 추세 불명확 또는 횡보 구간

### Gravestone Doji (하락 반전)
- **Strong signal**: 명확한 상승 추세 꼭대기 + 긴 위꼬리 + 다음 캔들 음봉 확인 + RSI 과매수
- **Moderate signal**: 상승 추세 후 출현, 다음 캔들 확인 전
- **Weak signal**: 추세 불명확 또는 횡보 구간

### Standard / Long-legged Doji (중립)
- **추세 전환 가능**: 장기 추세 끝에서 출현 시 전환 경고
- **의미 없음**: 횡보 구간에서 출현 시 무시

## Key Combinations

- **Doji + Engulfing**: Doji 다음 캔들이 Engulfing이면 매우 강력한 반전 신호
- **Doji + Bollinger Band**: 밴드 극단에서 Doji 출현 시 반전 확률 증가
- **RSI + Doji**: 과매수/과매도 구간에서 Doji는 피로감의 신호
- **Morning/Evening Doji Star**: 3봉 패턴의 중간 캔들이 Doji이면 Star 패턴의 신뢰도 상승

## Caveats

- 횡보 구간의 Doji는 반전 신호가 아닌 단순 변동성 감소
- 몸통이 전체 범위(고가-저가)의 5% 이내일 때 Doji로 분류
- 다음 캔들 확인이 필수적 — Doji 단독으로 매매 판단 불가
- ADX가 20 미만인 레인지 환경에서 출현 시 반전 신호로 사용하지 말 것

## AI Analysis Instructions

When a Doji, Long-legged Doji, Dragonfly Doji, or Gravestone Doji is detected:

- Identify the specific Doji variant and its directional implications
- Evaluate the preceding trend using EMA(20) and ADX to determine if the Doji has reversal significance
- If the market is range-bound (ADX < 20), explicitly note: "횡보 구간에서 Doji 출현 — 반전 신호로 해석하기 어려움"
- Check for follow-up candle confirmation when available
- Cross-reference with RSI extremes and Bollinger Band position
- For Long-legged Doji, emphasize the high volatility context and potential for sharp directional moves
