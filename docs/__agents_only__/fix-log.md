# Fix Log

## [PR #166 | fix/143/차트-패턴-오버레이-표시-버그-수정 | 2026-04-05] (external review — round 2)
- Violation: Magic number `2` repeated in region guard conditions (`keyPrices.length < 2`, `seriesList.length < 2`) while related index constants `REGION_UPPER_PRICE_INDEX` already existed in `constants.ts`
- Rule: MISTAKES.md #0 — Repeating hardcoded literals and values in multiple locations; when a constant is defined, all derived values must also be derived from that constant (FF Cohesion 3-B)
- Context: Added `REGION_KEY_PRICE_MIN_LENGTH = REGION_UPPER_PRICE_INDEX + 1` and `REGION_BOUNDARY_SERIES_COUNT = 2` to `constants.ts`, replaced all three literal `2` usages in `usePatternOverlay.ts` lifecycle and data-sync effects

## [PR #166 | fix/143/차트-패턴-오버레이-표시-버그-수정 | 2026-04-05] (external review)
- Violation: `priceLineVisible: false` and `lastValueVisible: false` pair repeated in 3 places across `line` and `region` series creation in `usePatternOverlay.ts`
- Rule: MISTAKES.md #0 — Repeating hardcoded literals and values in multiple locations; extract to a single const and reference it in all places (FF Cohesion 3-B)
- Context: Extracted `BASE_PATTERN_SERIES_OPTIONS` constant (including `lineWidth: DEFAULT_LINE_WIDTH`) to `constants.ts` and replaced all three `chart.addSeries(LineSeries, {...})` call-sites with spread of the shared constant

## [PR #166 | fix/143/차트-패턴-오버레이-표시-버그-수정 | 2026-04-05] (TypeScript build fix)
- Violation: `.map()` callback parameters `_price` and `i` had implicit `any` types, causing `noImplicitAny` TypeScript errors
- Rule: TypeScript strict mode — all function parameters must have explicit types; implicit `any` is prohibited
- Context: `usePatternOverlay.ts` line 161 `.map((_price, i) => ...)` callback over `keyPrices: number[]`; added `: number` type annotations to both parameters

## [PR #166 | fix/143/차트-패턴-오버레이-표시-버그-수정 | 2026-04-05] (Round 5)
- Violation: `region` render type used a single `AreaSeries` with only one `value` per bar, rendering as a flat line instead of a price band between upper and lower boundaries
- Rule: Required finding — AreaSeries `value` is a single scalar; rendering a price band requires two data points (topValue/bottomValue) or two separate series
- Context: `usePatternOverlay.ts` region branch replaced single `AreaSeries` with two `LineSeries` (upper and lower boundary), each receiving the correct boundary price from `keyPrices`

- Violation: `useEffect` with `detectedPatterns` dependency dispatched `reset` action, silently replacing all of `visiblePatterns` and discarding any user-toggled-off state whenever `patterns` changed
- Rule: FF.md Predictability 2-C — hidden side effect that overrides user toggle state is non-obvious from the hook's contract
- Context: Replaced `reset` action with `sync` action that preserves existing visible state while adding newly detected patterns; `prevDetectedRef` tracks previously known patterns to distinguish new vs toggled-off

## [PR #166 | fix/143/차트-패턴-오버레이-표시-버그-수정 | 2026-04-05] (Round 4)
- Violation: Non-null assertion `s.pattern!` used after `.filter(s => s.pattern)` because TypeScript cannot narrow the type through a plain boolean filter
- Rule: MISTAKES.md #5.5 — prefer structurally type-safe patterns over type assertions; type predicates achieve the same runtime behavior with full type safety
- Context: `confidence.ts` `buildSkillLookup` used `.filter(s => s.pattern).map(s => [s.pattern!, s])`; replaced filter with type predicate `(s): s is Skill & { pattern: string } => Boolean(s.pattern)`, eliminating the assertion

## [PR #166 | fix/143/차트-패턴-오버레이-표시-버그-수정 | 2026-04-04] (Round 3)
- Violation: Inconsistent local alias `kp` used for `pattern.keyPrices ?? []` in region block while `keyPrices` was used for the same concept in the line and marker blocks
- Rule: FF.md Readability 1-G — inconsistent naming for the same concept causes unnecessary viewpoint shifts
- Context: `usePatternOverlay.ts` region branch in series-lifecycle effect used `kp`; renamed to `keyPrices` for consistency with adjacent blocks

## [PR #166 | fix/143/차트-패턴-오버레이-표시-버그-수정 | 2026-04-04] (Round 2)
- Violation: Dead code `if (!config) continue;` guarding `pattern.renderConfig` in both `useEffect` blocks
- Rule: MISTAKES.md #9.5 — logic with no practical effect must be removed; `detectedPatterns` is already filtered by `isDetectedAndVisible` which requires `renderConfig.show` to be truthy
- Context: `usePatternOverlay.ts` lines 135 and 197 checked `if (!config) continue` after filtering ensured `renderConfig` is always defined; removed both checks and updated `isDetectedAndVisible` to a type predicate returning `p is VisiblePatternResult`

## [PR #166 | fix/143/차트-패턴-오버레이-표시-버그-수정 | 2026-04-04]
- Violation: Inline return type object shape not extracted to interface in `confidence.ts`
- Rule: CONVENTIONS.md — object shapes must be declared as named interfaces, not inline object types; `findSkill` parameter used `ReturnType<typeof buildSkillLookup>` binding it to the implementation rather than an explicit contract
- Context: `buildSkillLookup` returned `{ byName: Map<string, Skill>; byPattern: Map<string, Skill>; }` inline; extracted to `SkillLookup` interface and updated `findSkill` parameter type accordingly

## [PR #165 | feat/128/macd-대순환-분석-skill | 2026-04-04] (Round 2)
- Violation: `indicators` field in frontmatter uses block sequence notation instead of inline sequence notation
- Rule: CONVENTIONS.md consistency — all other skill files use `indicators: ['macd', 'ema']` inline format; inconsistent YAML notation reduces readability
- Context: `skills/strategies/macd-cycle.md` used `indicators:\n  - macd\n  - ema` while every other skill file in the project uses the inline array format

- Violation: Signal field order inconsistent between two signal instructions in `## AI Analysis Instructions`
- Rule: FF Readability — same `Signal` structure described with different field order (`type → strength → description` vs `type → description → strength`) causes confusion for AI generating structured output
- Context: Stage transition signal had `type → strength → description` order but entry timing signal had `type → description → strength` order; unified to `type → strength → description`


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

## [PR #154 | feat/122/ichimoku-cloud-구현 | 2026-04-03] (Round 2)
- Violation: `let` variables reassigned with spread inside a `for...of` loop, producing O(displacement²) allocations
- Rule: MISTAKES.md #3 — `let` reassignment should be replaced with `const` + new variable; prefer `reduce` for functional accumulation
- Context: `useIchimokuOverlay.ts` used four `let` variables (`finalSenkouA`, `finalSenkouB`, `finalCloudBullish`, `finalCloudBearish`) spread-reassigned 26 times inside the future cloud loop

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `!bars` 검증이 빈 배열 `[]`을 유효한 입력으로 통과시킴
- Rule: CONVENTIONS.md — 빈 bars 배열은 의미 있는 분석 결과를 기대할 수 없으므로, `!bars` 단독 검증으로는 caller에게 명확한 에러 응답을 줄 수 없음
- Context: `route.ts`의 입력 검증에서 `!bars`만으로는 빈 배열을 거르지 못하여, `bars.length === 0` 조건을 추가하여 빈 bars도 400 응답으로 처리

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

