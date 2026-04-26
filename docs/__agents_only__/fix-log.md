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

## [Round 1 — Skipped findings]
- `src/app/[symbol]/page.tsx:144` and `src/app/market/page.tsx:13` (recommended): RSC에서 siglens-core 함수를 직접 호출하는 패턴은 기존 관례이며 이번 PR이 도입한 변경이 아님. RSC는 underlying async 함수를 직접 호출하고, 클라이언트용 Server Action wrapper는 별도 hook 경로로 사용하는 분리 패턴이 의도됨. PR 범위 밖이므로 skip.
