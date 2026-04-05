# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [Issue #130 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: Domain functions `buildAnalysisPrompt` and `enrichAnalysisWithConfidence` were mocked with `jest.mock()` in an infrastructure test
- Rule: `src/__tests__/CLAUDE.md` — "Never mock domain functions — test them directly with real inputs"
- Context: `analysisApi.test.ts` mocked the domain analysis functions to control test output; since domain functions are pure with no side effects, they must be called with real inputs and only external dependencies (AI API, file I/O) should be mocked

## [Issue #130 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `useState` declared before `useSuspenseQuery` in `useBars.ts`, violating custom hook declaration order
- Rule: `src/components/CLAUDE.md` — "External hooks (useQuery, useSuspenseQuery, etc.) first, then useState"
- Context: `mountedAt` from `useState` was needed as `initialDataUpdatedAt` in `useSuspenseQuery`; resolved by lifting the mount timestamp to a module-level constant (`MODULE_LOAD_TIME = Date.now()`) which runs outside render and satisfies both the hook ordering rule and the ESLint react-hooks/purity rule

## [PR #187 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `MODULE_LOAD_TIME` module-level constant used as `initialDataUpdatedAt` causing stale data in SPA navigation
- Rule: FF.md Predictability — data freshness must be computed per component mount, not frozen at module load time
- Context: In SPA symbol navigation, `useBars` shared a single module-load timestamp across all mounts, causing React Query to treat fresh server data as stale; fixed by replacing `MODULE_LOAD_TIME` with `useState(() => Date.now())` so each mount captures its own timestamp

## [PR #187 | refactor/130/server-action-migration | 2026-04-05]
- Violation: docs/ARCHITECTURE.md and docs/SIGLENS_API.md still referenced deleted Route Handlers after migration to Server Actions
- Rule: MISTAKES.md rule 12 — implementation changes must be accompanied by documentation updates
- Context: Data flow section in ARCHITECTURE.md still showed `/api/bars` and `/api/analyze` HTTP calls; SIGLENS_API.md still documented GET/POST Route Handler specs; both updated to reflect Server Action architecture