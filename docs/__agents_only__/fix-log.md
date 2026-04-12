# Fix Log

## [PR #292 Round 3 | feat/291/cloud-run-worker | 2026-04-13]
- Violation: domain 타입에 인프라 전용 필드(skillsDegraded) 포함
- Rule: ARCHITECTURE.md — domain 타입에 route/infra 전용 필드 정의 금지
- Context: SubmitAnalysisResult/PollAnalysisResult에서 skillsDegraded 제거, JobMeta로 이동

- Violation: setJobMeta가 환경변수 검증보다 먼저 실행 — 고아 Redis 레코드 발생 가능
- Rule: 환경변수 사전 검증은 함수 최상단에서 수행
- Context: submitAnalysisAction에서 WORKER_URL/WORKER_SECRET 검증을 함수 최상단으로 이동

- Violation: Skills 로딩 실패 시 skillsDegraded가 submitted 경로에서 전파되지 않음
- Rule: MISTAKES.md Domain Functions #2 — 저하 정보를 호출자에게 전파
- Context: submitAnalysisAction에서 skillsDegraded를 JobMeta에 저장, pollAnalysisAction에서 OR 연산으로 반영

## [PR #292 Round 2 | feat/291/cloud-run-worker | 2026-04-13]
- Violation: 훅 파일에서 `@/infrastructure/jobs/types` 타입 import — 아키텍처 위반
- Rule: ARCHITECTURE.md — 훅 파일(hooks/)에서 타입 import는 @/domain/types에서만 수행
- Context: `useAnalysis.ts`에서 `SubmitAnalysisResult`를 infrastructure에서 import; domain/types.ts로 이동

- Violation: Worker `/analyze` 엔드포인트에 인증 없음 — 무제한 AI API 호출 가능
- Rule: 보안 — 외부 노출 엔드포인트는 인증 필수
- Context: `--allow-unauthenticated`로 배포 + 인증 없는 POST 핸들러; `X-Worker-Secret` 헤더 검증 추가

- Violation: `parseJsonResponse` 호출에 try-catch 없음 — 비정상 JSON 시 처리되지 않은 에러
- Rule: MISTAKES.md Pure Function Contracts #2 — 외부 의존성은 일관된 실패 처리
- Context: `pollAnalysisAction.ts`에서 Worker가 비정상 응답 반환 시 에러 미처리; try-catch 추가

## [PR #292 | feat/291/cloud-run-worker | 2026-04-12]
- Violation: Worker에서 Promise.all로 result와 status를 동시 저장 — poller가 done 상태를 보고 result가 아직 없을 수 있는 레이스 컨디션
- Rule: 데이터 의존 관계가 있는 Redis 쓰기는 순차 실행
- Context: `worker/src/index.ts`에서 `Promise.all([set result, set status])` → `await set result; await set status`로 순차 실행

- Violation: 타임프레임 변경 시 analysisResult(useState)를 null로 초기화하지 않아 이전 결과가 남음
- Rule: 상태 일관성 — reset() 호출 시 관련 useState도 함께 초기화해야 함
- Context: `useAnalysis.ts`에서 reset()은 useMutation data만 초기화하고, 별도 useState인 analysisResult는 그대로 유지

- Violation: sleep 유틸리티 함수가 hooks/ 파일 내 직접 정의
- Rule: CONVENTIONS.md — 비훅 순수 유틸리티 함수는 utils/ 서브폴더에 분리
- Context: `useAnalysis.ts`에서 `sleep` 함수를 인라인 정의; `symbol-page/utils/sleep.ts`로 분리

## [PR #290 Round 5 | refactor/289/코드-정리-상수통합-복잡도개선-중복제거 | 2026-04-12]
- Violation: `parseJsonResponse`의 `JSON.parse(...) as T` 단언에 이유 주석 누락
- Rule: MISTAKES.md TypeScript #8 — `as` 단언 사용 시 이유를 주석으로 명시
- Context: `src/infrastructure/ai/utils.ts`에서 `JSON.parse`가 `any`를 반환하여 불가피한 단언임을 주석 없이 사용

- Violation: `buildLastOpposingIndices`의 `.map()` 콜백 내 외부 `let` 변수 변이 — 비순수 콜백
- Rule: CONVENTIONS.md — map 콜백은 순수 변환이어야 함; 상태 스캔에는 generator 패턴 사용
- Context: `bull = i` 클로저 변이를 포함한 map 콜백, `scanLastIndex` generator로 교체

