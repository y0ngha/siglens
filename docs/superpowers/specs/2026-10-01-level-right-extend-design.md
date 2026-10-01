# 작도 레벨선 오른쪽 연장 설계 (2026-10-01)

## 배경

core 작도의 수평 레벨(피보나치 레벨, 패턴 돌파선)은 기준 봉(`fromTime`)부터 **마지막 봉**까지만 그려진다.
차트 오른쪽 여백(마지막 봉 ~ 가격축)이 비어 있어 레벨이 "그 시점까지만 유효한 값"처럼 보인다.
사용자 요청: 레벨을 가격축 앞까지 연장하는 옵션, 기본 켜짐, localStorage 영속.

매매 가격선(진입·청산·손절)은 이미 `createPriceLine`으로 차트 전체 폭에 그려지므로 대상이 아니다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 대상 | `chartOverlays[].levels`(피보나치 레벨·ABC 확장·패턴 돌파선). 사선(추세선·패턴 윤곽·다이버전스·엘리어트·피보나치 앵커)은 연장하지 않는다. |
| 기본값 | 켜짐 |
| 영속 | localStorage(`usePersistentState`), 키 `siglens.chart.levelRightExtend`(`STORAGE_KEYS.levelRightExtend`). 분석·종목·타임프레임이 바뀌어도 유지되는 사용자 환경설정. |
| 토글 위치 | "차트 작도" 메뉴(`ChartOverlayMenu`) 맨 아래, 구분선 뒤 체크박스 "레벨선 오른쪽 연장". 연장할 레벨이 하나도 없으면 숨긴다. |
| 그리는 방식 | lightweight-charts v5 series primitive. 기존 레벨 `LineSeries`(기준 봉~마지막 봉)는 그대로 두고, primitive가 **마지막 봉 x ~ pane 오른쪽 끝**만 같은 색·굵기·점선으로 덧그린다. |
| 공유 이미지 차트 | 적용하지 않는다(`ShareCandlestickChart`는 작도를 그리지 않음). |

기각안: `createPriceLine`(왼쪽 끝부터 전체 폭이라 레벨 7개 이상이 과거 구간을 가로지름), 미래 시각 whitespace 봉 추가(시간축·fitContent가 바뀜).

## 구조

- `widgets/chart/constants.ts`: `STORAGE_KEYS.levelRightExtend` 추가.
- `widgets/chart/utils/rightExtendPrimitive.ts`: `ISeriesPrimitive` 구현. 생성 인자 `{ startTime, price, color, lineWidth, dashed }` — `startTime`은 레벨 시리즈의 끝점(마지막 봉).
  `updateAllViews`에서 `timeScale().timeToCoordinate(startTime)`·`series.priceToCoordinate(price)`를 구하고,
  렌더러가 `x ~ mediaSize.width` 수평선을 그린다. 좌표가 `null`이면 그리지 않는다. 좌표 계산은 순수 함수
  `rightExtendSegment(x, y, paneWidth)`로 분리해 테스트한다(`x >= paneWidth`이면 `null`).
- `utils/chartOverlayUtils.ts`: `OverlayLineSpec`에 `extendRight: boolean`. `OverlayLineSpecOptions`에 `extendLevelsRight: boolean`.
  레벨 스펙은 `extendRight = opts.extendLevelsRight`, 선분 스펙은 항상 `false`.
- `hooks/useChartOverlays.ts`: `spec.extendRight`이면 시리즈 생성 직후 `series.attachPrimitive(new RightExtendPrimitive({ startTime: spec.points[1].time, ... }))`.
  시리즈 제거 시 primitive도 함께 떨어진다(별도 정리 불필요 — `removeSeries`가 primitive를 detach).
  색은 시리즈와 같은 `withOpacity(spec.color, spec.opacity)`(강조·흐림 상태 반영).
- `StockChart`: `usePersistentState(STORAGE_KEYS.levelRightExtend, true)`로 상태를 쥐고 `buildOverlayLineSpecs`에 전달, 메뉴에 `levelRightExtend`·`onLevelRightExtendChange`를 내린다.
  메뉴 표시 조건 `hasExtendableLevels` = 지금 그려지는 작도 중 `levels.length > 0`인 것이 있는지.
- `ui/ChartOverlayMenu.tsx`: 맨 아래 구분선 + 체크박스 행(기존 항목 행과 같은 스타일). 메뉴 트리거 개수("차트 작도 · N")에는 세지 않는다.
- i18n: ko/en/ja/zh 문구 1개("레벨선 오른쪽 연장" / "Extend levels right" / "水平線を右へ延長" / "水平线向右延伸"). `node scripts/i18n/extract.mjs --write`로 manifest 갱신.

## 테스트

- `rightExtendSegment`: 정상 좌표, `x >= paneWidth`·`null` 입력 시 `null`.
- `buildOverlayLineSpecs`: `extendLevelsRight` true/false에 따라 레벨 스펙만 `extendRight`, 선분 스펙은 항상 false.
- `useChartOverlays`: `extendRight` 스펙에만 `attachPrimitive` 호출(목 시리즈).
- `ChartOverlayMenu`: 토글 기본 체크, 클릭 시 콜백, 연장할 레벨이 없으면 미표시, 트리거 개수 불변.
