# Fix Log

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-03] (Round 4 — external review)
- Violation: 테스트 상수 `BARS_FOR_TENKAN`, `BARS_FOR_KIJUN`, `BARS_FOR_SENKOA`, `BARS_FOR_SENKOB`에 `TEST_` 프리픽스 누락
- Rule: MISTAKES.md #6 Pattern D — 테스트 입력 상수는 `TEST_` 프리픽스 형식을 사용해야 함
- Context: `ichimoku.test.ts`의 4개 상수를 `TEST_BARS_FOR_TENKAN` 등으로 전면 rename

- Violation: `calculateIchimokuFutureCloud`에 계산 정확도 테스트(accuracy test) 누락
- Rule: CONVENTIONS.md Required Test Cases — 주기 기반 인디케이터는 첫 번째 값이 명세와 일치하는지 검증하는 accuracy 테스트가 필수
- Context: `ichimoku.test.ts`에 `future[0].senkouA`가 sourceIndex = bars.length - displacement 기반 tenkan+kijun 평균과 일치하는지 검증하는 테스트 추가

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-03] (Round 3)
- Violation: `export` on `IchimokuCloudInput` interface that is only used within the same file
- Rule: FF Cohesion — types not consumed externally should not be exported; public surface should reflect actual usage
- Context: `ichimokuUtils.ts` exported `IchimokuCloudInput` but no other file imported it; removing `export` tightens the module boundary

- Violation: IIFE inside ternary expression for complex multi-field computation
- Rule: FF Readability (1-E) — complex anonymous expressions should be extracted into named helper functions
- Context: `useIchimokuOverlay.ts` used an IIFE to compute `finalSenkouA/B/CloudBullish/Bearish`; extracted into `extendWithFutureCloud` named function

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-03] (Round 2)
- Violation: `let` variables reassigned with spread inside a `for...of` loop, producing O(displacement²) allocations
- Rule: MISTAKES.md #3 — `let` reassignment should be replaced with `const` + new variable; prefer `reduce` for functional accumulation
- Context: `useIchimokuOverlay.ts` used four `let` variables (`finalSenkouA`, `finalSenkouB`, `finalCloudBullish`, `finalCloudBearish`) spread-reassigned 26 times inside the future cloud loop

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-03]
- Violation: `forEach` with non-trivial body (multiple statements, const declarations, conditionals) used instead of `for...of`
- Rule: MISTAKES.md #1 — `for...of` preferred when loop body is non-trivial or has multiple statements
- Context: `useIchimokuOverlay.ts` used `futureCloudData.forEach((point, j) => { ... })` with multiple const declarations and conditional branches

- Violation: `.push()` mutation on local arrays returned from `buildSeriesData()`
- Rule: MISTAKES.md #4 / CONVENTIONS.md immutability — `.push()` is prohibited; spread operator must be used instead
- Context: `senkouAData.push(...)`, `senkouBData.push(...)`, etc. in `useIchimokuOverlay.ts` mutated arrays after receiving them from `buildSeriesData()`

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `!bars` 검증이 빈 배열 `[]`을 유효한 입력으로 통과시킴
- Rule: CONVENTIONS.md — 빈 bars 배열은 의미 있는 분석 결과를 기대할 수 없으므로, `!bars` 단독 검증으로는 caller에게 명확한 에러 응답을 줄 수 없음
- Context: `route.ts`의 입력 검증에서 `!bars`만으로는 빈 배열을 거르지 못하여, `bars.length === 0` 조건을 추가하여 빈 bars도 400 응답으로 처리

## [Issue #89 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbarProps`에 `xyzVisible + onXYZToggle` 플랫 props 12개가 나열되어 새 지표 추가 시 props 2개씩 증가
- Rule: FF.md Coupling 4-A — 함께 변경되는 props는 묶어야 한다; 새 지표마다 interface와 호출 사이트 양쪽을 수정해야 하는 tight coupling
- Context: `bollingerVisible/onBollingerToggle` 등 4쌍을 `IndicatorToggleGroup { visible, onToggle }` 구조로 묶어 `bollinger`, `macd`, `rsi`, `dmi` 6개 props로 감소; `StockChart.tsx` 호출 사이트 동시 업데이트

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