## [PR #290 | refactor/289/코드-정리-상수통합-복잡도개선-중복제거 | 2026-04-12]
- Violation: 테스트 파일의 한글 문자열에 깨진 UTF-8 바이트 포함
- Rule: CONVENTIONS.md — 테스트 설명 문구는 사람이 읽기 쉬운 한국어 텍스트여야 함
- Context: `src/__tests__/domain/constants/time.test.ts`의 describe/it 텍스트가 잘못된 인코딩으로 저장되어 의미 불명 문자 포함

- Violation: lib 레이어에서 domain 런타임 상수(`MS_PER_MINUTE`) import
- Rule: ARCHITECTURE.md — lib는 domain에서 타입만 import 가능, 런타임 상수 값은 금지
- Context: `src/lib/queryConfig.ts`에서 stale/gc 시간 상수로 사용하기 위해 domain 상수를 import

- Violation: domain 레이어(`smc.ts`)에서 직접 배열 인덱스 할당 (`lastBullish[i] = bull`)
- Rule: MISTAKES.md Coding Paradigm #5 + CONVENTIONS.md domain 불변성 — 배열 직접 인덱스 할당 금지
- Context: `buildLastOpposingIndices`에서 루프 안 직접 인덱스 할당 사용, `map`으로 교체

- Violation: `findMatchingLevels` 파라미터 타입에 인라인 유니온 리터럴 (`'high' | 'low'`) 사용
- Rule: MISTAKES.md TypeScript #5 — 2개 이상 멤버 유니온은 named type alias로 추출
- Context: `SMCEqualLevel.type`에 이미 `SMCSwingPointType`이 정의되어 있으나 파라미터에서 인라인 유니온 사용

## [PR #288 | feat/287/update-popular-tickers-script | 2026-04-12]
- Violation: `npx prettier` 사용 — `yarn` 대신 `npx` 사용
- Rule: CLAUDE.md — 패키지 실행 시 항상 yarn 사용, npm/npx 금지
- Context: 스크립트 마지막 포매팅 단계에서 `execSync('npx prettier...')` 사용

## [PR #286 Round 5 | feat/284/카테고리별-종목-섹션-추가 | 2026-04-12]
- Violation: HowTo JSON-LD 구조화 데이터가 Suspense boundary 안에서 deferred — 초기 HTML에 미포함
- Rule: SEO Best Practice — 구조화 데이터(JSON-LD)는 초기 HTML에 포함되어야 크롤러 호환성 보장
- Context: B1 아키텍처 수정 시 모든 데이터 fetch를 Suspense로 분리했으나, countSkillFiles()는 fs I/O(~1ms)로 blocking 영향 미미. HowTo JSON-LD와 HowItWorks를 동기 렌더링으로 전환하여 초기 HTML에 포함시킴.

## [PR #286 Round 4 | feat/284/카테고리별-종목-섹션-추가 | 2026-04-12]
- Violation: `app/page.tsx`에서 `countSkillFiles()`와 `loadSkills()` blocking await로 페이지 전체 렌더링을 지연
- Rule: Next.js Suspense 패턴 — 느린 데이터 fetch는 async 서버 컴포넌트 + Suspense fallback으로 스트리밍 처리
- Context: B1 아키텍처 수정 시 Suspense를 제거하고 Promise.all로 동기 fetch하도록 변경했으나, 원래 의도는 스켈레톤 로딩. `cache()`로 중복 호출 제거하고 `AsyncStatsBar`, `SkillsShowcaseServer`, `HowItWorksServer`, `HowToJsonLdServer` 인라인 async 컴포넌트로 분리하여 Suspense 복원.

## [PR #286 Round 3 | feat/284/카테고리별-종목-섹션-추가 | 2026-04-12]
- Violation: `prompt.ts` `classifyPriceZone` 함수의 설계 의도가 코드에 주석 없이 노출 — premium 존 상단 경계(high) 미검사가 의도적임에도 불명확
- Rule: CONVENTIONS.md — 도메인 로직의 비직관적 결정은 주석으로 명시
- Context: SMC 이론상 premium zone 위도 premium territory(과매수 구간)이므로 price >= premium.low만 체크하는 것이 정확한 설계. 주석 추가로 명시.

