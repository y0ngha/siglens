# Fix Log

## [PR #380 Round 3 | fix/350/thinking-budget-preservation-across-retries | 2026-04-25]
- Violation: 설계상 도달 불가능한 throw 문에 `/* istanbul ignore next */` 없이 방치 → Istanbul 100% 커버리지 실패
- Rule: Infrastructure #2 — infrastructure/ 100% branch coverage 요건
- Context: `getThinkingBudgetSequence()`가 항상 `DISABLED_THINKING_BUDGET`으로 끝나므로 루프 마지막 `throw`는 절대 실행되지 않음; `/* istanbul ignore next */` 추가로 Istanbul 집계 제외

- Violation: Jest 테스트에서 mock 객체 프로퍼티를 `try/finally`로 직접 변이 후 복원
- Rule: CONVENTIONS.md Functional Programming — Immutability; 직접 할당(`obj.prop = val`)은 mutation
- Context: `callGeminiWithKeyFallback` 테스트의 freeApiKey 비설정 케이스에서 `config.gemini.freeApiKey = ''`로 직접 변이 후 finally 복원; `jest.replaceProperty(config.gemini, 'freeApiKey', '')` + `jest.restoreAllMocks()`로 교체

- Violation: 비활성화된 fallback 모델 코드 6줄이 TODO 주석으로 남아 production 코드에 잔류
- Rule: CONVENTIONS.md — 주석 처리된 코드는 사용하지 않는 dead code와 동일하게 취급; 의사결정 내용은 커밋 메시지 또는 GitHub Issue로 이전
- Context: `callGeminiWithRetry` 내 TODO 주석과 6줄 주석 코드 제거; 결정 사항은 PR 설명에 기록됨

## [PR #380 Round 2 | fix/350/thinking-budget-preservation-across-retries | 2026-04-25]
- Violation: `tsconfig.test.json`이 `tsconfig.json`의 `exclude: ["src/__tests__"]`를 상속받아 테스트 파일 포함 의도가 불명확
- Rule: CONVENTIONS.md — 설정 파일의 의도는 명시적으로 선언되어야 한다
- Context: `tsconfig.test.json`에 `exclude` 필드가 없어 상속된 exclusion이 적용됨; `exclude: ["node_modules", "dist"]`를 명시적으로 오버라이드하여 테스트 파일 포함 의도를 문서화

- Violation: `// unreachable: 루프는 반드시 return 또는 throw로 종료됨` 주석이 코드가 하는 일(WHAT)을 설명
- Rule: CLAUDE.md — "Don't explain WHAT the code does"
- Context: `callGeminiReducingBudget` 마지막 `throw` 앞의 주석이 코드 동작을 단순 재서술; 주석 제거

## [PR #380 | fix/350/thinking-budget-preservation-across-retries | 2026-04-25]
- Violation: `as` 타입 단언 보증 주석 누락 — 캐스트 이유가 독자에게 불투명
- Rule: MISTAKES.md TypeScript #7 — every safe-cast `as` must have a comment explaining the guarantee
- Context: `isMaxTokensError`의 `(error as { code: unknown })` 및 테스트 파일의 2개 `as` 캐스트에 보증 주석 추가

## [PR #379 Round 2 | fix/349/briefing-retry-delay-paid-key-fallback | 2026-04-25]
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
