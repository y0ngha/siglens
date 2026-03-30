---
name: 상승쐐기
description: 고점과 저점이 모두 상승하지만 폭이 좁아지는 형태로 하락 반전 신호
type: pattern
category: continuation_bearish
pattern: ascending_wedge
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "추세선"
---

## 분석 기준

- 고점과 저점이 모두 점차 높아지는 상승 추세다
- 고점을 연결한 상단 추세선과 저점을 연결한 하단 추세선이 위쪽에서 수렴한다
- 하단 추세선의 기울기가 상단 추세선보다 가파를수록 수렴이 명확하다
- 수렴이 뚜렷할수록 신뢰도가 높다
- 하단 추세선 이탈 시 하락 반전 신호로 판단한다

## AI 분석 지시

패턴 감지 시 다음을 포함해 분석한다:

- 수렴 진행 정도와 예상 꼭짓점(정점) 위치
- 하단 지지선 이탈 여부와 이탈 시 목표 하락폭
- 패턴 진행 기간 (기간이 길수록 반전 폭도 커질 수 있음)
- 거래량 감소 추세 여부 (신뢰도 보강 요소)
- keyPrices에 추세선 주요 가격을 포함한다