## [PR #280 | refactor/279/ai-prompt-consistency | 2026-04-12]
- Violation: `infrastructure/ai/claude.ts`에서 IIFE 파서를 `parseNumberEnv` 헬퍼로 교체할 때 기존 `parsed > 0` 양수 검증 가드가 누락 — `CLAUDE_MAX_TOKENS=0` 또는 음수 환경변수 설정 시 API 호출 실패
- Rule: MISTAKES.md Pure Function Contracts #1 — "Utility functions must guard all valid input ranges explicitly"
- Context: 기존 IIFE의 `&& parsed > 0` 조건을 `parseNumberEnv`가 대체했으나, 헬퍼 함수는 0도 유효값으로 통과시키므로 호출부에서 별도로 `> 0` 가드를 추가해야 했음

## [PR #278 Round 2 | feat/squeeze-momentum-indicator | 2026-04-12]
- Violation: `utils.ts`에서 `const window = values.slice(-period)` — 브라우저 전역 `window` 객체 섀도잉
- Rule: CONVENTIONS.md ESLint no-shadow — `window`, `document`, `location` 등 전역 이름 사용 금지
- Context: `stdDev`와 `linreg` 두 함수 모두 지역 변수명으로 `window`를 사용; `vals`로 변경

## [PR #278 | feat/squeeze-momentum-indicator | 2026-04-12]
- Violation: 루프마다 전체 배열 슬라이싱(O(n²)) — sma/stdDev는 내부에서 slice(-period)를 수행하므로 전체 배열 전달 불필요
- Rule: CONVENTIONS.md Performance — 불필요한 배열 복사를 피하고 필요한 윈도우만 전달
- Context: closes.slice(0, i+1) 전달 대신 closes.slice(Math.max(0, i-maxPeriod+1), i+1)로 좁혀 O(n²) → O(n) 개선

## [PR #272 Round 2 | refactor/271/skill-counts-build-time-derivation | 2026-04-11]
- Violation: `indicatorCount` prop이 `SymbolPageClient` → `ChartContent` → `AnalysisPanel`로 드릴링됨 (두 중간 컴포넌트 모두 미사용)
- Rule: FF Coupling 4-D — 중간 컴포넌트가 직접 사용하지 않는 prop을 아래로 전달하는 것은 Props Drilling 위반
- Context: `AnalysisPanel`만 `indicatorCount`를 실제로 사용; `SymbolPageContext` (Provider/hook) 패턴으로 해결

- Violation: `countSkillFiles`에 캐싱 없음 — 페이지 요청마다 skills/ 디렉토리를 다시 스캔
- Rule: App CLAUDE.md — "infrastructure 함수에는 `'use cache'` 디렉티브로 명시적 캐싱 적용"
- Context: `'use cache'` 디렉티브 적용; `cacheComponents: true` 활성화 필요

## [PR #272 | refactor/271/skill-counts-build-time-derivation | 2026-04-11]
- Violation: `countMdFiles`가 `readdir`를 1레벨만 호출하여 비재귀적으로 구현됨
- Rule: 일관성 원칙 — 동일 모듈 내 `collectMdFiles`(재귀 탐색)와 구현 방식이 달라 향후 서브디렉토리 추가 시 카운트 불일치 발생 가능
- Context: `countSkillFiles` 추가 시 `collectMdFiles` 재활용 없이 단순 `readdir` 사용; `collectMdFiles`를 재활용하도록 수정

## [PR #270 | feat/261/차트-dynamic-import-모바일-TTI-개선 | 2026-04-11]
- Violation: dynamic import loading 컴포넌트(`ChartSkeleton`)가 `absolute inset-0`을 사용함에도 래퍼 컨테이너에 `relative` 클래스 누락
- Rule: CSS Positioning — `absolute` 자식이 올바른 영역에 렌더되려면 부모 체인에 `positioned element`(`relative/absolute/fixed/sticky`)가 있어야 함
- Context: StockChart 컨테이너(`<div className="relative flex-3">`)는 기존에 `relative`가 있었으나, VolumeChart 컨테이너는 정적 import에서 로딩 상태가 없어 `relative`가 없었음; dynamic import 전환으로 loading prop이 생기면서 문제가 드러남

## [PR #267 Round 2 | feat/256/privacy-terms-pages | 2026-04-11]
- Violation: `Footer.tsx`의 `<div role="note">`에 accessible name(`aria-label`) 누락
- Rule: WAI-ARIA — role="note" 요소에 aria-label로 accessible name을 제공해야 함
- Context: privacy/page.tsx와 terms/page.tsx의 동일 요소에는 aria-label이 있으나 Footer.tsx에만 누락됨

