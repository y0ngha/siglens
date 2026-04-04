# Fix Log

## [PR #170 | feat/133/상승-하락-추세선-차트-표시 | 2026-04-05]
- Violation: `CHART_COLORS` and `getPeriodColor` defined in `src/domain/constants/colors.ts`, which is a UI concern and must not live in the domain layer
- Rule: ARCHITECTURE.md domain layer rule — UI-related constants (colors, styles) do not belong in domain/
- Context: Chart color constants were placed in domain/ during initial implementation; moved to `src/lib/chartColors.ts` and updated all 19 import sites including test files

- Violation: `TrendlineItem` in `AnalysisPanel.tsx` used inline ternary expressions for `colorClass` and `bgClass` instead of `Record<TrendlineDirection, string>` maps
- Rule: FF.md Readability 1-A — separate code that doesn't run simultaneously via object maps; consistent with the rest of the file's pattern
- Context: Two inline ternaries on `trendline.direction === 'ascending'` replaced with `TRENDLINE_COLOR` and `TRENDLINE_BG_COLOR` Record maps defined at module level

## [PR #170 | feat/133/상승-하락-추세선-차트-표시 | 2026-04-05]
- Violation: `resolveTrendlinePrice` pure utility function defined inside `useTrendlineOverlay.ts` (hooks/ file) instead of utils/ subfolder
- Rule: MISTAKES.md #11.4 / CONVENTIONS.md Component Folder Structure — hooks/ files must contain only React hooks; pure utility functions belong in utils/
- Context: Moved `resolveTrendlinePrice` to `src/components/chart/utils/trendlineUtils.ts` and updated the import in `useTrendlineOverlay.ts`

- Violation: `docs/DESIGN.md` not updated after adding `trendlineAscending`/`trendlineDescending` color constants in `src/lib/chartColors.ts`, and document still referenced old `@/domain/constants/colors` import path
- Rule: MISTAKES.md #12 — when new constants are added, verify they are documented in the relevant design docs
- Context: Added a new `### 추세선` section in docs/DESIGN.md and updated the import example from `@/domain/constants/colors` to `@/lib/chartColors`

- Violation: `trendlineKey(trendline)` computed twice per iteration in the data-sync `useEffect` of `useTrendlineOverlay.ts`
- Rule: MISTAKES.md #8.5 — identical values queried or computed multiple times in a single function should be extracted to a local const
- Context: The key was computed inline inside `seriesMapRef.current.get(trendlineKey(trendline))`; extracted to `const key = trendlineKey(trendline)` before use

## [Issue #133 | feat/133/상승-하락-추세선-차트-표시 | 2026-04-04]
- Violation: `TRENDLINE_DIRECTION_LABEL` and `TRENDLINE_DIRECTION_COLOR` defined in both `src/components/chart/hooks/useTrendlineOverlay.ts` and `src/components/analysis/AnalysisPanel.tsx`
- Rule: MISTAKES.md rule 0, FF.md Cohesion 3-B — same values defined in multiple places create maintenance risk; one source of truth required
- Context: Both files independently defined the same direction→label and direction→color mappings; extracted to `src/components/chart/constants.ts` and imported in both files

- Violation: `UseTrendlineOverlayReturn` interface declared `visibleTrendlines` and `toggleTrendline` but `StockChart.tsx` discarded the entire return value
- Rule: FF.md Readability 1-B — logic with no practical effect adds noise and obscures intent
- Context: `useTrendlineOverlay` built and returned a toggle API that had no caller; removed the dead return type and changed the function to return `void`

## [PR #170 Round 2 | feat/133/상승-하락-추세선-차트-표시 | 2026-04-04]
- Violation: Index-based series management in `useTrendlineOverlay.ts` caused stale series with mismatched color/title when a trendline was removed from any position other than the last
- Rule: FF.md Predictability 2-C — behavior cannot be predicted from the function signature when hidden state diverges from current data; series must be keyed by stable identity
- Context: `seriesMapRef` used array index as key; removing a non-last trendline left stale series at earlier indices; replaced with stable key `direction:start.time:end.time`