## [Issue #132 | fix/132/pane-indicator-label-표시-수정 | 2026-04-01]
- Violation: `PaneLabelConfig`, `PaneSubLabel` 타입이 hooks/ 파일에서 정의되고 utils/에서 import하여 역방향 의존성 발생
- Rule: CONVENTIONS.md Component Folder Structure — hooks/는 React hook 파일, utils/는 순수 함수; utils가 hooks를 import하면 안 됨
- Context: `chart/types.ts`로 공유 타입을 추출하여 hooks/와 utils/ 모두 types.ts에서 import하도록 변경


## [PR #155 | refactor/142/skills-디렉토리-패턴별-하위폴더-구조정리 | 2026-04-02]
- Violation: `collectMdFiles`에서 entry마다 별도 `stat()` 호출로 I/O 낭비 — 파일 시스템 성능 비효율
- Rule: CONVENTIONS.md Infrastructure Performance — 불필요한 시스템 콜 제거; `readdir({ withFileTypes: true })`로 `Dirent` 객체를 직접 받아 `stat` 호출 없이 디렉토리 여부 확인 가능
- Context: `loader.ts`에서 `stat` import 제거, `readdir(dir, { withFileTypes: true })` 사용으로 `entry.isDirectory()`로 분기; 테스트에서 `mockStat` 제거 후 `fileDirent`/`dirDirent` 헬퍼로 교체
## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `colors.ts`에서 `vpVah`와 `vpVal`이 동일한 색상값 `#8b5cf6`으로 설정되어 차트에서 두 선을 시각적으로 구별 불가
- Rule: DESIGN.md — VAH와 VAL은 서로 다른 가격 경계를 나타내므로 구별 가능한 색상이 필요
- Context: `vpVal`을 `#34d399`(mint green)으로 변경하여 `vpVah`(purple)와 시각적으로 구별 가능하게 함

- Violation: `src/__tests__/domain/analysis/prompt.test.ts`에서 RegExp 패턴 `/\[.+\]/`의 `\]`가 불필요한 이스케이프
- Rule: ESLint `no-useless-escape` — 정규식 문자 클래스 외부에서 `]`는 이스케이프 불필요
- Context: lines 767, 1207, 1231, 1243의 4개 RegExp 패턴에서 `\]`를 `]`로 수정




## [PR #153 | feat/121/volume-profile-indicator | external review | 2026-04-02]
- Violation: `expandValueArea` 함수의 경계 조건 `nextAbove <= 0 && nextBelow <= 0`이 볼륨 0인 유효 버킷과 범위 초과(-1)를 구분하지 않아 Value Area 확장 조기 종료
- Rule: 비즈니스 로직 정확성 — -1은 범위 초과, 0은 볼륨 없는 유효 버킷으로 구별해야 함
- Context: `src/domain/indicators/volume-profile.ts` L89에서 `<= 0` 조건을 `=== -1`로 수정하여 볼륨이 0인 버킷 너머에도 확장이 계속되도록 수정


## [PR #153 | feat/121/volume-profile-indicator | external review round 2 | 2026-04-02]

- Violation: `map`/`filter`/`reduce`/`every` 콜백 파라미터와 `Array.from` 매핑 콜백에 명시적 타입 어노테이션 누락
- Rule: MISTAKES.md #11.6 — 콜백 파라미터는 TypeScript 추론 가능 여부와 무관하게 명시적 타입 선언 필수
- Context: `useVolumeProfileOverlay.ts`의 `bars.map(bar => ...)` 및 `volume-profile.test.ts` 내 `Array.from`, `prices.map`, `result.profile.every/reduce/filter` 콜백 전체에 명시적 타입 추가; `PriceEntry` 타입 alias 추출 및 `VolumeProfileRow` import 추가

## [PR #153 | feat/121/volume-profile-indicator | external review round 5 | 2026-04-03]
- Violation: `expandValueArea` 내 `nextBelow` 계산에서 범위 조건이 수학적 표기법을 따르지 않음 (`state.valIndex - 1 >= 0` — 변수가 왼쪽, 경계가 오른쪽)
- Rule: MISTAKES.md #9.6 — range conditions must follow mathematical notation: smaller value (boundary) on left, larger on right
- Context: `src/domain/indicators/volume-profile.ts` L87에서 `state.valIndex - 1 >= 0`을 `0 <= state.valIndex - 1`으로 수정하여 경계값을 왼쪽에 배치

