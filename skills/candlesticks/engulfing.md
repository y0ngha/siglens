---
name: Engulfing Pattern Guide
description: 장악형 캔들 패턴(Bullish/Bearish Engulfing) 해석 가이드
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.8
---

## Overview

Engulfing은 2봉 반전 패턴으로, 캔들스틱 패턴 중 가장 높은 신뢰도 그룹(57%)에 속한다.
두 번째 캔들의 몸통이 첫 번째 캔들의 몸통을 완전히 감싸는 구조이다.

### Bullish Engulfing (상승 장악형)
- 하락 추세 중 작은 음봉 뒤에 큰 양봉이 등장
- 전일 몸통을 완전히 감싸는 양봉

### Bearish Engulfing (하락 장악형)
- 상승 추세 중 작은 양봉 뒤에 큰 음봉이 등장
- 전일 몸통을 완전히 감싸는 음봉

## Signal Interpretation

### Bullish Engulfing
- **Strong signal**: 명확한 하락 추세 후 출현 + 두 번째 캔들의 거래량 증가 + RSI 과매도 구간(30 이하)
- **Moderate signal**: 하락 추세 후 출현했으나 거래량 변화 미미
- **Weak signal**: 추세가 불명확하거나 횡보 구간에서 출현

### Bearish Engulfing
- **Strong signal**: 명확한 상승 추세 후 출현 + 두 번째 캔들의 거래량 증가 + RSI 과매수 구간(70 이상)
- **Moderate signal**: 상승 추세 후 출현했으나 거래량 변화 미미
- **Weak signal**: 추세가 불명확하거나 횡보 구간에서 출현

## Key Combinations

- **RSI + Engulfing**: RSI 극단값(과매수/과매도)과 동시에 출현 시 반전 신뢰도 크게 상승
- **Bollinger Band + Engulfing**: 밴드 상단/하단 터치와 동시 출현 시 반전 확률 증가
- **Volume + Engulfing**: 두 번째 캔들의 거래량이 평균 대비 150% 이상이면 신뢰도 상승
- **EMA/MA + Engulfing**: 주요 이동평균선(20, 60) 부근에서 출현 시 지지/저항 반전 신호

## Caveats

- 꼬리(shadow)가 아닌 **몸통(body)** 기준으로 판단해야 한다
- 횡보 구간에서는 신뢰도가 급감하므로 반드시 추세 맥락에서 해석해야 한다
- 갭이 없는 시장(암호화폐, FX 등)에서는 Engulfing 구조가 더 자주 형성되므로 추가 확인이 필요하다
- ADX가 20 미만인 레인지 환경에서 출현 시 반전 신호로 사용하지 말 것

## AI Analysis Instructions

When a Bullish Engulfing or Bearish Engulfing pattern is detected in the candle data:

- Evaluate the preceding trend direction using EMA(20) slope and ADX value
- Check if the second candle's volume is above average (stronger confirmation)
- Cross-reference with RSI and Bollinger Band position for confluence
- If the pattern appears in a range-bound market (ADX < 20), explicitly note reduced reliability in the summary
- State the trend context clearly: "하락 추세 바닥에서 Bullish Engulfing 출현" or "횡보 구간에서 출현하여 신뢰도 낮음"
