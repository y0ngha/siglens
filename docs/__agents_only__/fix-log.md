# Fix Log

## [PR #384 round 3 | feat/372-377/siglens-core-migration | 2026-04-27]
- Violation: 동일 모듈(`@y0ngha/siglens-core`)에서 중복 import 구문 (useAnalysisDerivedData.ts)
- Rule: MISTAKES.md Components #0 — ESLint `import/no-duplicates` 규칙: 같은 모듈에서 단일 import 구문으로 통합
- Context: `import type`과 `import` 두 개의 별도 구문으로 분리되어 있었음. inline `type` 한정자를 사용해 단일 구문으로 병합.

## [PR #384 round 2 | feat/372-377/siglens-core-migration | 2026-04-27]
- Violation: `MarketSummaryActionResult` 인터페이스 dead code 잔존 (domain/types.ts)
- Rule: MISTAKES.md Coding Paradigm #4 — 효과 없는 코드 제거
- Context: `getMarketSummaryAction` 반환 타입이 `MarketSummaryWithBriefing`으로 변경되었으나 `MarketSummaryActionResult`가 미삭제 상태로 남아 중복 타입 혼란 유발.

- Violation: domain/types.ts 2줄 주석 블록
- Rule: CONVENTIONS.md — 다중 줄 주석 블록 금지, 한 줄로 압축
- Context: 파일 최상단 설명 주석이 2줄로 작성됨.

## [PR #384 | feat/372-377/siglens-core-migration | 2026-04-27]
- Violation: fire-and-forget Server Action에 try-catch 없음 (cancelAnalysisJobAction.ts)
- Rule: MISTAKES.md Fire-and-Forget #2 (fire-and-forget Server Action은 에러를 삼켜야 함)
- Context: 호출측 useAnalysis.ts에서 `void cancelAnalysisJobAction(jobId)`로 호출하므로 fire-and-forget 패턴인데, 에러를 그대로 전파하여 unhandled Promise rejection 발생 가능.

- Violation: @vercel/functions를 import하는 infrastructure 파일 테스트에서 jest.mock('@vercel/functions') 누락 (5개 파일)
- Rule: MISTAKES.md Tests #11 (외부 패키지를 infrastructure 파일에 추가할 때 모든 대응 테스트 파일에 mock 추가)
- Context: submitAnalysisAction, pollAnalysisAction, pollBriefingAction, submitBriefingAction, searchTickerAction 테스트 파일이 @vercel/functions mock 없이 작성됨.

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
