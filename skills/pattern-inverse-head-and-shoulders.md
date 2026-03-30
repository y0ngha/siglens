---
name: 역헤드앤숄더
description: 세 개의 저점 중 가운데가 가장 낮은 형태로 상승 반전 신호
type: pattern
category: reversal_bullish
pattern: inverse_head_and_shoulders
indicators: []
confidence_weight: 0.8
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "넥라인"
---

## 분석 기준

- 왼쪽 어깨, 머리(최저점), 오른쪽 어깨 순으로 저점이 형성된다
- 머리(중앙 저점)는 양쪽 어깨보다 유의미하게 낮아야 한다
- 왼쪽 어깨와 오른쪽 어깨는 서로 비슷한 깊이를 가진다 (5% 이내)
- 두 어깨 사이 고점을 연결한 넥라인이 수평에 가까울수록 신뢰도가 높다
- 넥라인 위로 돌파 시 상승 반전 신호로 판단한다

## AI 분석 지시

패턴 감지 시 다음을 포함해 분석한다:

- 넥라인 위치와 현재 가격 대비 돌파 여부
- 목표 상승 폭 (머리에서 넥라인까지의 거리를 넥라인 위로 투영)
- 오른쪽 어깨 형성 후 거래량 증가 여부 (신뢰도 보강 요소)
- 패턴 완성 여부 (오른쪽 어깨 진행 중인지, 완성됐는지)
- keyPrices에 넥라인 가격을 포함한다
