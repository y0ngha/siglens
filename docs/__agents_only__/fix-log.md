# Fix Log

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `!bars` 검증이 빈 배열 `[]`을 유효한 입력으로 통과시킴
- Rule: CONVENTIONS.md — 빈 bars 배열은 의미 있는 분석 결과를 기대할 수 없으므로, `!bars` 단독 검증으로는 caller에게 명확한 에러 응답을 줄 수 없음
- Context: `route.ts`의 입력 검증에서 `!bars`만으로는 빈 배열을 거르지 못하여, `bars.length === 0` 조건을 추가하여 빈 bars도 400 응답으로 처리

## [Issue #89 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbarProps`에 `xyzVisible + onXYZToggle` 플랫 props 12개가 나열되어 새 지표 추가 시 props 2개씩 증가
- Rule: FF.md Coupling 4-A — 함께 변경되는 props는 묶어야 한다; 새 지표마다 interface와 호출 사이트 양쪽을 수정해야 하는 tight coupling
- Context: `bollingerVisible/onBollingerToggle` 등 4쌍을 `IndicatorToggleGroup { visible, onToggle }` 구조로 묶어 `bollinger`, `macd`, `rsi`, `dmi` 6개 props로 감소; `StockChart.tsx` 호출 사이트 동시 업데이트

## [PR #99 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbar.tsx`에서 `getPeriodColor(period)` 반환값을 `style` prop으로 적용하는 코드에 허용 사유 주석이 없어 DESIGN.md 인라인 스타일 금지 규칙 위반 여부가 불명확했음
- Rule: DESIGN.md — 인라인 스타일은 금지; 단 런타임에 결정되는 동적 도메인 색상 상수(CHART_COLORS)는 Tailwind 임의값으로 표현 불가능하므로 예외 허용, 주석으로 명시 필요
- Context: `getPeriodColor`는 `CHART_COLORS` 기반 상수를 반환하는 런타임 동적 색상으로, Tailwind 임의값 문법으로 대체 불가능함을 주석으로 명시하여 의도를 문서화

## [PR #112 | feat/109/AI-분석-패널-너비-드래그-조절 | 2026-03-31]
- Violation: `usePanelResize.ts`에서 `React.MouseEvent` 타입을 사용하면서 `React` import가 누락되어 TypeScript 컴파일 오류 발생
- Rule: TypeScript — 사용하는 모든 타입의 import가 명시되어야 한다
- Context: `import type React from 'react'`를 추가하고, `handleDragStart`가 `panelWidth` state에 의존하여 불필요하게 재생성되는 문제를 `panelWidthRef` + `useEffect` 패턴으로 해결하여 함수를 안정화

## [PR #112 | feat/109/AI-분석-패널-너비-드래그-조절 | review fix 4 | 2026-03-31]
- Violation: focusable `role="separator"` 드래그 핸들에 `onKeyDown` 핸들러가 없어 키보드 사용자가 패널 너비를 조절할 수 없는 접근성 미구현
- Rule: WAI-ARIA spec — focusable separator must support ArrowLeft/ArrowRight key adjustment
- Context: `usePanelResize`에 `handleKeyDown` 핸들러를 추가하여 ArrowLeft/ArrowRight로 `KEYBOARD_RESIZE_STEP(10px)` 단위 너비 조절 지원; `ChartContent.tsx` 드래그 핸들에 `onKeyDown={handleKeyDown}` 연결

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: 패턴 trend 분류 로직(BULLISH/BEARISH Sets, getSinglePatternTrend 등)이 components 레이어에 위치하여 테스트 불가 및 재사용 불가
- Rule: ARCHITECTURE.md Layer Rules — UI 비의존 순수 비즈니스 로직은 domain 레이어에 위치해야 함
- Context: `domain/analysis/candle-trend.ts`로 분리하여 100% 테스트 커버리지 대상으로 전환; components에서는 domain import로 사용

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: 3봉 패턴 감지 시 detection window 시작 부분에서 이전 데이터 부족으로 미감지 가능
- Rule: domain/CLAUDE.md Candle Pattern Detection — multi-candle 패턴은 2~3봉이 필요하므로 충분한 데이터 확보 필요
- Context: `detectCandlePatternEntries`에서 `CANDLE_PATTERN_DETECTION_BARS + MULTI_CANDLE_PATTERN_BUFFER(2)`개 데이터를 확보하여 감지, 결과는 마지막 15봉에 대해서만 반환

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: useEffect에서 plugin 초기화(createSeriesMarkers)와 데이터 동기화(setMarkers)가 혼합되어 있고, cleanup이 별도 useEffect로 분리
- Rule: CONVENTIONS.md Custom Hook Rules — instance creation/destruction([])와 data synchronization([deps])을 별도 useEffect로 분리해야 함
- Context: `useCandlePatternMarkers.ts`에서 초기화+cleanup을 `useEffect([seriesRef])`로, 데이터 동기화를 `useEffect([markers, isVisible])`로 분리

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: `PromptCandlePatternEntry.patternType`에 인라인 union literal `'single' | 'multi'` 사용
- Rule: MISTAKES.md TypeScript Rule 5 — 2개 이상 멤버의 union literal은 별도 type alias로 추출
- Context: `prompt.ts`에서 `type PatternEntryType = 'single' | 'multi'`로 추출하여 interface 필드에서 참조

