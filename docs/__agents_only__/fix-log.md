# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [Issue #130 | refactor/130/server-action-migration | 2026-04-05]
- Violation: infrastructure layer imported from app layer (`barsApi.ts` imported `getBarsAction`, `analysisApi.ts` imported `analyzeAction`)
- Rule: ARCHITECTURE.md — dependency direction is strictly app → infrastructure, never infrastructure → app
- Context: Server Actions were placed in `app/actions/` and infrastructure files delegated to them, inverting the allowed dependency direction; fixed by moving Server Action logic directly into the infrastructure files with `'use server'` directive and deleting the `app/actions/` files

## [Issue #130 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: Domain functions `buildAnalysisPrompt` and `enrichAnalysisWithConfidence` were mocked with `jest.mock()` in an infrastructure test
- Rule: `src/__tests__/CLAUDE.md` — "Never mock domain functions — test them directly with real inputs"
- Context: `analysisApi.test.ts` mocked the domain analysis functions to control test output; since domain functions are pure with no side effects, they must be called with real inputs and only external dependencies (AI API, file I/O) should be mocked

## [Issue #130 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `useState` declared before `useSuspenseQuery` in `useBars.ts`, violating custom hook declaration order
- Rule: `src/components/CLAUDE.md` — "External hooks (useQuery, useSuspenseQuery, etc.) first, then useState"
- Context: `mountedAt` from `useState` was needed as `initialDataUpdatedAt` in `useSuspenseQuery`; resolved by lifting the mount timestamp to a module-level constant (`MODULE_LOAD_TIME = Date.now()`) which runs outside render and satisfies both the hook ordering rule and the ESLint react-hooks/purity rule