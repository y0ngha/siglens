# Fix Log

## [PR #315 Round 3 | feat/314/애드센스-배너-광고-구현 | 2026-04-16]
- Violation: layout.tsx에서 `<Script strategy="lazyOnload">`를 `<head>` 내부에 배치
- Rule: Next.js Best Practices — `next/script`는 `<body>` 영역에 배치해야 함; `lazyOnload`는 브라우저 유휴 시점 실행이므로 `<head>` 배치가 의미상 부적절
- Context: AdSense `<Script>`가 `<head>` 블록 안에 있었음; `<body>` 끝으로 이동

## [PR #315 Round 2 | feat/314/애드센스-배너-광고-구현 | 2026-04-16]
- Violation: `isPushed`를 `useState`로 관리하여 push 완료 시 불필요한 리렌더 + effect 재실행 사이클 발생
- Rule: Components — JSX 렌더 출력에 영향을 주지 않는 내부 플래그는 `useRef`로 관리해야 함
- Context: `setIsPushed(true)` 호출 → 리렌더 → effect 재실행 → 즉시 guard return 무의미한 사이클; `useRef`로 전환해 렌더 없이 플래그 관리

- Violation: `shouldShowAd()` 비즈니스 로직 함수가 `lib/`에 배치됨 — lib/CLAUDE.md 범위(유틸리티 래퍼, 설정 상수, 차트 색상) 초과
- Rule: Design & Cohesion — lib/은 순수 유틸리티/설정 상수만; 비즈니스 판단 로직은 사용처에 인라인하거나 domain/으로 이동
- Context: `shouldShowAd`는 AdBanner.tsx 단독 사용이므로 컴포넌트 내 인라인으로 해결; lib/adsense.ts에서 함수 제거

## [PR #315 | feat/314/애드센스-배너-광고-구현 | 2026-04-16]
- Violation: layout.tsx에 `overflow: hidden !important`를 html/body에 전역 적용하여 페이지 스크롤 차단
- Rule: UX & Rendering — 전역 CSS 강제 주입으로 앱 전체 사용성 저해 금지
- Context: AdSense 레이아웃 깨짐을 방지하려는 의도였으나 `overflow: hidden`이 모든 페이지의 스크롤을 차단; `<style dangerouslySetInnerHTML>` 블록 전체 제거

- Violation: AdBanner.tsx 안내 메시지 `<p>`에 `whitespace-nowrap` 적용으로 모바일에서 텍스트 오버플로우 위험
- Rule: Design — 동적 텍스트 콘텐츠에 `whitespace-nowrap` 사용 금지; 자연스러운 줄바꿈 허용
- Context: 긴 한국어 안내 메시지가 작은 화면에서 컨테이너를 넘어 레이아웃 깨짐 유발 가능; 클래스 제거

## [Issue #314 | feat/314/애드센스-배너-광고-구현 | 2026-04-15]
- Violation: AdBanner.tsx의 `<ins>` 엘리먼트에 `style={{ display: 'block' }}` 인라인 스타일 사용
- Rule: CONVENTIONS.md — No inline styles → Tailwind only; `block` 클래스를 사용해야 함
- Context: AdSense `<ins>` 태그에 `display: block`을 적용하기 위해 인라인 스타일을 사용했으나, Tailwind의 `block` 클래스로 대체 가능

## [PR #304 Round 2 | feat/296/캐시-만료-KST-17시-자동-초기화 | 2026-04-14]
- Violation: `computeSecondsUntilKst17`에서 `0 < diffMs < 1000ms` 경계(서브초 구간)에서 `Math.max(1, 0) = 1` 반환 경로에 대한 테스트 누락
- Rule: Infrastructure Layer Checklist — 100% branch coverage for infrastructure (all ?., ??, if/else paths)
- Context: `Math.max(1, Math.floor(diffMs / MS_PER_SECOND))`의 `Math.max`가 0을 1로 올리는 경로가 테스트되지 않았음; `diffMs = 500ms`인 케이스 추가로 해결

## [PR #304 | feat/296/캐시-만료-KST-17시-자동-초기화 | 2026-04-14]
- Violation: `computeEffectiveTtl`이 `new Date()`에 의존함에도 `analyzeAction.test.ts`, `pollAnalysisAction.test.ts`에서 mock 없이 하드코딩 TTL 단언 — 시간대에 따라 flaky 테스트 발생
- Rule: Test Layer Rules — 외부/시간 의존 함수는 테스트에서 반드시 mock해야 함
- Context: `analyzeAction`, `pollAnalysisAction`이 `computeEffectiveTtl(timeframe, new Date())`를 호출하도록 변경됐으나, 기존 테스트는 TTL을 86400/300/3600으로 하드코딩 단언; `jest.mock('@/infrastructure/cache/config', ...)` 추가하여 해결