## [PR #222 | feat/221/심볼-페이지-회사명-표시 | 2026-04-10]
- Violation: 서버 prefetchQuery 키와 클라이언트 훅 키 불일치 (hydration 캐시 미스)
- Rule: React Query Hydration 패턴 — prefetchQuery 키와 useQuery 키가 정확히 일치해야 함
- Context: 서버는 ticker(대문자)로 키를 만들고 클라이언트는 symbol(원본)로 키를 만들어 소문자 URL 진입 시 캐시 미스 발생

## [PR #220 | feat/219/action-recommendation | 2026-04-10]
- Violation: RESPONSE_LANGUAGE_INSTRUCTION의 "Other text fields" 목록에 새 필드(positionAnalysis, entry, exit, riskReward) 누락
- Rule: Prompt 일관성 — 한국어 작성 지시와 줄바꿈 지시 목록이 동기화되어야 함
- Context: actionRecommendation 필드 추가 시 첫 번째 필드 목록에만 추가하고 두 번째 목록은 누락

## [PR #216 Round 3 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: 컴포넌트 교체 후 구 구현체 파일(`SymbolSearch.tsx`)이 삭제되지 않고 고아 파일로 남음
- Rule: 코드베이스에 import되지 않는 파일은 데드 코드 — PR에서 교체 시 구 파일 삭제 필수
- Context: `SymbolSearch`가 `TickerAutocomplete`로 교체됐지만 `src/components/search/SymbolSearch.tsx`가 미삭제 상태로 남아 있었음

## [PR #266 | feat/260-259-258-257-255-254-252-250/seo-accessibility | 2026-04-11]
- Violation: app/ 레이어 async 함수에 명시적 반환 타입 누락
- Rule: CONVENTIONS.md — "Return types must be explicitly declared on domain functions"; app/ 레이어에도 일관성 있게 적용
- Context: `opengraph-image.tsx`의 `Image()` 함수에 `Promise<ImageResponse>` 반환 타입 누락; ImageResponse import 없이 반환 타입 추론에 의존

## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file

## [fix/bars-null-and-ssr-window-error (FMP API spec fix) | 2026-04-06]
- Violation: `console.log(url)` left in `fmp.ts` `getBars()` — debug artifact shipped to infrastructure
- Rule: CONVENTIONS.md — infrastructure functions must be pure side-effect-free except for the single external I/O they are responsible for; debug logging is a prohibited side effect
- Context: `fmp.ts` line 85 had `console.log(url)` after constructing the request URL; removed as part of FMP API spec correction

## [PR #229 Round 1 | feat/229/action-recommendation-chart-overlay | 2026-04-10]
- Violation: ActionRecommendationField.key typed as keyof ActionRecommendation included numeric optional fields, causing rec[key] to fail JSX child type validation
- Rule: TypeScript Union Type Safety — string literal unions must be narrowed when accessing object properties that will be used in JSX contexts
- Context: ActionRecommendationField.key was `keyof ActionRecommendation` which included `count?: number` and `updatedAt?: number`; narrowed to `ActionRecommendationTextKey = 'positionAnalysis' | 'entry' | 'exit' | 'riskReward'` to ensure values are text-like for JSX children

- Violation: chartRef (stable RefObject) included in useEffect dependency array for overlay hook
- Rule: MISTAKES.md Components #2 — stable RefObject references should not be in dependency arrays; only include deps that actually change
- Context: useCharacterOverlay hook included chartRef alongside dynamic deps like data; removed to match useChartSync pattern of excluding RefObjects

- Violation: Component props with leading underscore used in component body (e.g., _recommendedAction used as recommendedAction)
- Rule: CONVENTIONS.md Naming — underscore prefix reserved for intentionally-unused destructured parameters; consumed props must not have underscore
- Context: ActionRecommendationField received _recommendedAction but used it in render; removed underscore to indicate the prop is actually consumed

## [PR #229 Round 2 | feat/229/action-recommendation-chart-overlay | 2026-04-10]
- Violation: StockChart prop default actionPricesVisible = false contradicted the parent ChartContent's intent (initialized to true). Default off-by-default is misleading when caller explicitly enables the feature.
- Rule: FF.md Readability 1-C — Design intent must be exposed in code; default values must align with component usage context or caller must explicitly pass the value
- Context: ChartContent initializes actionPricesVisible={true}, but StockChart defaulted to false when prop was optional, creating contradiction between declaration and runtime behavior. Fixed by changing StockChart default to true to expose the actual design intent.