- Violation: `Trendline`, `TrendlineDirection`, `TrendlinePoint` types declared after `AnalysisResponse` which references `Trendline`, violating top-to-bottom readability
- Rule: FF.md Readability 1-G — types must be declared before use; forward references reduce readability and caused TS2305 errors in consumers
- Context: Moved the three trendline types to before `AnalysisResponse` in `src/domain/types.ts`

- Violation: `AnalysisPanel.tsx` imported `TRENDLINE_DIRECTION_COLOR` and `TRENDLINE_DIRECTION_LABEL` from `@/components/chart/constants`, coupling an analysis-layer component to a sibling chart component folder
- Rule: FF.md Cohesion 3-A — constants shared between chart and analysis components should live in a dedicated shared location
- Context: Moved both constants to `src/components/trendline/constants.ts`; `chart/constants.ts` re-exports them for backward compatibility

## [PR #170 Round 3 | feat/133/상승-하락-추세선-차트-표시 | 2026-04-04]
- Violation: Unused backward-compatibility re-export of `TRENDLINE_DIRECTION_LABEL` and `TRENDLINE_DIRECTION_COLOR` in `chart/constants.ts` with no importers
- Rule: CLAUDE.md — avoid backwards-compatibility hacks like re-exporting; if unused, delete completely
- Context: After moving constants to `components/trendline/constants.ts`, the re-export in `chart/constants.ts` was kept but no file imported from `chart/constants` for these symbols; removed the entire re-export block

- Violation: `const points` array mutated via `.push()` in `useTrendlineOverlay.ts` data sync effect
- Rule: CONVENTIONS.md immutability — `❌ bars.push(newBar)` / `✅ [...bars, newBar]`; MISTAKES.md rule 4 — directly mutating original arrays/objects
- Context: `points.push({ time: extended.time, value: extended.price })` replaced with spread into `allPoints` const

- Violation: Template literal `` `${t.direction}:${t.start.time}:${t.end.time}` `` duplicated 3 times in `useTrendlineOverlay.ts`
- Rule: MISTAKES.md rule 0 — repeating hardcoded literals in multiple locations; extract to single const
- Context: Key generation pattern appeared at lines 45, 58, 80; extracted to `trendlineKey` function in `src/components/chart/utils/trendlineUtils.ts`

- Violation: Trendline rendering used AI-provided prices directly without grounding to actual bar data, causing wrong direction and wrong price position on chart
- Rule: FF.md Predictability 2-A — rendering must produce predictable output from the series data; AI prices may not match actual bar OHLC prices at the given timestamps
- Context: For ascending trendlines, bar.low was used; for descending, bar.high; `barsMap` (useMemo) used for O(1) lookup; `extendTrendline` called with resolved prices

## [PR #170 | feat/133/상승-하락-추세선-차트-표시 | 2026-04-04]
- Violation: `VisibleTrendlinesAction` toggle union, `visibleTrendlinesReducer` toggle branch, `useReducer`, reset `useEffect`, and `visibleTrendlines.has()` guards all remained as dead code after toggle was removed externally
- Rule: MISTAKES.md 9.5, FF.md Readability 1-B — logic with no practical effect must be removed
- Context: toggle dispatch was never called anywhere; `visibleTrendlines` was always a full set so guards were always true; entire visibility state management was redundant

- Violation: `lightweight-charts` setData called with unsorted or potentially duplicate timestamps causing runtime error
- Rule: FF.md Predictability 2-A — library constraints must be respected to prevent runtime errors
- Context: `lineData` array was built from `start.time`, `end.time`, `extended.time` with no sort or dedup; added sort + dedup logic before calling setData

- Violation: React list key used array index instead of stable unique identifier
- Rule: FF.md Predictability 2-A — index keys cause incorrect reconciliation when list order changes
- Context: `analysis.trendlines.map((trendline, index) => <TrendlineItem key={trendline-${index}} ...>` changed to use `direction + start.time + end.time` composite key

## [PR #165 | feat/128/macd-대순환-분석-skill | 2026-04-04] (Round 2)
- Violation: `indicators` field in frontmatter uses block sequence notation instead of inline sequence notation
- Rule: CONVENTIONS.md consistency — all other skill files use `indicators: ['macd', 'ema']` inline format; inconsistent YAML notation reduces readability
- Context: `skills/strategies/macd-cycle.md` used `indicators:\n  - macd\n  - ema` while every other skill file in the project uses the inline array format

