# Fix Log

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-03]
- Violation: `calculateIndicators`에 `volumeProfile` 필드가 추가되었으나 `index.test.ts`에 해당 필드 검증 테스트가 없음
- Rule: MISTAKES.md Tests #3, #3.5 — 새 인디케이터 추가 시 모든 연관 함수(계산 함수 + 통합 함수)에 테스트가 있어야 함
- Context: `src/__tests__/domain/indicators/index.test.ts`에 `volumeProfile` null 케이스 및 `calculateVolumeProfile` 결과 일치 테스트 추가

- Violation: `formatIndicatorSection`이 VP 데이터를 프롬프트에 포함하지만 관련 테스트가 없음
- Rule: MISTAKES.md Tests #3.5 — 새 인디케이터 포맷팅 로직은 기존 패턴(RSI, MACD, Bollinger)과 동일하게 null/값 있을 때 케이스 모두 테스트해야 함
- Context: `src/__tests__/domain/analysis/prompt.test.ts`에 `volumeProfile null` 시 N/A 표시 및 POC/VAH/VAL 값 포함 테스트 추가

- Violation: `CHART_COLORS`에 `vpPoc`, `vpVah`, `vpVal` 항목이 추가되었으나 `colors.test.ts`가 업데이트되지 않음
- Rule: MISTAKES.md Tests #3 — 새로 추가된 상수는 기존 패턴(vwap, bollinger, dmi 등)과 동일하게 개별 테스트 케이스를 가져야 함
- Context: `src/__tests__/domain/constants/colors.test.ts`에 Volume Profile 컬러 describe 블록 추가

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-03]
- Violation: `IndicatorResult` 타입에 `volumeProfile` 필드가 추가되었으나 테스트 픽스처에 반영되지 않아 TypeScript 컴파일 에러 발생
- Rule: CONVENTIONS.md — 타입 변경 시 모든 사용 지점(테스트 픽스처 포함)을 함께 업데이트해야 함
- Context: `src/__tests__/domain/analysis/prompt.test.ts`와 `src/__tests__/infrastructure/market/analysisApi.test.ts`의 `IndicatorResult` 목 객체에 `volumeProfile: null` 필드 누락

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
- Violation: `src/infrastructure/CLAUDE.md` skills 섹션이 `FileSkillsLoader`의 재귀 탐색 변경을 반영하지 않아 에이전트가 잘못된 정보를 읽는 상태
- Rule: FF.md Cohesion 3-A — 함께 변경되어야 할 문서는 함께 변경되어야 한다
- Context: `FileSkillsLoader`가 `skills/*.md`만 읽는 방식에서 하위 디렉토리 재귀 탐색 방식으로 변경되었으나 `src/infrastructure/CLAUDE.md`가 갱신되지 않았음; "Reads `skills/*.md` files" → "Recursively scans `skills/` subdirectories for `.md` files"로 수정

