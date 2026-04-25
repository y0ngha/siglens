# Fix Log

## [PR #379 Round 2 | fix/349/briefing-retry-delay-paid-key-fallback | 2026-04-25]
- Violation: `withRetry` JSDoc 블록이 4줄 다중 단락 — 단일 줄 요약 규칙 위반
- Rule: MISTAKES.md Documentation Sync #3 — Single-line summaries only; multi-paragraph docstrings must be condensed to one line per function
- Context: `retry.ts`의 `withRetry` 함수와 `AI_SERVER_UNSTABLE_CODE` 상수 JSDoc, `index.ts`의 `getThinkingBudgetSequence`·`callGeminiReducingBudget` JSDoc 모두 단일 줄로 압축

- Violation: 엔드포인트 전용 상수(`ANALYSIS_FREE_KEY_MAX_RETRY_DELAY_MS`, `BRIEFING_MAX_RETRY_DELAY_MS`)가 범용 retry 유틸리티 모듈에 export되어 불필요한 결합 발생
- Rule: FF Cohesion 원칙 — 파일을 수정하면 함께 바뀌어야 할 파일을 같은 위치에 두어야 한다
- Context: 두 상수는 `index.ts`에서만 사용되므로 `retry.ts`에서 제거하고 `index.ts` 상수 블록으로 이동

## [PR #379 | fix/349/briefing-retry-delay-paid-key-fallback | 2026-04-25]
- Violation: `withRetry`가 누적 지연 대신 개별 지연만 `delayLimit`과 비교하여, 여러 번의 짧은 재시도가 누적되어 총 대기 시간이 한도를 초과할 수 있었음
- Rule: CONVENTIONS.md Predictability — PR 설명과 구현이 일치해야 함; "누적 재시도 지연 시간 제한"이라고 명시되어 있으면 구현도 누적값을 추적해야 함
- Context: `worker/src/retry.ts`의 `withRetry`에서 `cumulativeDelay` 변수 추가로 실제 누적 지연 합산 후 비교하도록 수정

- Violation: `callAnalysisAI`와 `callBriefingAI`가 Claude → Gemini 무료 키 → 유료 키 폴백 로직을 18줄씩 완전 중복 구현
- Rule: MISTAKES.md Coding Paradigm #1 — "Across provider pairs: extract shared logic"
- Context: `worker/src/index.ts`에서 `callGeminiWithKeyFallback` 헬퍼로 공통 로직 추출; `callAnalysisAI`, `callBriefingAI`는 각 지연 한도 상수만 전달하는 1줄로 단순화

## [Issue #349 | fix/349/briefing-retry-delay-paid-key-fallback | 2026-04-25]
- Violation: 옵션 파라미터 이름(`maxDelayMs`)이 단순 지연 상한처럼 보이지만, 실제로는 한도 초과 시 루프를 즉시 중단하고 `AI_SERVER_UNSTABLE_CODE`를 throw하는 제어 흐름 부수 효과를 가짐
- Rule: FF Predictability — 파라미터 이름은 호출 측이 타입과 이름만으로 동작을 예측할 수 있어야 한다. 숨겨진 제어 흐름 효과는 이름에 명시해야 함
- Context: `withRetry`의 `maxDelayMs` 옵션이 delay cap처럼 보였으나 실제로는 abort-on-exceed 시맨틱. `abortIfDelayExceedsMs`로 이름을 변경하여 의도를 명확히 함

## [PR #345 | feat/chat-model-selector | 2026-04-24]
- Violation: `server_busy` 에러 메시지가 "위의 모델 선택기에서"처럼 UI 레이아웃 구조를 훅 레이어에서 직접 참조
- Rule: FF Coupling — 훅(로직 레이어)은 컴포넌트 레이아웃(UI 레이어) 위치를 알아서는 안 됨
- Context: `useChat.ts`의 `ERROR_MESSAGES.server_busy`가 ChatPanel 드롭다운 위치를 서술; 위치 변경 시 메시지가 부정확해짐

## [PR #345 Round 4 | feat/chat-model-selector | 2026-04-25]
- Violation: `useState` lazy initializer에서 `localStorage` 접근으로 SSR hydration mismatch 발생
- Rule: Components — 브라우저 전용 API(localStorage, window 등)는 lazy initializer가 아닌 `useEffect`에서만 접근해야 함
- Context: `useChat.ts`의 `selectedModel` 초기화가 lazy initializer로 localStorage를 읽어 서버 렌더값(기본값)과 클라이언트 hydration값이 달라질 수 있었음; `useState(default) + 마운트 useEffect` 패턴으로 교체

