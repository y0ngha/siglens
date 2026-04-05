# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [PR #187 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `mockResult` spread `mockRawAnalysis` without overriding `skillResults`, causing `Omit<SkillResult, 'confidenceWeight' | 'id'>[]` to be assigned where `SkillResult[]` was required
- Rule: TypeScript strict typing — spread from `RawAnalysisResponse` does not satisfy `RunAnalysisResult` for fields with incompatible Omit types; explicit override is required
- Context: `analyzeAction.test.ts` constructed `mockResult: RunAnalysisResult` by spreading `mockRawAnalysis: RawAnalysisResponse`, but `skillResults` in `RawAnalysisResponse` uses `Omit<SkillResult, 'confidenceWeight' | 'id'>[]` while `RunAnalysisResult` (via `AnalysisResponse`) requires `SkillResult[]`

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

## [PR #187 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `LOOK_AHEAD_COUNT` + `trimmedBars` + `resolvedLimit` fallback in `barsApi.ts` are dead code after `hasMore` was removed
- Rule: MISTAKES.md 9.5 — logic with no practical effect adds noise and obscures intent
- Context: After Server Action migration removed `hasMore` from the response, the code requesting `limit + 1` bars and then slicing back to `limit` served no purpose; simplified to request `limit` directly

## [PR #187 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: Missing test for `indicators` undefined case in `analysisApi.test.ts`
- Rule: CONVENTIONS.md — 100% coverage required for infrastructure layer
- Context: Validation guard in `runAnalysis` checked `!indicators` but no test exercised that branch; added the missing `it` case

## [PR #187 Round 3 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `getBarsAction.ts` and `analyzeAction.ts` were added without corresponding test files
- Rule: CONVENTIONS.md — infrastructure/ coverage 100% required; MISTAKES.md Tests rule 1 — missing test file when creating a new infrastructure file
- Context: Both are thin wrapper Server Actions in `infrastructure/market/` that delegate to `fetchBarsWithIndicators` and `runAnalysis` respectively; test files added verifying delegation behavior and error propagation

## [PR #187 Round 3 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `[] as Skill[]` type assertion used where an explicit typed variable is clearer and safer
- Rule: MISTAKES.md TypeScript rule 2 — use type guards or explicit type declarations instead of `as` assertions
- Context: In `analysisApi.ts` skills loading error fallback, empty array was cast with `as Skill[]`; replaced with `const emptySkills: Skill[] = []` for explicit type annotation without assertion

## [PR #186 | fix/174/symbol-page-initial-loading-performance | 2026-04-05]
- Violation: 하드코딩된 `initialAnalysisFailed={true}`에 의도 주석 누락
- Rule: FF.md Readability 1-A — 역할이 다른 코드는 분리, 코드의 의도가 명확히 드러나야 함
- Context: SSR 단계에서 AI 분석을 의도적으로 생략하고 클라이언트에 위임하기 위해 `true`로 하드코딩했으나, 코드만으로는 의도를 파악하기 어려워 주석을 추가했다.

