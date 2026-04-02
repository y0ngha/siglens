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

## [PR #138 | fix/132/pane-indicator-동적-index-계산 | 2026-04-01]
- Violation: `paneIndices` useMemo 내부에서 `let next` + `next++` 재할당 사용
- Rule: MISTAKES.md #3 — let 재할당 금지, const + 새 변수 사용
- Context: `StockChart.tsx`의 `paneIndices` useMemo에서 `let next`를 `visibles.slice(0, pos).filter(Boolean).length` 기반의 순수 함수 `indexFor`로 교체

## [Issue #121 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `bucketVolumes[i] += bar.volume * ratio` — 로컬 배열이지만 index assignment로 직접 변경
- Rule: CONVENTIONS.md — 불변성 원칙; 로컬 스코프 배열이라도 index 기반 mutation 금지
- Context: `bars.reduce` + `acc.map`으로 교체하여 각 bar의 기여분을 새로운 배열로 accumulate

## [Issue #121 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `while` 루프 내부에서 `vahIndex += 1`, `valIndex -= 1` index 재할당
- Rule: MISTAKES.md #1 — while 루프 + index 재할당은 모든 경우에서 금지
- Context: `expandValueArea` 재귀 함수로 교체하여 state를 immutable하게 전달; 타입 `ValueAreaState`를 파일 최상단으로 추출

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `colors.ts`에서 `vpVah`와 `vpVal`이 동일한 색상값 `#8b5cf6`으로 설정되어 차트에서 두 선을 시각적으로 구별 불가
- Rule: DESIGN.md — VAH와 VAL은 서로 다른 가격 경계를 나타내므로 구별 가능한 색상이 필요
- Context: `vpVal`을 `#34d399`(mint green)으로 변경하여 `vpVah`(purple)와 시각적으로 구별 가능하게 함

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `useVolumeProfileOverlay.ts`에서 `bars.map(bar => ({ time: bar.time as UTCTimestamp, value: X }))` 패턴이 poc, vah, val에 걸쳐 3회 반복
- Rule: MISTAKES.md #10 — 동일한 계산 로직이 2회 이상 반복되면 단일 소스로 추출
- Context: `toLineData = (value: number) => bars.map(...)` 헬퍼를 useEffect 내부에서 추출하여 중복 제거; 시리즈 생성 로직도 `createLineSeries` 헬퍼로 추출

## [PR #153 | feat/121/volume-profile-indicator | internal review | 2026-04-02]
- Violation: `useVolumeProfileOverlay.ts`에서 `lineWidth`를 params interface에 포함하지 않고 `DEFAULT_LINE_WIDTH`를 직접 series 생성 시 인라인으로 사용하여 TS6133 발생 및 다른 overlay 훅과 패턴 불일치
- Rule: CONVENTIONS.md Custom Hook Rules — 모든 overlay 훅은 `lineWidth?: LineWidth`를 params로 수신하고 default 값으로 `DEFAULT_LINE_WIDTH`를 적용해야 함
- Context: `UseVolumeProfileOverlayParams`에 `lineWidth?: LineWidth` 추가, 함수 시그니처에서 `lineWidth = DEFAULT_LINE_WIDTH` default 적용, series 생성 시 param 값 사용으로 `useBollingerOverlay` 등과 동일한 패턴으로 통일

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `volume-profile.ts`의 `ValueAreaState`가 `type`으로 선언되어 있어 MISTAKES.md #11.5 위반
- Rule: MISTAKES.md #11.5 — 객체 형태(object shape)는 `type` 대신 `interface`로 선언
- Context: `src/domain/indicators/volume-profile.ts`에서 `type ValueAreaState`를 `interface ValueAreaState`로 변경

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `prompt.ts`의 `formatIndicatorSection`에서 `indicators.volumeProfile`에 3회 접근 (MISTAKES.md #8.5 위반)
- Rule: MISTAKES.md #8.5 — 동일한 값이 같은 함수 안에서 2회 이상 조회될 때는 로컬 const로 추출
- Context: `const vp = indicators.volumeProfile`를 함수 상단 다른 `last*` 변수들과 함께 추출하여 단일 접근으로 변경

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `volume-profile.ts`의 모든 reduce/map 콜백 파라미터에 명시적 타입 어노테이션 누락
- Rule: MISTAKES.md #11.6 — 콜백 파라미터(map, filter, reduce, sort, forEach)에는 항상 명시적 타입 어노테이션을 선언한다
- Context: L25, L28, L36, L39, L49, L65, L69, L112 각 콜백에 `(max: number, bar: Bar)`, `(acc: number[], bar: Bar)` 등 명시적 타입 추가; `volume-profile.test.ts`에서도 reduce/filter 콜백 파라미터에 `VolumeProfileRow` 타입 추가

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `volume-profile.test.ts:182`에서 POC 위치 검증 단언 `toBeGreaterThan(100)`이 저가 구간 poc도 통과시키는 약한 단언
- Rule: MISTAKES.md #12 — 항상 통과할 수 있는 단언은 커버리지를 소비하지만 의도를 드러내지 못한다
- Context: 고가 구간(150~160)에 거래량이 집중된 테스트 시나리오에서 `toBeGreaterThan(140)`으로 변경하여 POC가 실제 고가 구간에 있음을 검증

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `volume-profile.test.ts:215`에서 허용 오차 `0.05` 매직 넘버 인라인 사용
- Rule: FF.md 1-D — 매직 넘버는 이름을 붙여 의미를 드러낸다
- Context: `const VALUE_AREA_TOLERANCE = 0.05`로 추출하고 주석으로 bucket 경계 이산화 허용 오차임을 명시

## [PR #153 | feat/121/volume-profile-indicator | internal review | 2026-04-02]
- Violation: `volume-profile.test.ts`에서 `VolumeProfileRow` import가 선언되어 있으나 reduce/filter 콜백에서 TypeScript가 타입을 자동 추론하여 명시적 어노테이션이 불필요해 TS6196 컴파일 오류 발생
- Rule: TypeScript — 불필요한 import는 제거하고, TypeScript가 추론할 수 있는 콜백 파라미터 타입은 명시하지 않는다
- Context: `VolumeProfileRow` import 제거 및 reduce/filter 콜백에서 명시적 타입 어노테이션 제거; `expandValueArea` const arrow function을 named function declaration으로 변경하여 domain 컨벤션 일치

