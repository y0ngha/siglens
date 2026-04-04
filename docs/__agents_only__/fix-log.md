# Fix Log

## [PR #171 | feat/134/key-levels-chart-visualization | 2026-04-04]
- Violation: `CHART_COLORS` and `getPeriodColor` defined in `domain/constants/colors.ts` — UI color constants placed in the domain layer
- Rule: domain/CLAUDE.md — `domain/constants/` contains only domain constants (indicator settings, timeframe constants); UI-related constants (colors, styles) do not belong here
- Context: Colors were used exclusively by chart components (lightweight-charts rendering); moved to `src/lib/colors.ts` and all 19 import paths updated accordingly

- Violation: Test file `src/__tests__/domain/constants/colors.test.ts` mirrored the source file's incorrect location in domain/
- Rule: Test CLAUDE.md Cohesion 3-A — test files must mirror source structure; lib/ is not covered by tests per test scope rules
- Context: Test file deleted when source file moved to lib/ (lib/ is excluded from test coverage per __tests__/CLAUDE.md)

- Violation: `bars[bars.length - 1]` index arithmetic used for last-element access
- Rule: FF Readability 1-D — magic index arithmetic should use `at(-1)` for idiomatic last-element access
- Context: `buildLineData` in `keyLevelsUtils.ts` accessed last bar via index; replaced with `bars.at(-1)!`

- Violation: Missing test case for poc failing both conditions (price=0 AND reason='') simultaneously
- Rule: Test coverage — edge case where both validation conditions fail together was not tested
- Context: `keyLevels.test.ts` had separate tests for each condition but not the combination; added combined failure test case

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

## [Issue #121 | feat/121/volume-profile-indicator | review fix | 2026-04-02]
- Violation: `volume-profile.test.ts` line 188에서 "rowSize 미지정 시 VP_DEFAULT_ROW_SIZE 크기의 profile을 반환한다" 테스트가 line 65의 "profile 길이는 기본 rowSize(VP_DEFAULT_ROW_SIZE)와 같다"와 동일한 assertion을 중복으로 검증
- Rule: Test Layer Rules — 각 `it` 블록은 정확히 하나의 동작을 테스트하며, 중복 테스트는 noise 없는 커버리지를 저해함
- Context: `기본 파라미터 테스트` describe 블록 전체를 제거하여 중복 제거


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

