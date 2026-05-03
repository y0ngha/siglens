# Fix Log


## [PR #405 Round 4 | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: deleteAccount.ts revokeOAuthTokens가 명령형 forEach + void Promise로 fire-and-forget 처리
- Rule: CONVENTIONS.md — 명령형 forEach 대신 선언형 map + Promise.allSettled 사용 (FP 일관성)
- Context: forEach 내부 .catch로 개별 에러 흡수 + 외부 void Promise.allSettled로 묶어 동일한 fire-and-forget + 에러 개별 처리 동작 유지. 테스트 무수정 통과(883/101).

## [PR #405 Round 2 | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: domain/types.ts가 @/infrastructure/db/types에서 AuthUserRecord 타입을 re-export (역방향 레이어 의존)
- Rule: ARCHITECTURE.md — domain은 infrastructure에 의존 금지 (단방향 infra → domain)
- Context: AuthUserRecord 정의를 src/domain/auth/types.ts로 이동(@y0ngha/siglens-core의 UserTier만 사용). domain/types.ts는 './auth/types'에서 re-export, infrastructure/db/types.ts는 @/domain/auth/types에서 import 후 re-export하는 방향으로 정정.

- Violation: tokenEncryption.ts 헤더 문구에 "sync obligation" 언급 (Phase 6 완료했으므로 불필요)
- Rule: Phase 6 마이그레이션 완료 후 더 이상 siglens-core와의 동기화 의무 없음 — 헤더를 과거시제로 갱신
- Context: tokenEncryption.ts의 "Sync obligation" 문구를 "Phase 6 of the scope-realignment refactor moved the DB layer fully into siglens"로 변경; 동기화 명령문 제거.

- Violation: userApiKeys 테이블의 JSDoc 멀티라인 주석
- Rule: CLAUDE.md — 단일 줄 주석으로 통일 (WHY 노트 보존)
- Context: userApiKeys의 JSDoc 블록을 한 줄로 압축하되 AES-256-GCM 암호화 특성 유지.

## [PR #405 | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: drizzle/0004_add_oauth_token_columns.sql가 _journal.json에 등재되지 않은 채 0006_striped_marauders.sql과 SQL이 완전 중복
- Rule: drizzle 마이그레이션은 _journal.json 등재 순서로 적용되며, 등재되지 않은 파일은 dead-code이자 drizzle-kit migrate 시 0006에서 컬럼 중복 오류 유발
- Context: orphan SQL 파일을 git rm으로 삭제. _journal.json은 변경 없음.

- Violation: drizzle/0004_petite_medusa.sql이 email_verified DEFAULT true로 추가되어 0005에서 false로 되돌리기 전 가입한 사용자들이 자동 검증 처리됨
- Rule: 운영 DB에 이미 적용된 마이그레이션은 사후 편집 금지 — 보정이 필요하면 새 forward migration 추가
- Context: 두 마이그레이션 모두 _journal에 등재되어 적용된 상태. 0004를 retroactive 수정하지 않고 0005에 사후 보존 사유와 향후 처리 가이드를 SQL 주석으로 명시.


## [PR #389 round 2 | feat/369/auth-email | 2026-04-28]
- Violation: Next.js error.tsx 컴포넌트 props 인터페이스에 `error: Error & { digest?: string }` 누락
- Rule: Next.js App Router 컨벤션 — error.tsx는 프레임워크가 `error`와 `reset` 두 prop을 모두 전달하므로 인터페이스에 양쪽 다 선언 필요
- Context: src/app/login/error.tsx가 reset만 prop으로 선언하고 error를 누락. 표시에 사용하지 않더라도 타입 안전성을 위해 선언 추가.


## [PR #384 Round 2 | feat/372-377/siglens-core-migration | 2026-04-27]
- Violation: WHY 주석 삭제 — EMA index 매핑 및 SQUEEZE_MOMENTUM_MIN_BARS 알고리즘 유도 주석 제거
- Rule: CLAUDE.md 코멘트 규칙 ("WHY is non-obvious" 주석은 유지)
- Context: 마이그레이션 과정에서 비자명 인덱스 매핑 주석(20-period EMA, 60-period EMA)과 알고리즘 유도 주석(2*kcLength-1 이유)이 삭제됨. 독자가 EMA_DEFAULT_PERIODS를 열어봐야만 확인 가능한 숨겨진 매핑이므로 반드시 유지해야 함.

## [Round 1 — Skipped findings]
- `src/app/[symbol]/page.tsx:144` and `src/app/market/page.tsx:13` (recommended): RSC에서 siglens-core 함수를 직접 호출하는 패턴은 기존 관례이며 이번 PR이 도입한 변경이 아님. RSC는 underlying async 함수를 직접 호출하고, 클라이언트용 Server Action wrapper는 별도 hook 경로로 사용하는 분리 패턴이 의도됨. PR 범위 밖이므로 skip.