## [PR #155 | refactor/142/skills-디렉토리-패턴별-하위폴더-구조정리 | 2026-04-02]
- Violation: `collectMdFiles`에서 entry마다 별도 `stat()` 호출로 I/O 낭비 — 파일 시스템 성능 비효율
- Rule: CONVENTIONS.md Infrastructure Performance — 불필요한 시스템 콜 제거; `readdir({ withFileTypes: true })`로 `Dirent` 객체를 직접 받아 `stat` 호출 없이 디렉토리 여부 확인 가능
- Context: `loader.ts`에서 `stat` import 제거, `readdir(dir, { withFileTypes: true })` 사용으로 `entry.isDirectory()`로 분기; 테스트에서 `mockStat` 제거 후 `fileDirent`/`dirDirent` 헬퍼로 교체
## [Issue #121 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `while` 루프 내부에서 `vahIndex += 1`, `valIndex -= 1` index 재할당
- Rule: MISTAKES.md #1 — while 루프 + index 재할당은 모든 경우에서 금지
- Context: `expandValueArea` 재귀 함수로 교체하여 state를 immutable하게 전달; 타입 `ValueAreaState`를 파일 최상단으로 추출

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `colors.ts`에서 `vpVah`와 `vpVal`이 동일한 색상값 `#8b5cf6`으로 설정되어 차트에서 두 선을 시각적으로 구별 불가
- Rule: DESIGN.md — VAH와 VAL은 서로 다른 가격 경계를 나타내므로 구별 가능한 색상이 필요
- Context: `vpVal`을 `#34d399`(mint green)으로 변경하여 `vpVah`(purple)와 시각적으로 구별 가능하게 함

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-03]
- Violation: `src/__tests__/domain/indicators/index.test.ts`에서 `calculateVolumeProfile`을 `@/domain/indicators/volume-profile`에서 별도 import하여 중복 import 경로 존재
- Rule: FF.md Cohesion 3-A — 동일 심볼은 단일 import 경로에서 가져와야 한다; `@/domain/indicators`에서 이미 re-export되므로 별도 import 불필요
- Context: line 12의 별도 import를 제거하고 `calculateVolumeProfile`을 기존 `@/domain/indicators` import 블록에 추가

- Violation: `src/__tests__/domain/analysis/prompt.test.ts`에서 RegExp 패턴 `/\[.+\]/`의 `\]`가 불필요한 이스케이프
- Rule: ESLint `no-useless-escape` — 정규식 문자 클래스 외부에서 `]`는 이스케이프 불필요
- Context: lines 767, 1207, 1231, 1243의 4개 RegExp 패턴에서 `\]`를 `]`로 수정

- Violation: `expandValueArea`에서 sentinel 값 `-1`이 3곳(lines 27, 29, 31)에 하드코딩되어 반복 사용
- Rule: MISTAKES.md #0 — 동일한 리터럴 값은 하나의 named const로 추출해야 한다; FF.md Cohesion 3-B
- Context: `NO_ADJACENT_BUCKET = -1` 상수를 추출하여 `volume-profile.ts`의 3개 사용 지점 모두 교체

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `volume-profile.ts`의 `ValueAreaState`가 `type`으로 선언되어 있어 MISTAKES.md #11.5 위반
- Rule: MISTAKES.md #11.5 — 객체 형태(object shape)는 `type` 대신 `interface`로 선언
- Context: `src/domain/indicators/volume-profile.ts`에서 `type ValueAreaState`를 `interface ValueAreaState`로 변경

