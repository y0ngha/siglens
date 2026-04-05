# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [Issue #130 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: Domain functions `buildAnalysisPrompt` and `enrichAnalysisWithConfidence` were mocked with `jest.mock()` in an infrastructure test
- Rule: `src/__tests__/CLAUDE.md` — "Never mock domain functions — test them directly with real inputs"
- Context: `analysisApi.test.ts` mocked the domain analysis functions to control test output; since domain functions are pure with no side effects, they must be called with real inputs and only external dependencies (AI API, file I/O) should be mocked

## [PR #187 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `MODULE_LOAD_TIME` module-level constant used as `initialDataUpdatedAt` causing stale data in SPA navigation
- Rule: FF.md Predictability — data freshness must be computed per component mount, not frozen at module load time
- Context: In SPA symbol navigation, `useBars` shared a single module-load timestamp across all mounts, causing React Query to treat fresh server data as stale; fixed by replacing `MODULE_LOAD_TIME` with `useState(() => Date.now())` so each mount captures its own timestamp

## [PR #187 | refactor/130/server-action-migration | 2026-04-05]
- Violation: docs/ARCHITECTURE.md and docs/SIGLENS_API.md still referenced deleted Route Handlers after migration to Server Actions
- Rule: MISTAKES.md rule 12 — implementation changes must be accompanied by documentation updates
- Context: Data flow section in ARCHITECTURE.md still showed `/api/bars` and `/api/analyze` HTTP calls; SIGLENS_API.md still documented GET/POST Route Handler specs; both updated to reflect Server Action architecture

## [PR #186 | fix/174/symbol-page-initial-loading-performance | 2026-04-05]
- Violation: 하드코딩된 `initialAnalysisFailed={true}`에 의도 주석 누락
- Rule: FF.md Readability 1-A — 역할이 다른 코드는 분리, 코드의 의도가 명확히 드러나야 함
- Context: SSR 단계에서 AI 분석을 의도적으로 생략하고 클라이언트에 위임하기 위해 `true`로 하드코딩했으나, 코드만으로는 의도를 파악하기 어려워 주석을 추가했다.