## [PR #390 | feat/369/auth-social | 2026-04-28]
- Violation: OAuth 콜백에서 쿠키에 저장된 next 경로를 검증 없이 그대로 redirect로 사용
- Rule: Open Redirect 방어 — 사용자 변조 가능 입력은 사용 시점마다 sanitize (defense-in-depth)
- Context: state 쿠키는 HMAC 서명 없이 base64url JSON으로만 저장되므로 next 값이 변조 가능. /start에서 한 번 sanitize했더라도 콜백에서 redirect 직전에 sanitizeNextPath를 다시 적용해야 안전.

## [PR #390 | feat/369/auth-social | 2026-04-28]
- Violation: 외부 OAuth 토큰/유저 응답의 .json() 파싱 실패가 500 에러로 노출됨
- Rule: 시스템 경계(외부 API)의 예측 불가능한 응답은 try/catch로 감싸 결과 객체로 변환
- Context: tokenResponse.ok가 200이라도 본문이 JSON이 아닐 수 있어 await response.json()가 SyntaxError를 throw할 수 있음. google/kakao/apple 세 어댑터 모두에 동일 패턴 적용.


## [PR #395 Round 6 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: infrastructure Server Action에서 네트워크 응답 없이 무한 대기 가능
- Rule: MISTAKES.md Fire-and-Forget #1 — fetch 기반 외부 호출에는 반드시 타임아웃 설정
- Context: ResendEmailDispatcher.sendEmail이 AbortSignal 없이 Resend SDK를 호출해 네트워크 지연 시 Server Action이 무기한 블로킹. AbortSignal.timeout + Promise.race 패턴으로 10초 타임아웃 추가.

## [PR #395 Round 4 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: code 단계에서 동일한 codeState.error.message가 AuthErrorAlert와 AuthFieldGroup.error prop 두 곳에 동시 표시
- Rule: 동일 정보를 두 채널로 동시 노출하지 않음 — 하나의 에러는 하나의 UI 위치에서만 표시
- Context: SignupForm.tsx code phase에서 AuthErrorAlert와 AuthFieldGroup error prop에 모두 codeState.error.message를 전달하여 사용자에게 동일 에러가 중복 노출됨. AuthFieldGroup error prop 제거로 AuthErrorAlert 단일 표시로 통일.
## [PR #391 코멘트 반영 | feat/387/회원탈퇴-ui | 2026-04-30]
- Violation: describe 레이블과 실제 테스트 케이스 의미 불일치
- Rule: MISTAKES.md Tests #9 — describe 텍스트는 내부 it()들의 공통 전제조건만 커버해야 함
- Context: describe('이메일 검증 (email_mismatch)') 블록 안에 이메일이 일치하여 성공하는 케이스가 포함됨. 별도 describe('이메일 정규화') 블록으로 분리.



## [PR #393 | feat/388/비밀번호-재설정-ui | 2026-05-01]
- Violation: 동기 토큰 생성/해시 함수 테스트에서 불필요한 await 사용
- Rule: 테스트는 실제 함수 계약을 반영해야 하며 동기 API를 비동기처럼 보이게 작성하지 않는다
- Context: passwordResetTokenService 테스트가 string을 반환하는 generatePasswordResetToken/hashPasswordResetToken 호출에 await를 붙여 API 성격을 흐리게 했음. await와 async 테스트 선언을 제거.

## [PR #403 | feat/398/contact-us-form | 2026-05-01]
- Violation: cn()을 aria-describedby ID 조합에 오용
- Rule: cn()은 Tailwind 클래스 병합 전용 유틸리티로 ARIA ID 문자열 조합에 사용 금지
- Context: ContactTextareaField의 aria-describedby 값 조합에 cn()을 사용. 배열 filter+join 방식으로 교체.


## [PR #405 follow-up | refactor/scope-realignment-phase-0 | 2026-05-02]
- Violation: future siglens work risked re-introducing analysis logic locally instead of in siglens-core
- Rule: SCOPE.md §3 (dependency direction) — analysis secret sauce stays in core
- Context: added siglens-side §0 work-boundary checklist + CLAUDE.md cross-repo scope guard so that analysis-related task descriptions trigger an explicit redirect-or-confirm step before any code is written.

