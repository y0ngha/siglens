# Fix Log

## [PR #294 | feat/key-levels-clustering | 2026-04-13]
- Violation: 가격 반올림 `100`이 매직 넘버로 사용됨
- Rule: Domain Layer Checklist — No hardcoded literals → extract to constants
- Context: `keyLevels.ts`에서 `Math.round(rawPrice * 100) / 100` → `PRICE_DECIMAL_FACTOR` 상수로 추출

- Violation: `role="tooltip"` 요소에 `aria-describedby` 연결 누락
- Rule: WAI-ARIA — tooltip 패턴은 트리거에 `aria-describedby`로 연결해야 스크린 리더 접근 가능
- Context: `InfoTooltip`에 `useId()`로 고유 ID 생성, 트리거 button에 `aria-describedby` 추가

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

## [PR #286 Round 5 | feat/284/카테고리별-종목-섹션-추가 | 2026-04-12]
- Violation: HowTo JSON-LD 구조화 데이터가 Suspense boundary 안에서 deferred — 초기 HTML에 미포함
- Rule: SEO Best Practice — 구조화 데이터(JSON-LD)는 초기 HTML에 포함되어야 크롤러 호환성 보장
- Context: B1 아키텍처 수정 시 모든 데이터 fetch를 Suspense로 분리했으나, countSkillFiles()는 fs I/O(~1ms)로 blocking 영향 미미. HowTo JSON-LD와 HowItWorks를 동기 렌더링으로 전환하여 초기 HTML에 포함시킴.

## [PR #286 Round 4 | feat/284/카테고리별-종목-섹션-추가 | 2026-04-12]
- Violation: `app/page.tsx`에서 `countSkillFiles()`와 `loadSkills()` blocking await로 페이지 전체 렌더링을 지연
- Rule: Next.js Suspense 패턴 — 느린 데이터 fetch는 async 서버 컴포넌트 + Suspense fallback으로 스트리밍 처리
- Context: B1 아키텍처 수정 시 Suspense를 제거하고 Promise.all로 동기 fetch하도록 변경했으나, 원래 의도는 스켈레톤 로딩. `cache()`로 중복 호출 제거하고 `AsyncStatsBar`, `SkillsShowcaseServer`, `HowItWorksServer`, `HowToJsonLdServer` 인라인 async 컴포넌트로 분리하여 Suspense 복원.

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