## [PR #345 Round 3 | feat/chat-model-selector | 2026-04-24]
- Violation: 마운트 useEffect 내 채팅 세션 로드와 모델 설정 로드 책임 혼합 + localStorage 초기화 타이밍 버그
- Rule: CONVENTIONS.md — useEffect는 책임별로 분리; 상태 초기화는 lazy initializer 패턴 사용
- Context: `selectedModel` 쓰기 effect가 마운트 직후 기본값으로 localStorage를 덮어써 저장된 모델 선택이 소실됨; useState lazy initializer로 교체하여 해결

- Violation: 파생 변수 `selectedModelOption`이 핸들러 선언(handleDropdownToggle, handleListboxKeyDown) 이후에 위치
- Rule: MISTAKES.md #17 — 선언 순서: useState/useRef → derived → handlers → useEffect
- Context: `ChatPanel.tsx`에서 const 파생값이 핸들러보다 아래에 위치; 선언 순서 위반

## [PR #344 Round 7 | refactor/343/라우팅-계층-중복-제거-ui-로직-분리 | 2026-04-21]
- Violation: `AnalysisPanel.tsx` 복사 버튼 조건 `(!showProgress || isAnalyzing)` — `isAnalyzing=true`일 때 disabled 상태임에도 normal 스타일 적용됨
- Rule: Boolean 조건 논리 — "진행 중이 아님"은 `!(A || B)` = `!A && !B`, `!A || B` 가 아님
- Context: `(!showProgress || isAnalyzing)` → `(!showProgress && !isAnalyzing)` 로 수정; loading·analyzing 두 상태 모두 일반 스타일 적용 차단


## [PR #331 Round 3 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]

- Violation: `percentileRank` 가 분산=0 (모든 원소 동일) 케이스에서 0 반환 — 스퀴즈 false-positive 유발 가능
- Rule: defensive numerical handling — degenerate distribution 에서 정책 결정이 필요
- Context: all-equal 입력 시 `below / (len-1) = 0/0` 또는 0 반환으로 "최소값" 으로 분류되어 squeeze 조건 통과. 0.5 중립값 반환으로 수정

## [PR #331 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]
- Violation: 68~74 종목에 대한 Promise.allSettled 병렬 fetch — FMP rate limit 초과 가능
- Rule: API 호출 시 provider rate limit 고려한 concurrency 제한 필수
- Context: `sectorSignalsApi.ts` 가 `Promise.allSettled(SECTOR_STOCKS.map(...))` 로 전체 동시 실행. `fetchInChunks` 헬퍼로 청크 10개씩 순차 처리로 변경

## [PR #330 Round 2 | feature/issue-328-market-summary-panel | 2026-04-19]
- Violation: Lightweight Charts dispose 이후 `unsubscribeCrosshairMove` 직접 호출
- Rule: MISTAKES.md > Lightweight Charts #1 — ref 패턴으로 chart 생존 여부 확인 필요
- Context: `useOverlayLegend.ts` cleanup에서 `chart.unsubscribeCrosshairMove`로 변경하여 ref guard가 제거됨; chart 생성 effect cleanup이 먼저 실행 시 'Object is disposed' 예외 발생 가능

## [PR #315 Round 3 | feat/314/애드센스-배너-광고-구현 | 2026-04-16]
- Violation: layout.tsx에서 `<Script strategy="lazyOnload">`를 `<head>` 내부에 배치
- Rule: Next.js Best Practices — `next/script`는 `<body>` 영역에 배치해야 함; `lazyOnload`는 브라우저 유휴 시점 실행이므로 `<head>` 배치가 의미상 부적절
- Context: AdSense `<Script>`가 `<head>` 블록 안에 있었음; `<body>` 끝으로 이동

## [PR #294 | feat/key-levels-clustering | 2026-04-13]
- Violation: React key에 `source.price-source.reason` 조합 사용 — 동일 가격·사유 존재 시 중복 가능
- Rule: React — 리스트 렌더링 시 key 고유성 보장
- Context: `ConfluenceInfo`에서 key에 `index` 추가하여 고유성 확보

## [PR #292 | feat/291/cloud-run-worker | 2026-04-12]
- Violation: Worker에서 Promise.all로 result와 status를 동시 저장 — poller가 done 상태를 보고 result가 아직 없을 수 있는 레이스 컨디션
- Rule: 데이터 의존 관계가 있는 Redis 쓰기는 순차 실행
- Context: `worker/src/index.ts`에서 `Promise.all([set result, set status])` → `await set result; await set status`로 순차 실행

## [PR #272 Round 2 | refactor/271/skill-counts-build-time-derivation | 2026-04-11]