## [Issue #401 | feat/401/worker-ai-provider-enhancement | 2026-05-02]
- Violation: 에러 처리 의도와 retryable 플래그 모순
- Rule: MISTAKES.md Predictability 6 — 인터페이스/구현/문서 정합성
- Context: chatgpt.ts에서 `finish_reason === 'length'` 처리 시 주석은 "재시도해도 결과는 같다"라고 적었지만 `{ retryable: true }`로 throw. ChatGPT는 budget 축소 등 mitigation이 없으므로 non-retryable로 변경.


## [PR #405 Round 3 | refactor/scope-realignment-phase-0 | 2026-05-02]
- Suggestion applied: `useCurrentUser.ts` and `currentUserAction.ts` now import `AuthUserRecord` directly from `@/domain/auth/types` instead of via `@/domain/types` barrel or `@/infrastructure/db/types`, improving dependency direction (domain types live in domain).


## [PR #409 Round 3 | feat/402/AI-모델-선택-UI | 2026-05-02]
- Violation: `'free'` tier 문자열 리터럴이 컴포넌트 본문에 하드코딩됨
- Rule: MISTAKES.md Coding Paradigm — magic constants must be extracted to module-level constants
- Context: ChartContent.tsx의 `getAllowedModels('free')` 호출에서 `'free'`를 인라인 리터럴로 사용. `DEFAULT_TIER = 'free' as const`로 추출.

## [Issue #402 | feat/402/AI-모델-선택-UI | 2026-05-02]
- Violation: localStorage key constant placed in domain/ layer
- Rule: ARCHITECTURE.md — domain/ must contain only pure business logic; config/storage keys belong in lib/
- Context: `LOCAL_STORAGE_PROVIDER_KEY` was initially created in `src/domain/llm/types.ts` but localStorage keys are UI/persistence configuration, not domain logic. Moved to `src/lib/storageKeys.ts`.

- Violation: Derived constant recreated every render without useMemo
- Rule: MISTAKES.md rule 10 — derived constants from props must be wrapped in useMemo
- Context: `resolvedModels` in ModelSelector.tsx was computed on every render; since handleKeyDown depended on it, useCallback provided no stabilization benefit. Wrapped with useMemo([allowedModels]).

## [PR #412 | worktree-feat-pwa | 2026-05-03]
- Violation: 매직 상수 `'siglens:pwa-trigger'` 문자열이 useAnalysis.ts와 usePwaInstall.ts 두 파일에 하드코딩되어 중복
- Rule: MISTAKES.md #15 — 하드코딩된 상수는 모듈 레벨 상수로 추출
- Context: src/lib/pwaEvents.ts에 PWA_TRIGGER_EVENT 상수 추출 후 두 파일에서 import

- Violation: 단일 useEffect 내에 SW 등록, 이벤트 리스너, setTimeout 세 가지 사이드이펙트 혼합
- Rule: CONVENTIONS.md useEffect Side Effect Isolation — 관심사별 useEffect 분리
- Context: usePwaInstall.ts에서 SW 등록 effect, 이벤트+타이머 effect 두 개로 분리

- Violation: DOM keydown 이벤트 리스너를 IosInstallModal 컴포넌트 useEffect에 직접 등록
- Rule: MISTAKES.md Components #7 — DOM 이벤트 리스너는 커스텀 훅으로 추출
- Context: useEscapeKey 훅 생성 후 IosInstallModal에서 사용

- Violation: 4행 JSDoc @param 블록이 함수 파라미터만 나열
- Rule: CLAUDE.md 코멘트 원칙 — WHY가 자명하지 않을 때만 작성; WHAT 설명 주석 제거
- Context: detectPwaEnvironment.ts에서 JSDoc 블록 전체 제거

- Violation: SW 등록 실패를 .catch(() => {})로 묵음 처리
- Rule: MISTAKES.md Domain Functions #2 — 에러를 완전히 삼키지 말 것
- Context: console.warn('[PWA] SW 등록 실패', err)로 변경

## [PR #412 Round 2 | worktree-feat-pwa | 2026-05-03]
- Violation: useEscapeKey에서 외부 콜백 prop을 useEffect deps에 직접 포함
- Rule: MISTAKES.md Components #1 — 외부 콜백은 useEffectEvent로 감싸야 함
- Context: useEscapeKey.ts에서 [onEscape] deps → useEffectEvent 래핑 후 [] deps로 변경


## [PR #412 Round 3 | worktree-feat-pwa | 2026-05-03]
- Violation: detectPwaEnvironment 순수 함수가 components/pwa/utils/에 배치됨
- Rule: MISTAKES.md Architecture #1 — React 의존성 없는 순수 함수는 lib/ 또는 domain/에 위치
- Context: src/components/pwa/utils/detectPwaEnvironment.ts → src/lib/pwa/detectPwaEnvironment.ts로 이동
