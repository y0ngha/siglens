---
name: 어닝 반응 분석 (Earnings Reaction)
description: 어닝 발표 직전·직후의 가격 변동 패턴과 Whisper Number·Beat/Miss 조합을 분석하는 프레임.
category: news
confidence_weight: 0.80
indicators: []
gating:
  tier: always_on
token_cost: 271
digest_hash: "399c6927"
---

# 어닝 반응 분석 프레임

이 프레임은 실적 발표가 있는 기업에만 적용한다 — 암호화폐 등 실적 없는 자산에는 적용하지 않는다.

## Whisper Number vs. 컨센서스

**Whisper Number**란 공식 컨센서스(애널리스트 평균 예상치)보다 높거나 낮게 형성되는 시장의 암묵적 기대치다.

- 발표 전 주가가 이미 큰 폭으로 상승했다면 Whisper Number가 컨센서스보다 높게 형성된 것
- "컨센서스 Beat"임에도 주가 하락 → Whisper Number 미달이 원인인 경우 많음

## Implied Move 대비 실제 반응

- 옵션 시장이 가격에 반영한 implied move(내재 변동폭) 대비 실제 발표 후 반응을 비교한다 — **입력에
  implied move 데이터가 있을 때만** 비교한다.
- 큰 Beat에도 실제 변동폭이 implied move보다 작으면, 기대가 이미 주가에 반영되어 있었던 것으로 해석한다.

## Beat/Miss + Revenue Surprise 조합 분석

| EPS 결과 | Revenue 결과 | 일반적 반응 |
|---|---|---|
| Beat | Beat | 강한 상승. "Quality Beat" — 지속 가능성 높음 |
| Beat | Miss | 비용 절감 주도 Beat. 초기 상승 후 약화 경향 |
| Miss | Beat | 투자 사이클 중 비용 증가. 성장 모멘텀 양호로 낙폭 제한 |
| Miss | Miss | 가장 강한 하락 반응. 가이던스 하향 동반 시 급락 |

**주목 포인트**: 단순 EPS보다 **매출 서프라이즈**가 주가 반응에 더 강한 상관관계를 보인다. 비용 절감은 일회성이지만 매출 성장은 지속 가능성을 나타내기 때문이다.

## 어닝 발표 전 패턴

- **IV Crush**: 발표 직후 옵션 내재 변동성이 급감(IV Crush). 스트래들 등 변동성 매수 전략은 이를 감안해야 함

## 어닝 발표 후 드리프트 (PEAD)

- Post-Earnings Announcement Drift는 대형주에서 2006년 이후 사실상 소멸했다(Martineau, "Rest in Peace
  Post-Earnings Announcement Drift", Critical Finance Review, 2022) — 소형·저커버리지 종목에서만 약하게
  남아 있다.
- 대형주에서 강한 서프라이즈 이후 1~3개월 추가 상승을 기대 근거로 쓰지 말 것.

## 가이던스가 주가 반응을 결정하는 경우

- 일반적으로 가이던스 변화 > EPS 결과 순서로 주가에 영향
- 어닝 Beat + 가이던스 하향 = 보통 하락으로 마감
- 어닝 Miss + 가이던스 상향 = 시장이 미래에 집중하여 상승 가능

## 섹터별 어닝 민감도

- **기술주**: 매출 성장률과 마진 가이던스에 민감. 소폭 Miss에도 20~30% 급락 발생 가능
- **금융주**: 순이자마진(NIM)·대손충당금 변화에 집중
- **소비재**: 동일점포매출(SSS) 성장률과 재고 수준 주목
- **에너지**: EPS보다 생산량·실현 단가·CAPEX 가이던스 중요

## AI 프롬프트 활용

이 프레임이 활성화되면 최근 어닝 발표 내역에서 EPS/Revenue 서프라이즈 방향과 가이던스 변화를 분석하고, 해당 섹터의 어닝 민감도 맥락과 함께 단기 주가 반응 방향을 서술한다. 대형주에서는 PEAD 소멸을 감안해 서프라이즈 이후 추가 상승을 과신하지 않는다.

<!-- PROMPT_DIGEST:START -->
어닝 반응 분석 프레임
이 프레임은 실적 발표가 있는 기업에만 적용한다 — 암호화폐 등 실적 없는 자산에는 적용하지 않는다.
Whisper Number(컨센서스보다 높거나 낮은 암묵적 기대치):
- 발표 전 주가 큰 폭 상승 = Whisper가 컨센서스보다 높게 형성됨. "컨센서스 Beat"인데 주가 하락 → Whisper 미달인 경우 많음
Implied Move 대비 실제 반응: 옵션 implied move(내재 변동폭) 대비 실제 반응 비교 — 입력에 implied move가 있을 때만. 큰 Beat에도 implied move보다 작게 움직이면 기대가 이미 반영된 것.
Beat/Miss × Revenue 조합:
- Beat/Beat: 강한 상승 "Quality Beat", 지속 가능성 높음
- Beat/Miss: 비용 절감 주도, 초기 상승 후 약화 경향
- Miss/Beat: 투자 사이클 중 비용 증가, 성장 모멘텀 양호로 낙폭 제한
- Miss/Miss: 가장 강한 하락, 가이던스 하향 동반 시 급락
- **매출 서프라이즈가 EPS보다 주가 반응과 상관 강함**(비용 절감은 일회성, 매출 성장은 지속성)
발표 전 패턴: IV Crush — 발표 직후 옵션 IV 급감, 변동성 매수 전략은 감안 필요
PEAD(발표 후 드리프트): 대형주는 2006년 이후 사실상 소멸(Martineau 2022, Critical Finance Review) — 소형·저커버리지 종목에서만 약하게 남음. 대형주에서 1~3개월 추가 상승을 기대 근거로 쓰지 말 것.
가이던스 우선: 일반적으로 가이던스 변화 > EPS 결과 순으로 영향. Beat+가이던스 하향 = 보통 하락 마감. Miss+가이던스 상향 = 상승 가능
섹터별 민감도:
- 기술주: 매출 성장률·마진 가이던스 민감, 소폭 Miss에도 20~30% 급락 가능
- 금융주: NIM·대손충당금
- 소비재: 동일점포매출(SSS)·재고 수준
- 에너지: EPS보다 생산량·실현 단가·CAPEX 가이던스
AI 프롬프트: EPS/Revenue 서프라이즈 방향·가이던스 변화 분석, 섹터 민감도 맥락과 단기 주가 반응 방향 서술. 대형주 PEAD 소멸 감안해 추가 상승 과신 금지.
<!-- PROMPT_DIGEST:END -->