## [Issue #132 | fix/132/pane-indicator-label-표시-수정 | 2026-04-01]
- Violation: `PaneLabelConfig`, `PaneSubLabel` 타입이 hooks/ 파일에서 정의되고 utils/에서 import하여 역방향 의존성 발생
- Rule: CONVENTIONS.md Component Folder Structure — hooks/는 React hook 파일, utils/는 순수 함수; utils가 hooks를 import하면 안 됨
- Context: `chart/types.ts`로 공유 타입을 추출하여 hooks/와 utils/ 모두 types.ts에서 import하도록 변경

## [PR #152 | feat/120/CCI-구현 | 2026-04-02]
- Violation: `cci.ts` line 23에서 `smaValue === null` 체크가 도달 불가능한 dead code — MISTAKES.md #9.5 위반
- Rule: MISTAKES.md #9.5 — logic with no practical effect adds noise and obscures intent
- Context: `Array.from` 내부에서 `tpSlice`는 항상 정확히 `period`개 원소를 가지므로 `sma(tpSlice, period)`가 null을 반환할 수 없음; null 체크를 제거하고 non-null 단언(`!`)으로 의도를 명시

## [Issue #121 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `bucketVolumes[i] += bar.volume * ratio` — 로컬 배열이지만 index assignment로 직접 변경
- Rule: CONVENTIONS.md — 불변성 원칙; 로컬 스코프 배열이라도 index 기반 mutation 금지
- Context: `bars.reduce` + `acc.map`으로 교체하여 각 bar의 기여분을 새로운 배열로 accumulate

## [Issue #121 | feat/121/volume-profile-indicator | review fix | 2026-04-02]
- Violation: `volume-profile.test.ts` line 188에서 "rowSize 미지정 시 VP_DEFAULT_ROW_SIZE 크기의 profile을 반환한다" 테스트가 line 65의 "profile 길이는 기본 rowSize(VP_DEFAULT_ROW_SIZE)와 같다"와 동일한 assertion을 중복으로 검증
- Rule: Test Layer Rules — 각 `it` 블록은 정확히 하나의 동작을 테스트하며, 중복 테스트는 noise 없는 커버리지를 저해함
- Context: `기본 파라미터 테스트` describe 블록 전체를 제거하여 중복 제거

## [Issue #122 | feat/122/ichimoku-cloud-구현 | review fix | 2026-04-02]
- Violation: `ichimoku.ts` line 66에서 `senkouBSourceIndex = i - displacement`가 line 48의 `senkouASourceIndex`와 동일한 표현식을 중복 계산
- Rule: MISTAKES.md rule 8.5 — 동일한 값을 한 함수 내에서 두 번 이상 계산/조회하면 단일 const로 추출해야 함
- Context: `senkouASourceIndex`와 `senkouBSourceIndex`를 `sourceIndex`로 통합하고 senkouA 계산을 `calculateSenkouA` named helper로 추출

## [Issue #122 | feat/122/ichimoku-cloud-구현 | review fix | 2026-04-02]
- Violation: `useIchimokuOverlay.ts` line 30에서 객체 형태에 `type` alias 사용
- Rule: MISTAKES.md rule 11.5, CONVENTIONS.md — 객체 형태는 `interface`를 사용해야 함
- Context: `type IchimokuCloudPoint = { ... }`를 `interface IchimokuCloudPoint { ... }`로 변경

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-02]
- Violation: `useIchimokuOverlay.ts`의 `cloudLowerRef`가 `CHART_COLORS.background`(불투명 배경색)를 fill 색상으로 사용하여 cloudLower 아래의 다른 차트 시리즈(캔들스틱 등)를 덮어버림
- Rule: FF.md Readability — 차트 기반 데이터를 숨기는 렌더링은 사용자 경험을 해치며 의도하지 않은 side effect임
- Context: 두 AreaSeries 방식(cloudUpper + cloudLower masking)을 제거하고, senkouA/B는 LineSeries로, 구름은 `bottomColor: 'transparent'`의 bullish/bearish AreaSeries 2개로 교체하여 하위 차트 데이터를 보존

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-02]
- Violation: `useIchimokuOverlay.ts`에서 `ichimokuCloudBearish` 색상이 정의되어 있으나 사용되지 않음 — senkouA < senkouB인 의운(bearish cloud) 구간에 bearish 색상이 적용되지 않아 Ichimoku 표준 명세 미충족
- Rule: DOMAIN.md Ichimoku Cloud spec — bullish cloud(senkouA >= senkouB)와 bearish cloud(senkouA < senkouB)는 각각 다른 색상으로 구분되어야 함
- Context: bullish/bearish 구름 AreaSeries를 분리하고 각 구간에서 null을 사용하여 bullish 구간은 `ichimokuCloudBullish`, bearish 구간은 `ichimokuCloudBearish` 색상 적용

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-02]
- Violation: `calculateIchimoku`가 `bars.length`만큼만 결과를 반환하여 차트 우측의 미래 구름(Kumo) 26봉이 표시되지 않음 — Ichimoku 선행스팬 표준 명세 미충족
- Rule: DOMAIN.md Ichimoku Cloud spec — 선행스팬 A·B는 현재 시점에서 displacement(26)봉 앞으로 투영되어야 함
- Context: `calculateIchimokuFutureCloud` 함수를 domain에 추출하여 미래 26개 포인트의 senkouA/B를 계산; `useIchimokuOverlay`에서 마지막 두 봉의 interval로 미래 timestamp를 생성하여 senkouA/B 및 bullish/bearish cloud 시리즈에 append