## [PR #153 | feat/121/volume-profile-indicator | internal review round 6 | 2026-04-03]
- Violation: `expandValueArea`가 `calculateVolumeProfile` 내부 중첩 함수로 선언되어 `rowSize`, `bucketVolumes`, `targetVolume`을 클로저로 암묵적으로 캡처 — 함수 시그니처만으로 동작을 예측 불가
- Rule: FF.md Predictability 2-C — hidden logic should be exposed; implicit closure dependencies should be explicit parameters
- Context: `expandValueArea`를 `calculateVolumeProfile` 외부 모듈 레벨 함수로 추출하고 `bucketVolumes`, `rowSize`, `targetVolume`을 명시적 파라미터로 추가하여 독립적으로 테스트 가능한 자기완결 함수로 변경

## [Issue #121 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `bucketVolumes[i] += bar.volume * ratio` — 로컬 배열이지만 index assignment로 직접 변경
- Rule: CONVENTIONS.md — 불변성 원칙; 로컬 스코프 배열이라도 index 기반 mutation 금지
- Context: `bars.reduce` + `acc.map`으로 교체하여 각 bar의 기여분을 새로운 배열로 accumulate

## [Issue #121 | feat/121/volume-profile-indicator | review fix | 2026-04-02]
- Violation: `volume-profile.test.ts` line 188에서 "rowSize 미지정 시 VP_DEFAULT_ROW_SIZE 크기의 profile을 반환한다" 테스트가 line 65의 "profile 길이는 기본 rowSize(VP_DEFAULT_ROW_SIZE)와 같다"와 동일한 assertion을 중복으로 검증
- Rule: Test Layer Rules — 각 `it` 블록은 정확히 하나의 동작을 테스트하며, 중복 테스트는 noise 없는 커버리지를 저해함
- Context: `기본 파라미터 테스트` describe 블록 전체를 제거하여 중복 제거


## [PR #154 | feat/122/ichimoku-cloud-구현 | external review | 2026-04-03]
- Violation: `IchimokuFuturePoint` 타입이 `ichimoku.ts`에 정의되어 다른 indicator 결과 타입들과 위치 불일치
- Rule: CONVENTIONS.md 타입 일관성 — 모든 indicator 결과 타입은 `domain/types.ts`에 정의되어야 함
- Context: `IchimokuFuturePoint`를 `domain/types.ts`로 이동; `ichimoku.ts`는 `domain/types`에서 import

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-02]
- Violation: `useIchimokuOverlay.ts`의 `cloudLowerRef`가 `CHART_COLORS.background`(불투명 배경색)를 fill 색상으로 사용하여 cloudLower 아래의 다른 차트 시리즈(캔들스틱 등)를 덮어버림
- Rule: FF.md Readability — 차트 기반 데이터를 숨기는 렌더링은 사용자 경험을 해치며 의도하지 않은 side effect임
- Context: 두 AreaSeries 방식(cloudUpper + cloudLower masking)을 제거하고, senkouA/B는 LineSeries로, 구름은 `bottomColor: 'transparent'`의 bullish/bearish AreaSeries 2개로 교체하여 하위 차트 데이터를 보존



## [feat/indicator-toolbar-collapse | review fix | 2026-04-03]
- Violation: `useOnClickOutside` 커스텀 훅이 `useState`로 선언된 `openDropdown`과 `setOpenDropdown`보다 뒤에 위치하여 hook 선언 순서 규칙 위반 — `react-hooks/immutability` ESLint 에러 발생
- Rule: components/CLAUDE.md Hook 선언 순서 — External hooks → State (useState) → Derived (useMemo) → Callbacks → Effects → Return; 단, 커스텀 훅이 state 변수를 참조할 경우 state 선언이 커스텀 훅 앞에 와야 함 (TDZ 회피)
- Context: `IndicatorToolbar.tsx`에서 `useOnClickOutside` 콜백이 `openDropdown`, `setOpenDropdown`을 참조하므로, state 선언을 refs보다 앞으로 이동하고 커스텀 훅을 refs 직후에 배치 (`state → refs → custom hook → derived` 순서로 실용적 변경)

