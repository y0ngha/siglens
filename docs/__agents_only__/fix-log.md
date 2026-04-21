# Fix Log


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

## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file

## [PR #313 | feat/312/타임프레임-변경-시-분석-작업-취소 | 2026-04-15]
- Violation: findIndexMatch 반환 타입을 `ReturnType<typeof filterIndexResults>[number] | undefined`로 표현
- Rule: TypeScript — 재사용 가능하거나 의미를 전달해야 하는 반환 타입은 구조적 유틸리티 타입 대신 명시적 named type으로 표현
- Context: `filterIndexResults`가 `FmpSearchResult[]`를 반환하므로 해당 표현식은 `FmpSearchResult | undefined`와 동일; 명시적 타입 사용이 더 가독성 높음

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
- Violation: `SkillsShowcase.tsx`, `AnalysisPanel.tsx`(6개 버튼), `IndicatorToolbar.tsx` DropdownPortal 버튼에 `focus-visible:ring` 클래스 누락
- Rule: MISTAKES.md Accessibility #4 — all interactive buttons must have focus-visible:ring-1 ring-primary-500
- Context: 각 버튼 className에 `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500` 추가

- Violation: `StatsBarSkeleton`의 `style={{ width: ${w}px }}` 인라인 스타일
- Rule: CONVENTIONS.md — prefer CSS custom property pattern over arbitrary inline styles
- Context: `w-[var(--stat-w)]` + `style={{ '--stat-w': '${w}px' } as CSSProperties}`로 변경

- Violation: `ConfidenceBadge`의 `div[role="tooltip"]`에 `id` 없음, `<button>`에 `aria-describedby` 없음
- Rule: MISTAKES.md Accessibility #3 — tooltip requires aria-describedby connection to trigger element
- Context: `useId()` 추가로 스크린 리더가 툴팁과 버튼을 연결할 수 있도록 수정

## [PR #344 round-2 | refactor/343/라우팅-계층-중복-제거-ui-로직-분리 | 2026-04-21]
- Violation: `SymbolLayoutClient.tsx` 인라인 prop 타입 사용
- Rule: CONVENTIONS.md — Props interface declared directly above component function
- Context: single-prop 컴포넌트라도 named interface 선언 필요

## [PR #344 Round 6 | refactor/343/라우팅-계층-중복-제거-ui-로직-분리 | 2026-04-21]
- Violation: `MarketSummaryPanel.tsx` — 조건부 Tailwind className에 템플릿 리터럴 사용
- Rule: CONVENTIONS.md — 조건부 Tailwind 클래스는 반드시 `cn()`을 사용해야 함
- Context: `` className={`grid gap-2 ${...}`} `` 패턴을 `className={cn('grid gap-2', ...)}` 로 변경

## [PR #344 Round 5 | refactor/343/라우팅-계층-중복-제거-ui-로직-분리 | 2026-04-21]
- Violation: `src/__tests__/domain/skills.test.ts` — `buildSkillStats` 함수에 테스트 미존재
- Rule: MISTAKES.md Domain Functions #22 — Domain functions require 100% branch coverage with dedicated unit tests
- Context: empty array, all types present, missing type fallback, return structure validation을 포함한 4개 describe/it 블록 추가

- Violation: `src/components/analysis/AnalysisPanel.tsx` — `EyeIcon`에 대한 오도하는 TODO 주석 "unused, skip cleanup"
- Rule: Documentation Sync — Comments must reflect current implementation reality, not outdated preservation intent
- Context: EyeIcon이 실제로는 다른 곳에서 사용되고 있으므로 거짓 TODO 주석 삭제

- Violation: S-5 시도 (useEffect deps에서 RefObjects 제거) — ESLint `react-hooks/exhaustive-deps` 경고 발생
- Rule: MISTAKES.md Coding Paradigm #13 — eslint-disable 사용 금지; 근본 원인(클로저/ref 캡처) 구조 변경 필수
- Context: MISTAKES.md #13 규칙에 따라 변경 되돌림 (eslint-disable 금지, refs 제거 시 exhaustive-deps 경고 해결 불가)

