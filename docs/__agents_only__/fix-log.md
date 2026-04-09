# Fix Log

## [PR #222 | feat/221/심볼-페이지-회사명-표시 | 2026-04-10]
- Violation: components/hooks/ 파일에 'use client' 선언 누락
- Rule: CONVENTIONS.md — components/ 아래 커스텀 훅은 무조건 'use client' 선언
- Context: useAssetInfo.ts 작성 시 useTimeframeChange 등 기존 훅 파일에서 패턴을 확인하지 않아 누락

- Violation: 서버 prefetchQuery 키와 클라이언트 훅 키 불일치 (hydration 캐시 미스)
- Rule: React Query Hydration 패턴 — prefetchQuery 키와 useQuery 키가 정확히 일치해야 함
- Context: 서버는 ticker(대문자)로 키를 만들고 클라이언트는 symbol(원본)로 키를 만들어 소문자 URL 진입 시 캐시 미스 발생

## [Issue #221 | feat/221/심볼-페이지-회사명-표시 | 2026-04-10]
- Violation: 새 infrastructure Server Action 파일(getAssetInfoAction.ts) 구현 후 테스트 파일 누락
- Rule: 모든 infrastructure/ 파일은 대응하는 테스트 파일이 있어야 한다 (100% branch coverage target)
- Context: 동일 패턴의 searchTickerAction.test.ts가 존재함에도 getAssetInfoAction.test.ts 작성을 누락

## [PR #220 | feat/219/action-recommendation | 2026-04-10]
- Violation: RESPONSE_LANGUAGE_INSTRUCTION의 "Other text fields" 목록에 새 필드(positionAnalysis, entry, exit, riskReward) 누락
- Rule: Prompt 일관성 — 한국어 작성 지시와 줄바꿈 지시 목록이 동기화되어야 함
- Context: actionRecommendation 필드 추가 시 첫 번째 필드 목록에만 추가하고 두 번째 목록은 누락

- Violation: 모듈 레벨 상수에 인라인 익명 타입 사용
- Rule: 타입 명확성 — 재사용 가능한 타입은 명명 인터페이스로 분리
- Context: ACTION_RECOMMENDATION_FIELDS의 readonly { label: string; key: keyof ActionRecommendation }[]를 명명 인터페이스 ActionRecommendationField로 추출

## [PR #216 Round 11 | feat/196/ticker-autocomplete | 2026-04-10]
- Violation: `docs/ARCHITECTURE.md` 폴더 트리에 신규 `infrastructure/ticker/` 디렉터리 미반영
- Rule: MISTAKES.md TypeScript #11 — 구현 변경 시 문서 동기화 필수
- Context: PR #216에서 `src/infrastructure/ticker/`가 신규 추가됐으나 ARCHITECTURE.md 폴더 트리에 누락

- Violation: `inputClass`, `buttonClass`가 `size` prop 파생값임에도 useMemo 없이 매 렌더마다 재계산
- Rule: MISTAKES.md Components #11 — props/state에서 파생된 객체는 useMemo로 메모이제이션 필요
- Context: `TickerAutocomplete.tsx`의 두 className 상수가 `size`에만 의존하므로 `useMemo([size])`로 감쌈

## [PR #216 Round 7 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `{isOpen && ...}` 블록 내부에서 `hasQuery`가 항상 `true`임에도 `&& hasQuery` 조건 유지 (dead code)
- Rule: MISTAKES.md Coding Paradigm #4 — 결과를 변경하지 않는 조건(효과 없는 로직) 제거
- Context: `isOpen = !isClosed && hasQuery`이므로 해당 블록 진입 시 `hasQuery`는 항상 true; `&& hasQuery` 제거

## [PR #216 Round 6 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `size?: 'sm' | 'lg'` 인라인 유니온 리터럴 타입을 named type alias로 추출하지 않음
- Rule: CONVENTIONS.md — 2개 이상 리터럴 유니온은 type alias로 추출 필수
- Context: `TickerAutocomplete.tsx`의 Props 인터페이스에 `'sm' | 'lg'` 인라인 선언; `TickerAutocompleteSize` 타입으로 추출


## [PR #216 Round 3 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: 컴포넌트 교체 후 구 구현체 파일(`SymbolSearch.tsx`)이 삭제되지 않고 고아 파일로 남음
- Rule: 코드베이스에 import되지 않는 파일은 데드 코드 — PR에서 교체 시 구 파일 삭제 필수
- Context: `SymbolSearch`가 `TickerAutocomplete`로 교체됐지만 `src/components/search/SymbolSearch.tsx`가 미삭제 상태로 남아 있었음

- Violation: `cache.get()` 호출 시 예외 처리 누락으로 Redis 장애 시 액션 전체 실패
- Rule: CONVENTIONS.md Graceful Degradation — 외부 의존성 호출은 동일 파일 내 다른 패턴과 일관되게 try-catch로 감싸야 함
- Context: `searchTickerAction.ts`의 캐시 조회는 try-catch 없었으나, 동일 파일의 캐시 set과 `koreanNameStore.ts`의 `loadAllEntries()`는 모두 try-catch 처리됨

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file



## [Issue #172 버그픽스 | feat/172/메인-페이지-리디자인-브랜딩-변경 | 2026-04-06]
- Violation: `SymbolPageClient.tsx`에서 render 중 `setTimeframeChangeCount` + `setPrevTimeframe`을 호출하는 패턴이 React 19 concurrent mode에서 "Cannot update a component (Router) while rendering a different component (ChartContent)" 에러를 유발했음
- Rule: MISTAKES.md Components #5 — Side effects inside setState updater functions; 더 나아가 render 중 setState 자체가 React 19 concurrent mode + startTransition 조합에서 Next.js Router 업데이트 충돌을 일으킬 수 있음
- Context: `useTimeframeChange`의 `startTransition` 내부에서 Suspense가 트리거되는 동안 render-phase setState가 Router context 업데이트와 충돌했음; `timeframeChangeCount` 관리를 `handleTimeframeChange` 이벤트 핸들러 안으로 이동하여 해결

