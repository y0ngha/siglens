# 차트 작도 항목별 토글 설계 (2026-09-29)

## 배경

차트 작도(로직 좌표 오버레이, core 2.x)는 두 곳에서 따로 제어됐다.

- 차트 헤더의 "차트 작도" 메뉴: **종류(kind) 단위** on/off, localStorage 영속, 기본값은 패턴·추세선만 켜짐.
- AI 분석 패널 카드의 "차트에서 보기": on/off가 아니라 **강조**. 누른 항목의 종류 전체를 임시로 켜고, 그 항목만 굵게·나머지는 흐리게 그렸다.
- 매매 가격선(진입·청산·손절)은 패널 섹션 토글로만 켜고 껐다(메뉴에 없음).

사용자 피드백: 메뉴에서 전부 끈 뒤 패널에서 상승 쐐기 하나만 눌러도 같은 종류의 원형 바닥이 흐리게 켜진다. 메뉴와 패널 상태가 연동되지 않는다. 메뉴가 "차트 패턴 (2)"처럼 뭉뚱그려져 어떤 작도인지 모른다. 매매 가격선은 메뉴에서 못 끈다. 버튼이 신뢰도 배지에 붙어 있다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 패널 버튼 동작 | **켜기/끄기 스위치.** 메뉴와 같은 상태를 공유한다. 강조는 카드 hover·버튼 focus 동안만(켜진 작도에 한해 굵게, 나머지 흐리게). 모바일에서는 강조 없음. |
| 영속 | **저장하지 않는다.** 새 분석(`analyzedAt` 변경)·종목·타임프레임 변경 시 전부 켜진 기본 상태로 돌아간다. 기존 localStorage 키(`chartOverlays`)는 제거. |
| 메뉴 그룹 헤더 | **그룹 전체 스위치.** 일부만 켜져 있으면 "일부 켜짐"(`aria-pressed="mixed"`) 표시, 누르면 전부 켜짐. 전부 켜져 있으면 전부 끔. |
| 기본값 | 모든 작도·매매 가격선 켜짐. |

## 항목(Item) 모델

차트에 실제로 그려지는 작도(`isOverlayDrawn`)만 항목이 된다.

| 종류 | 항목 단위 | key | 메뉴 라벨 |
|---|---|---|---|
| 매매 가격선 | 가격이 있을 때 1개 | `action-prices`(상수) | "진입·청산·손절" |
| 차트 패턴 | 패턴 카드(`patternSummaries[].id`)마다 | `sourceRef` | 스킬명(패널과 동일) |
| 추세선 | 선(overlay)마다 | `overlay.id` | 기울기로 "상승 추세선 #n"/"하락 추세선 #n", 방향별 번호 |
| 다이버전스·피보나치·엘리어트 | 전략 카드(`strategyResults[].id`)마다 | `sourceRef` | 전략명. 엘리어트 주/대안 파동은 같은 sourceRef라 한 항목 |

`overlayItemKey(overlay) = overlay.kind === 'trendline' ? overlay.id : overlay.sourceRef` — 그리기·메뉴·패널이 같은 key를 쓴다.

메뉴 순서: 매매 가격선 → 차트 패턴 → 추세선 → 다이버전스 → 피보나치 → 엘리어트. 항목이 없는 그룹은 숨긴다. 매매 가격선은 항목이 하나라 헤더 없이 한 줄 스위치로 둔다.

## 구조

- `widgets/chart/utils/overlayItems.ts` (순수): `overlayItemKey`, `buildOverlayMenuItems(overlays, { barTimes, lastBarTime, labelFor, hasActionPrices })`.
- `views/symbol/hooks/useOverlayItemVisibility.ts`: `hiddenKeys: ReadonlySet<string>`, `highlightedKey: string | null`, `setVisible(keys, visible)`, `setHighlighted(key | null)`, `clearHighlighted(key)`(멱등). `analyzedAt` 변경 시 렌더 중 조정으로 초기화.
- `ChartContent`: 항목 목록·상태를 만들어 `StockChart`(메뉴·그리기)와 `AnalysisPanel`(데스크톱·모바일 두 인스턴스)에 내린다. `highlightedOverlayRef`·`useActionPricesVisibility`를 대체한다.
- `StockChart`: `useChartOverlayVisibility`·`countOverlaysByKind` 제거. `buildOverlayLineSpecs`는 kind 가시성 대신 `hiddenKeys`·`highlightedKey`를 받는다. 강조는 켜진 항목에만 적용.
- `ChartOverlayMenu`: 그룹 헤더(삼상태) + 항목 토글. 트리거 "차트 작도 · N" = 켜진 항목 수.
- `AnalysisPanel`: `OverlayHighlightButton` → 켜기/끄기 토글(`aria-pressed` = 켜짐). 카드 `onMouseEnter/Leave`·버튼 `onFocus/Blur`로 강조, 언마운트 시 멱등 해제. 버튼 오른쪽 여백(`mr-2`).

## 테스트

- `overlayItems`: key 규칙, 추세선 방향별 번호, 엘리어트 주/대안 한 항목, 그려지지 않는 작도 제외, 매매 가격선 유무.
- `useOverlayItemVisibility`: 토글, 그룹 set, `analyzedAt` 변경 초기화, 멱등 해제.
- `ChartOverlayMenu`: 그룹 헤더 삼상태·그룹 토글, 항목 토글, 트리거 개수.
- `buildOverlayLineSpecs`: 꺼진 항목 제외, 강조 시 켜진 항목만 굵게·나머지 흐리게, 꺼진 항목은 강조로 켜지지 않음.
- `AnalysisPanel`: 버튼 `aria-pressed`·토글 콜백, hover·focus 강조 콜백, 여백 클래스.
