---
name: 이중바닥
description: 두 개의 저점이 거의 같은 가격 수준에서 형성되는 상승 반전 신호
type: pattern
category: reversal_bullish
pattern: double_bottom
indicators: []
confidence_weight: 0.75
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "넥라인"
---

## 분석 기준

- 비슷한 가격대에서 두 번의 저점이 형성된다 (3% 이내)
- 두 저점 사이에 뚜렷한 고점(넥라인)이 있어야 한다
- 두 저점의 가격이 동일할수록 신뢰도가 높다
- 넥라인(두 저점 사이 고점) 위로 돌파 시 상승 반전 신호로 판단한다

## AI 분석 지시

패턴 감지 시 다음을 포함해 분석한다:

- 두 저점 가격 수준과 차이 비율
- 넥라인 위치와 현재 가격 대비 돌파 여부
- 목표 상승폭 (넥라인에서 두 저점 평균까지의 거리를 넥라인 위로 투영)
- 두 번째 저점에서 거래량 증가 여부 (신뢰도 보강 요소)
- keyPrices에 넥라인 가격을 포함한다