- Violation: `countSkillFiles`에 캐싱 없음 — 페이지 요청마다 skills/ 디렉토리를 다시 스캔
- Rule: App CLAUDE.md — "infrastructure 함수에는 `'use cache'` 디렉티브로 명시적 캐싱 적용"
- Context: `'use cache'` 디렉티브 적용; `cacheComponents: true` 활성화 필요

## [PR #270 | feat/261/차트-dynamic-import-모바일-TTI-개선 | 2026-04-11]
- Violation: dynamic import loading 컴포넌트(`ChartSkeleton`)가 `absolute inset-0`을 사용함에도 래퍼 컨테이너에 `relative` 클래스 누락
- Rule: CSS Positioning — `absolute` 자식이 올바른 영역에 렌더되려면 부모 체인에 `positioned element`(`relative/absolute/fixed/sticky`)가 있어야 함
- Context: StockChart 컨테이너(`<div className="relative flex-3">`)는 기존에 `relative`가 있었으나, VolumeChart 컨테이너는 정적 import에서 로딩 상태가 없어 `relative`가 없었음; dynamic import 전환으로 loading prop이 생기면서 문제가 드러남

## [PR #222 | feat/221/심볼-페이지-회사명-표시 | 2026-04-10]
- Violation: 서버 prefetchQuery 키와 클라이언트 훅 키 불일치 (hydration 캐시 미스)
- Rule: React Query Hydration 패턴 — prefetchQuery 키와 useQuery 키가 정확히 일치해야 함
- Context: 서버는 ticker(대문자)로 키를 만들고 클라이언트는 symbol(원본)로 키를 만들어 소문자 URL 진입 시 캐시 미스 발생


## [PR #313 | feat/312/타임프레임-변경-시-분석-작업-취소 | 2026-04-15]

## [PR #327 | refactor/324/state-machine-인디케이터-O-N-최적화 | 2026-04-18]
- Violation: period-based indicator 테스트에 toBeCloseTo 수치 검증 누락
- Rule: MISTAKES.md Tests #12 — Every period-based indicator test must include toBeCloseTo checks against manually-calculated expected values
- Context: calculateSupertrend 리팩터링 PR에서 기존 테스트가 방향성(up/down) 부등호만 검증하고 실제 계산값을 검증하지 않아 리뷰어에게 Blocker 지적 받음



## [PR #342 Round 3 | feat/multi-signal-backtest | 2026-04-20]
- Violation: `ReconciledActionLevels.reason` 필드는 툴팁 전용 사유로 정의됐으나 UI가 무시
- Rule: Domain 스키마 의도와 UI 소비 경로 일치 필수
- Context: `AnalysisPanel.ReconciledLevelsBlock` 이 reason을 전달받지 않고 generic prefix만 표시. `RECONCILED_TOOLTIP_PREFIX` + reason을 2줄로 표시하도록 변경


## [PR #344 Round 4 | refactor/343/라우팅-계층-중복-제거-ui-로직-분리 | 2026-04-21]
- Violation: `lib/skillStats.ts::countByType`가 `domain/skills.ts::countSkillsByType`와 동일한 reduce 로직 중복 구현
- Rule: DRY — 동일 로직은 단일 정의 원칙. buildSkillStats는 도메인 집계 함수이므로 domain/ 레이어가 적합
- Context: `buildSkillStats`를 `domain/skills.ts`로 이동, `countSkillsByType` 직접 재사용. `lib/skillStats.ts` 삭제

- Violation: `IndexCard.tsx`에서 `@/lib/priceFormat`을 두 개의 별도 import 구문으로 사용
- Rule: ESLint `import/no-duplicates` — 동일 모듈은 단일 import 구문으로 통합
- Context: `import { formatUsdPrice, formatPriceChange } from '@/lib/priceFormat'`으로 병합

- Violation: `useSectorSignalState.ts`의 `handleSectorChange`, `handleTimeframeChange`가 `useCallback` 미적용
- Rule: CONVENTIONS.md — 안정화된 `updateUrl`을 호출하는 핸들러는 `useCallback`으로 참조 안정화 필요
- Context: `useCallback`으로 래핑. deps: `[updateUrl, activeTimeframe]`, `[updateUrl, activeSector]`

## [PR #344 Round 3 | refactor/343/라우팅-계층-중복-제거-ui-로직-분리 | 2026-04-21]

## [PR #344 Round 18 | refactor/343/라우팅-계층-중복-제거-ui-로직-분리 | 2026-04-21]

- Violation: 범용 공유 훅이 특정 기능 폴더(`layout/hooks/`)에 위치
- Rule: ARCHITECTURE.md — components/hooks/는 여러 폴더에서 공통으로 사용하는 범용 훅 디렉토리
- Context: `useFocusTrap`이 layout 전용 폴더에 있었으나 `useDialog`(hooks/)에서 사용되므로 components/hooks/로 이동