## [PR #153 | feat/121/volume-profile-indicator | 2026-04-02]
- Violation: `prompt.ts`의 `formatIndicatorSection`에서 `indicators.volumeProfile`에 3회 접근 (MISTAKES.md #8.5 위반)
- Rule: MISTAKES.md #8.5 — 동일한 값이 같은 함수 안에서 2회 이상 조회될 때는 로컬 const로 추출
- Context: `const vp = indicators.volumeProfile`를 함수 상단 다른 `last*` 변수들과 함께 추출하여 단일 접근으로 변경


## [PR #153 | feat/121/volume-profile-indicator | external review | 2026-04-02]
- Violation: `expandValueArea` 함수의 경계 조건 `nextAbove <= 0 && nextBelow <= 0`이 볼륨 0인 유효 버킷과 범위 초과(-1)를 구분하지 않아 Value Area 확장 조기 종료
- Rule: 비즈니스 로직 정확성 — -1은 범위 초과, 0은 볼륨 없는 유효 버킷으로 구별해야 함
- Context: `src/domain/indicators/volume-profile.ts` L89에서 `<= 0` 조건을 `=== -1`로 수정하여 볼륨이 0인 버킷 너머에도 확장이 계속되도록 수정

## [PR #153 | feat/121/volume-profile-indicator | external review | 2026-04-02]
- Violation: `prompt.ts` Support/Resistance 섹션에 VP 레벨 사용 지침과 AI가 직접 PoC를 식별하라는 기존 지침이 공존하여 상충
- Rule: FF.md Predictability 2-B — 같은 개념(POC)에 대해 두 개의 상충되는 근거가 존재함
- Context: `src/domain/analysis/prompt.ts` L239의 `Identify PoC from the last 30 bars` 지침을 제거; VP 인디케이터가 POC를 이미 계산하여 Section 5에 제공하므로 중복 지침 불필요

## [PR #153 | feat/121/volume-profile-indicator | external review round 2 | 2026-04-02]
- Violation: `map`/`filter`/`reduce`/`every` 콜백 파라미터와 `Array.from` 매핑 콜백에 명시적 타입 어노테이션 누락
- Rule: MISTAKES.md #11.6 — 콜백 파라미터는 TypeScript 추론 가능 여부와 무관하게 명시적 타입 선언 필수
- Context: `useVolumeProfileOverlay.ts`의 `bars.map(bar => ...)` 및 `volume-profile.test.ts` 내 `Array.from`, `prices.map`, `result.profile.every/reduce/filter` 콜백 전체에 명시적 타입 추가; `PriceEntry` 타입 alias 추출 및 `VolumeProfileRow` import 추가

## [PR #153 | feat/121/volume-profile-indicator | internal review round 3 | 2026-04-02]
- Violation: `VolumeProfileRow` import와 `PriceEntry` 로컬 타입이 TS6196 (declared but never used)으로 컴파일 에러 발생 — TypeScript가 콜백 파라미터 타입을 자동 추론하므로 명시적 어노테이션이 불필요
- Rule: MISTAKES.md #11.7 — 타입이 import됐지만 TypeScript가 자동 추론하면 불필요한 import를 제거
- Context: `volume-profile.test.ts`에서 `VolumeProfileRow` import 및 `PriceEntry` 타입 정의 제거; `result.profile.every/reduce/filter` 콜백 파라미터 어노테이션을 TypeScript 추론에 맡기도록 변경

## [PR #153 | feat/121/volume-profile-indicator | internal review round 4 | 2026-04-02]
- Violation: `const result: VolumeProfileResult | null = calculateVolumeProfile(bars)` 형태로 명시적 타입 어노테이션이 남아 있어 `VolumeProfileResult` import가 불필요하게 유지됨
- Rule: MISTAKES.md #11.7 — TypeScript가 함수 반환 타입으로 자동 추론할 수 있을 때 명시적 어노테이션은 제거
- Context: `volume-profile.test.ts`에서 `VolumeProfileResult` import 제거 및 `const result: VolumeProfileResult | null` 어노테이션을 `const result`로 변경하여 TypeScript 추론에 위임

## [PR #153 | feat/121/volume-profile-indicator | external review round 5 | 2026-04-03]
- Violation: `expandValueArea` 내 `nextBelow` 계산에서 범위 조건이 수학적 표기법을 따르지 않음 (`state.valIndex - 1 >= 0` — 변수가 왼쪽, 경계가 오른쪽)
- Rule: MISTAKES.md #9.6 — range conditions must follow mathematical notation: smaller value (boundary) on left, larger on right
- Context: `src/domain/indicators/volume-profile.ts` L87에서 `state.valIndex - 1 >= 0`을 `0 <= state.valIndex - 1`으로 수정하여 경계값을 왼쪽에 배치

## [PR #153 | feat/121/volume-profile-indicator | internal review round 6 | 2026-04-03]
- Violation: `expandValueArea`가 `calculateVolumeProfile` 내부 중첩 함수로 선언되어 `rowSize`, `bucketVolumes`, `targetVolume`을 클로저로 암묵적으로 캡처 — 함수 시그니처만으로 동작을 예측 불가
- Rule: FF.md Predictability 2-C — hidden logic should be exposed; implicit closure dependencies should be explicit parameters
- Context: `expandValueArea`를 `calculateVolumeProfile` 외부 모듈 레벨 함수로 추출하고 `bucketVolumes`, `rowSize`, `targetVolume`을 명시적 파라미터로 추가하여 독립적으로 테스트 가능한 자기완결 함수로 변경