- Violation: Signal field order inconsistent between two signal instructions in `## AI Analysis Instructions`
- Rule: FF Readability — same `Signal` structure described with different field order (`type → strength → description` vs `type → description → strength`) causes confusion for AI generating structured output
- Context: Stage transition signal had `type → strength → description` order but entry timing signal had `type → description → strength` order; unified to `type → strength → description`

## [PR #163 | feat/124/엘리어트-파동-스킬-구현 | 2026-04-03]
- Violation: JSX 내 IIFE 패턴 사용
- Rule: FF.md Readability 1-A — 동시에 실행되지 않는 분기는 분리해야 함
- Context: `SkillAccordionItem`의 렌더 블록에서 `sections` 계산을 컴포넌트 바디로 이동하고 단순 조건부 렌더로 교체

- Violation: `parseStructuredSummary` 순수 유틸 함수가 컴포넌트 파일 내부에 위치
- Rule: CONVENTIONS.md Component Folder Structure — 순수 유틸 함수(non-hook helper)는 `utils/` 서브폴더에 위치해야 함
- Context: `AnalysisPanel.tsx`에서 `parseStructuredSummary`를 `components/analysis/utils/parseStructuredSummary.ts`로 분리

- Violation: magic number `3` 사용
- Rule: FF.md Readability 1-D — 의미가 불명확한 숫자 리터럴은 이름 있는 상수로 추출해야 함
- Context: `parseStructuredSummary`의 `sections.length >= 3`을 `MIN_STRUCTURED_SUMMARY_SECTIONS` 상수로 추출

## [PR #162 | fix/151/react-key-중복-오류-수정 | 2026-04-03]
- Violation: `.map()` callback with side effect mutating a closure variable (`counter`)
- Rule: MISTAKES.md #1 — when a loop body has multiple statements and maintains accumulated state, `for...of` is preferred over `.map()` with side effects
- Context: `buildUniqueIds` in `confidence.ts` used `.map()` to both mutate a `Map` counter and return transformed values; replaced with `for...of` loop using a local `ids` array

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-03] (Round 4 — external review)
- Violation: 테스트 상수 `BARS_FOR_TENKAN`, `BARS_FOR_KIJUN`, `BARS_FOR_SENKOA`, `BARS_FOR_SENKOB`에 `TEST_` 프리픽스 누락
- Rule: MISTAKES.md #6 Pattern D — 테스트 입력 상수는 `TEST_` 프리픽스 형식을 사용해야 함
- Context: `ichimoku.test.ts`의 4개 상수를 `TEST_BARS_FOR_TENKAN` 등으로 전면 rename

## [PR #165 | feat/128/macd-대순환-분석-skill | 2026-04-03]
- Violation: `strength` field missing from stage transition signal instruction in `## AI Analysis Instructions`
- Rule: Domain type contract — `Signal` interface requires `strength: SignalStrength` as a mandatory field; omitting it causes AI to generate incomplete `Signal` objects
- Context: `skills/strategies/macd-cycle.md` specified `strength` for entry timing signals but omitted it for stage transition signals, creating inconsistency that could produce invalid output

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


## [PR #162 | fix/151/react-key-중복-오류-수정 | 2026-04-03]
- Violation: `buildPatternIds`가 const 화살표 함수로 선언되어 domain 레이어 함수 선언 관례 위반
- Rule: domain/CLAUDE.md — Always use `export function` (named function declaration), no arrow function exports or classes; 비공개 헬퍼도 함수 선언식 사용
- Context: `src/domain/analysis/confidence.ts`의 `buildPatternIds`를 `function buildUniqueIds<T, K extends keyof T>` 제네릭 함수 선언식으로 변경하여 재사용성과 관례 준수 동시 달성

- Violation: `SkillResult`에 `id` 필드 없어 `SkillAccordionItem` 렌더링 시 `skillName` 중복 가능성 및 React key 불안정
- Rule: 일관성 — `PatternSummary`와 `CandlePatternSummary`에 `id`를 추가한 것과 동일하게 `SkillResult`도 고유 ID 부여 필요
- Context: `SkillResult`에 `id: string` 추가, `RawAnalysisResponse`에서 `id` Omit, `enrichAnalysisWithConfidence`에서 `buildUniqueIds(skillResults, 'skillName')` 로 ID 생성, `AnalysisPanel.tsx`에서 `key={skill.id}`로 변경