## [fix/bars-null-and-ssr-window-error | 2026-04-06]
- Violation: `panelWidthAtDragStartRef` was initialized by eagerly calling `getDefaultPanelWidth()` while `panelWidth` state used the lazy initializer form; the two initial values diverge if `getDefaultPanelWidth()` returns different results on successive calls
- Rule: CONVENTIONS.md Convention 2-B (Predictability) — useState lazy initializer and useRef initial value must share the same source of truth to prevent divergence
- Context: `usePanelResize.ts` called `getDefaultPanelWidth()` eagerly in `useRef` on line 34; fixed by initializing the ref to `0` since it is always overwritten in `handleDragStart` before being read in `onResize`

## [fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: `mutationFn` passed `AnalyzeMutationVariables` (which includes `force: boolean`) directly to `analyzeAction`, whose first parameter is typed as `AnalyzeVariables` (no `force` field), causing a TypeScript excess property error
- Rule: CONVENTIONS.md — UI-layer concerns must not bleed into infrastructure-layer types; Server Action parameters must match declared types exactly
- Context: `useAnalysis.ts` passed the full mutation variable object (including `force`) directly to `analyzeAction`; fixed by destructuring `{ force, ...analyzeVars }` and passing `analyzeVars` as the first argument

## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: `ChartContent.tsx`(`components/symbol-page/`)에서 `lightweight-charts`의 `IChartApi` 타입을 직접 import하여 `symbol-page` 레이어가 차트 라이브러리에 직접 커플링됨
- Rule: MISTAKES.md Layer Dependencies #3 — `lightweight-charts` import(타입 포함)는 `components/chart/` 내부로 제한됨
- Context: visible range 동기화를 위해 `stockChartRef`, `volumeChartRef`, 콜백 2개가 모두 `IChartApi`에 의존했음; `components/chart/hooks/useChartSync.ts`로 추출하여 `ChartContent.tsx`에서 `IChartApi` import 제거

## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: TODO 주석으로 명시적 보존이 지시된 `EyeIcon` 컴포넌트가 삭제됨; commented-out 버튼 코드에서 여전히 `EyeIcon`을 참조하고 있어 주석 해제 시 불일치 발생
- Rule: FF.md Predictability — TODO로 유지 의도가 명시된 코드를 삭제하면 향후 주석 해제 시 참조 오류가 발생하여 예측 가능성을 해침
- Context: `AnalysisPanel.tsx`에서 `EyeIcon` 컴포넌트가 제거되었으나 3곳의 commented-out 버튼에서 여전히 `<EyeIcon>`을 참조; 원본 코드를 복원하여 해결

## [PR #208 | feat/185/seo-최적화 | 2026-04-07]
- Violation: `POPULAR_TICKERS` (비즈니스 도메인 지식)가 `src/lib/seo.ts`에 정의되어 lib 레이어 허용 범위를 벗어남
- Rule: lib/CLAUDE.md — lib 레이어는 utility wrappers, React Query key factories, config constants, chart color constants만 허용; 도메인 비즈니스 상수는 금지
- Context: `POPULAR_TICKERS`는 `sitemap.ts`에서만 사용되는 상수로 lib이 아닌 사용처(sitemap.ts) 내부로 인라인 이동하여 해결

## [PR #208 | feat/185/seo-최적화 | 2026-04-07]
- Violation: JSON-LD `description`이 `generateMetadata`와 `jsonLd` 사이에서 불일치 — jsonLd는 짧은 버전, generateMetadata는 전체 문장 사용
- Rule: FF.md Cohesion — 동일한 도메인 정보(종목 설명)는 코드베이스 전반에서 일관되게 유지되어야 함
- Context: `[symbol]/page.tsx`에서 `generateMetadata`의 description과 `jsonLd.description`이 서로 다른 문자열을 사용했음; jsonLd를 generateMetadata와 동일한 전체 문장으로 통일하여 해결

## [PR #218 | feat/217/재분석-버튼-활성화 | 2026-04-09]
- Violation: `ChartContent.tsx`에서 `useEffect` 내 `if (isAnalyzing) setDisplayAnalyzing(true)` 직접 setState 호출이 cascading renders 경고(`react-hooks/set-state-in-effect`)를 유발함
- Rule: React 공식 권장 — prop 변화에 반응한 state 동기화는 `useEffect` 대신 렌더링 중 state 업데이트 패턴(`prevProp` state로 이전 값 추적)을 사용해야 함
- Context: `isAnalyzing`이 true로 변할 때 `displayAnalyzing`을 true로 동기화하기 위해 `useEffect`를 사용했으나, `prevIsAnalyzing` state를 추가하고 렌더링 중 비교하는 패턴으로 교체하여 해결

## [fix/bars-null-and-ssr-window-error (FMP API spec fix) | 2026-04-06]
- Violation: `console.log(url)` left in `fmp.ts` `getBars()` — debug artifact shipped to infrastructure
- Rule: CONVENTIONS.md — infrastructure functions must be pure side-effect-free except for the single external I/O they are responsible for; debug logging is a prohibited side effect
- Context: `fmp.ts` line 85 had `console.log(url)` after constructing the request URL; removed as part of FMP API spec correction