## [PR #300 | fix/299/mobile-bottom-sheet-native-ux | 2026-04-14]
- Violation: `useEffect` cleanup에서 직접 조작한 DOM 스타일(`transform`, `transition`) 미초기화
- Rule: React useEffect cleanup 원칙 — effect에서 직접 조작한 DOM 상태는 cleanup에서 원상복구해야 vaul 내부 스타일과 충돌 방지
- Context: `MobileAnalysisSheet.tsx` cleanup에서 `drawerEl.style.transform = ''`, `drawerEl.style.transition = ''` 추가

- Violation: null 가드 이전 변수 선언으로 `!` 단언 반복 사용
- Rule: TypeScript narrowing — null 가드 이후 변수를 선언하면 `!` 없이 타입 안전하게 사용 가능
- Context: `scrollEl`·`drawerEl` 선언이 `if (!contentRef.current || ...)` 가드보다 앞에 있어 `scrollEl!`, `drawerEl!` 반복; 가드 이후로 이동

- Violation: `isDragging === true` 진입 후 `deltaY <= 0`일 때 `e.preventDefault()` 미호출로 브라우저 기본 스크롤 발생 가능
- Rule: 터치 이벤트 UX — 드래그 제어 진입 후에는 모든 방향 이동에 대해 `preventDefault()`를 호출해야 함
- Context: `onTouchMove`에서 `deltaY <= 0` early return이 `isDragging` 체크보다 앞에 있어 드래그 중 위로 되돌릴 때 스크롤 허용; 구조 재정렬 + `Math.max(0, deltaY)` 적용

## [PR #294 | feat/key-levels-clustering | 2026-04-13]
- Violation: React key에 `source.price-source.reason` 조합 사용 — 동일 가격·사유 존재 시 중복 가능
- Rule: React — 리스트 렌더링 시 key 고유성 보장
- Context: `ConfluenceInfo`에서 key에 `index` 추가하여 고유성 확보

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

## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file

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

- Violation: computeFromDay 반환값이 YYYY-MM-DD 형식 — Alpaca API가 RFC3339 형식 요구
- Rule: Provider pair symmetric rule — Alpaca start 파라미터는 RFC3339 형식 필요
- Context: barsApi.ts의 computeFromDay가 substring(0, 10)만 반환; T00:00:00Z 추가로 RFC3339 호환성 확보 (FMP는 fromDate.substring(0,10)으로 처리하므로 영향 없음)

## [PR #313 | feat/312/타임프레임-변경-시-분석-작업-취소 | 2026-04-15]
- Violation: cancelAnalysisJobAction.ts의 fetch 호출에 타임아웃 미설정 — 네트워크 지연 시 Server Action이 무기한 대기 가능
- Rule: CONVENTIONS.md — fire-and-forget fetch 요청에는 타임아웃을 설정해 클라이언트 흐름이 블로킹되지 않도록 해야 함
- Context: `/cancel` 엔드포인트 호출에 AbortSignal.timeout(5000) 추가

- Violation: useAnalysis.ts — eslint-disable-next-line react-hooks/exhaustive-deps used to suppress deps warning
- Rule: CONVENTIONS.md react-hooks/exhaustive-deps — must restructure to fix the actual issue, not suppress the lint rule
- Context: Mutation deps warning caused by unstable callback; fixed by restructuring with isCountdownActive boolean and cooldownStartValueRef to break the closure chain

- Violation: cancelAnalysisJobAction.ts — Server Action passthrough with no error handling
- Rule: CONVENTIONS.md — fire-and-forget actions should swallow errors and log a warning instead of throwing to caller
- Context: Action called without try-catch; caller receives uncaught error; added try-catch to swallow and log, matching notification-action pattern




## [Issue #325 | feat/325/지수-심볼-지원 | 2026-04-17]
- Violation: Infrastructure 함수(FmpProvider.getBars)에 `console.log` 디버그 로그 잔류
- Rule: Infrastructure Layer Checklist — No console.log or debug artifacts
- Context: `fmp.ts`의 기존 `getBars` 메서드에 남아있던 타이밍 로그를 제거하지 않고 유지한 채 PR 제출

- Violation: findIndexMatch 반환 타입을 `ReturnType<typeof filterIndexResults>[number] | undefined`로 표현
- Rule: TypeScript — 재사용 가능하거나 의미를 전달해야 하는 반환 타입은 구조적 유틸리티 타입 대신 명시적 named type으로 표현
- Context: `filterIndexResults`가 `FmpSearchResult[]`를 반환하므로 해당 표현식은 `FmpSearchResult | undefined`와 동일; 명시적 타입 사용이 더 가독성 높음