- Violation: `PatternAccordionItemProps.onToggleVisibility` 파라미터명이 `patternName`으로 실제 전달값(패턴 ID)과 불일치
- Rule: FF.md Readability 1-A — 파라미터명은 실제 전달되는 값의 의미를 반영해야 함
- Context: `AnalysisPanel.tsx`의 `PatternAccordionItemProps.onToggleVisibility` 파라미터를 `patternName: string`에서 `patternId: string`으로 변경

## [PR #163 | feat/124/엘리어트-파동-스킬-구현 | 2026-04-03] (Round 2 — external review)
- Violation: `buildAnalysisRequest`의 `strategyInstruction`에 엘리어트 파동 전용 용어("wave assessment", "motive wave", "corrective wave") 하드코딩
- Rule: FF.md Coupling 4-A — prompt builder가 특정 skill의 도메인 언어에 결합되어서는 안 됨; 각 skill의 `## AI Analysis Instructions`가 단일 정보 출처(single source of truth)
- Context: `src/domain/analysis/prompt.ts` L294에서 Elliott Wave 전용 trend 판단 지시를 범용 지시("Set the trend field based on each skill's own analysis instructions")로 교체

## [PR #163 | feat/124/엘리어트-파동-스킬-구현 | 2026-04-04] (Round 3 — external review)
- Violation: `AnalysisPanel.tsx`에서 `parseStructuredSummary` import에 상대 경로(`./utils/parseStructuredSummary`) 사용
- Rule: CONVENTIONS.md Import Path Rules — 상대 경로 금지; 모든 import에 path alias(`@/...`) 사용 필수
- Context: `src/components/analysis/AnalysisPanel.tsx`의 import를 `@/components/analysis/utils/parseStructuredSummary`로 수정하여 같은 파일의 다른 import들과 일관성 확보

## [feat/indicator-toolbar-collapse | review fix | 2026-04-03]
- Violation: `useOnClickOutside` 커스텀 훅이 `useState`로 선언된 `openDropdown`과 `setOpenDropdown`보다 뒤에 위치하여 hook 선언 순서 규칙 위반 — `react-hooks/immutability` ESLint 에러 발생
- Rule: components/CLAUDE.md Hook 선언 순서 — External hooks → State (useState) → Derived (useMemo) → Callbacks → Effects → Return; 단, 커스텀 훅이 state 변수를 참조할 경우 state 선언이 커스텀 훅 앞에 와야 함 (TDZ 회피)
- Context: `IndicatorToolbar.tsx`에서 `useOnClickOutside` 콜백이 `openDropdown`, `setOpenDropdown`을 참조하므로, state 선언을 refs보다 앞으로 이동하고 커스텀 훅을 refs 직후에 배치 (`state → refs → custom hook → derived` 순서로 실용적 변경)

## [Issue #128 | feat/128/macd-cycle-indicator-구현 | 2026-04-03]
- Violation: `skills/strategies/macd-cycle.md`에서 `type: strategy`를 사용했으나, `SkillType`은 `'pattern' | 'indicator_guide'`만 지원하므로 유효하지 않은 값
- Rule: DOMAIN.md Skills System — SkillType enum must be one of the defined union type values; invalid strategy value causes type mismatch
- Context: `skills/strategies/macd-cycle.md`의 frontmatter `type:` 필드를 `type: indicator_guide`로 수정하여 타입 유효성 확보

## [PR #170 | feat/133/상승-하락-추세선-차트-표시 | 2026-04-04]
- Violation: Inline `style={{ backgroundColor: TRENDLINE_DIRECTION_COLOR[...] }}` used in `TrendlineItem` span inside `AnalysisPanel.tsx`
- Rule: CONVENTIONS.md / DESIGN.md — inline styles are prohibited; use Tailwind color token classes (`bg-chart-bullish`, `bg-chart-bearish`) instead
- Context: `src/components/analysis/AnalysisPanel.tsx` TrendlineItem component used an inline style for the direction dot color; replaced with a `bgClass` ternary using `bg-chart-bullish` / `bg-chart-bearish` and removed the now-unused `TRENDLINE_DIRECTION_COLOR` import

