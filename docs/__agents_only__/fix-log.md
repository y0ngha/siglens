# Fix Log

## [Issue #372-377 | feat/372-377/siglens-core-migration | 2026-04-26]
- Violation: Two/multiple separate import statements from the same module '@y0ngha/siglens-core' (useAnalysisDerivedData.ts: 2 statements, useCandlePatternMarkers.ts: 5 statements)
- Rule: MISTAKES.md Components #0 (import/no-duplicates)
- Context: Bulk import-path replacement script split each original local-path import into its own statement, leaving multiple back-to-back imports from the same target module that should have been merged.

- Violation: New infrastructure Server Action wrapper files (9 files) created without corresponding unit tests
- Rule: MISTAKES.md Domain Functions #22 / Test Layer Rules (100% coverage for infrastructure)
- Context: Wrappers are thin async pass-throughs that delegate one call into siglens-core; the deleted originals had tests, so equivalent forwarding tests should accompany the new wrappers for consistency with getBarsAction.test.ts.

## [PR #384 | feat/372-377/siglens-core-migration | 2026-04-27]
- Violation: infrastructure try-catch 없이 Redis 연동 핵심 함수 호출
- Rule: MISTAKES.md Domain Functions #2 (Silent fallback without exposing degradation)
- Context: `tryAcquireReanalyzeCooldown` wrapper에서 Redis 장애 시 예외가 상위로 전파되어 서비스 중단 가능. graceful degradation으로 `{ ok: true }` 반환.

- Violation: `getMarketSummaryAction.test.ts` fixture에서 `as unknown as` 이중 캐스트 사용
- Rule: MISTAKES.md TypeScript #7 (as 타입 단언 대신 타입 가드 사용)
- Context: 테스트 fixture가 실제 `MarketSummaryWithBriefing` 구조와 다른 형태(`{ indices, sectors }`)로 정의되어 있었음. 올바른 `{ summary: { indices, sectors }, briefing }` 구조로 수정.

## [PR #384 Round 2 | feat/372-377/siglens-core-migration | 2026-04-27]
- Violation: WHY 주석 삭제 — EMA index 매핑 및 SQUEEZE_MOMENTUM_MIN_BARS 알고리즘 유도 주석 제거
- Rule: CLAUDE.md 코멘트 규칙 ("WHY is non-obvious" 주석은 유지)
- Context: 마이그레이션 과정에서 비자명 인덱스 매핑 주석(20-period EMA, 60-period EMA)과 알고리즘 유도 주석(2*kcLength-1 이유)이 삭제됨. 독자가 EMA_DEFAULT_PERIODS를 열어봐야만 확인 가능한 숨겨진 매핑이므로 반드시 유지해야 함.

- Violation: 외부 패키지로 이전된 domain 함수들을 컴포넌트/앱이 직접 import
- Rule: ARCHITECTURE.md 레이어 의존 방향 — components ← domain, lib만 허용; app ← infrastructure, domain, lib만 허용
- Context: siglens-core 마이그레이션 과정에서 domain/analysis/ 파일들이 삭제되고 컴포넌트 훅들이 siglens-core를 직접 참조하게 됨. 마이그레이션 시 삭제된 domain 파일은 반드시 로컬 구현 또는 래퍼로 복원해야 함.

## [Round 1 — Skipped findings]
- `src/app/[symbol]/page.tsx:144` and `src/app/market/page.tsx:13` (recommended): RSC에서 siglens-core 함수를 직접 호출하는 패턴은 기존 관례이며 이번 PR이 도입한 변경이 아님. RSC는 underlying async 함수를 직접 호출하고, 클라이언트용 Server Action wrapper는 별도 hook 경로로 사용하는 분리 패턴이 의도됨. PR 범위 밖이므로 skip.
