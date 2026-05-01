# Fix Log

## [Issue #369 PR-2 round 1 | feat/369/auth-social | 2026-04-28]
- Violation: 멀티라인 JSDoc 주석 블록 (proxy.ts, infrastructure/auth/{db,getCurrentUser,applyAuthCookie,sessionCookieOptions}.ts)
- Rule: CONVENTIONS.md — 함수당 단일 줄 주석만 허용
- Context: 인증 어댑터 파일들이 2~4줄 JSDoc 블록으로 작성됨. 한 줄로 압축.


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

## [PR #389 | feat/369/auth-email | 2026-04-29]
- Violation: registerAction이 password에 .trim() 적용, loginAction은 trim 없이 사용 — 회원가입 시 trim된 비밀번호로 해시되어 로그인 시 verify 실패
- Rule: FF.md Predictability — 동일 입력에 대한 동일 처리 보장; 양 액션 간 비대칭 처리 금지
- Context: 사용자가 비밀번호에 의도적/비의도적 공백 포함 가입 시 로그인 불가 버그. password는 양쪽 모두 trim 제거(원본 유지), email은 양쪽 모두 trim 적용으로 통일.

## [Issue #387 | feat/387/회원탈퇴-ui | 2026-04-30]
- Violation: aria-describedby가 정적 힌트 텍스트만 가리키고 입력 검증 결과를 알리는 라이브 영역이 없음
- Rule: WCAG 4.1.3 (Status Messages) — 사용자가 입력한 값에 대한 검증 결과는 스크린리더에 즉시 통지되어야 함
- Context: DeleteAccountConfirm의 이메일 재입력 필드가 aria-describedby로 정적 힌트만 가리켜 잘못된 이메일을 입력해도 음성 안내가 없었음. 같은 paragraph를 role="status" aria-live="polite" + 입력값에 따라 텍스트가 바뀌는 동적 메시지로 전환하고, aria-invalid도 함께 토글하도록 수정.

## [PR #391 코멘트 반영 | feat/387/회원탈퇴-ui | 2026-04-30]
- Violation: 이메일 표시 요소에 aria-hidden 적용으로 스크린 리더 접근 불가
- Rule: WCAG 접근성 — 사용자가 참조해야 할 정보는 스크린 리더에서 읽혀야 함
- Context: DeleteAccountConfirm에서 사용자가 재입력해야 할 이메일 주소를 표시하는 <p>에 aria-hidden이 적용되어 스크린 리더 사용자가 이메일 확인 불가. aria-hidden 제거.

- Violation: describe 레이블과 실제 테스트 케이스 의미 불일치
- Rule: MISTAKES.md Tests #9 — describe 텍스트는 내부 it()들의 공통 전제조건만 커버해야 함
- Context: describe('이메일 검증 (email_mismatch)') 블록 안에 이메일이 일치하여 성공하는 케이스가 포함됨. 별도 describe('이메일 정규화') 블록으로 분리.

## [PR #391 Suggestion 반영 | feat/387/회원탈퇴-ui | 2026-04-30]
- Violation: section의 aria-label이 시각적 h2 헤딩 텍스트와 불일치
- Rule: WCAG 접근성 — aria-label은 가능한 한 visible text와 일치시켜 인지 불일치 방지
- Context: account/page.tsx에서 위험존 section의 aria-label이 "위험 작업"이고 h2가 "위험존"으로 달라, 스크린 리더와 시각 사용자 간 용어 불일치. aria-label="위험존"으로 통일.

## [Issue #388 | feat/388/비밀번호-재설정-ui | 2026-05-01]
- Violation: fire-and-forget 주석을 달아두고 실제로는 await로 dispatcher 호출 결과를 기다림
- Rule: MISTAKES.md Fire-and-Forget Operations #1 — fire-and-forget이라면 진짜로 caller를 막지 않아야 함
- Context: requestPasswordResetAction에서 이메일 발송을 async로 진행할 의도였으나 await가 들어가 Resend 응답을 기다리는 동안 Server Action이 블록됨. void 호출로 변경하고 dispatcher.sendEmail 자체가 boolean 반환 + 내부 swallow 한다는 점을 주석으로 명시.

## [PR #393 | feat/388/비밀번호-재설정-ui | 2026-05-01]
- Violation: 동기 토큰 생성/해시 함수 테스트에서 불필요한 await 사용
- Rule: 테스트는 실제 함수 계약을 반영해야 하며 동기 API를 비동기처럼 보이게 작성하지 않는다
- Context: passwordResetTokenService 테스트가 string을 반환하는 generatePasswordResetToken/hashPasswordResetToken 호출에 await를 붙여 API 성격을 흐리게 했음. await와 async 테스트 선언을 제거.

## [Issue #394 round 1 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: 동일 모듈에서 import 두 번 (re-export + 내부 사용)
- Rule: MISTAKES.md Components #0 — 중복 import 통합
- Context: src/infrastructure/email/types.ts에서 EmailMessage를 export type으로 한 번, 내부 annotation용으로 또 한 번 import. 단일 import + export type {…}으로 통합.

- Violation: 인프라 레이어 내부에서 EmailMessage를 도메인 stubs에서 직접 import하여 ./types 인다이렉션을 우회
- Rule: FF Cohesion 3-A — 인프라 모듈은 자체 ./types 경계를 통해 외부 타입을 받음
- Context: emailVerificationEmail.ts가 @/domain/auth/coreStubs에서 EmailMessage를 직접 import해 passwordResetEmail.ts와 import 경로가 갈렸음. ./types를 통해 동일 경로로 통일.

- Violation: 정적 string id를 hardcode하여 useId() 미사용
- Rule: FF Predictability — 같은 기능의 사용처는 동일한 idiomatic React 패턴 사용
- Context: ResetPasswordForm의 hintId가 'reset-password-hint' literal이었으나 SignupForm은 useId()를 사용 중. useId()로 통일.

- Violation: 에러 코드 union의 일부 분기가 테스트 미커버
- Rule: MISTAKES.md Infrastructure #2 / Tests #22 — 인프라 액션은 모든 에러 분기 테스트 필요
- Context: verifyEmailAction의 'no_pending_verification', registerAction의 'email_already_exists' 분기가 테스트 누락. 각각 케이스 추가하여 분기 커버리지 보완.

## [Issue #394 stubs removal | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: 미배포 코어 API stub 모듈을 임시로 두고 import 경로를 우회
- Rule: 단일 의존성 원칙 — 외부 패키지 export가 정식 출시되면 stub은 즉시 제거하고 import 경로를 통일
- Context: siglens-core 0.2.1 배포로 모든 새 API(requestEmailVerification, verifyEmail, EmailTokenStore, V2 PasswordReset, V2 RegisterUser, OAuthRevoker, DrizzleOAuthAccountRepository)가 실 export됨. coreStubs.ts 삭제, 모든 import를 @y0ngha/siglens-core로 교체. EmailMessage/EmailDispatcher 또한 코어 export를 그대로 re-export하여 단일 경로 유지.

- Violation: 코어가 자동화한 OAuth revocation을 사용자에게 수동 안내 문구로 노출
- Rule: 도메인 동작과 UI 메시지 동기화 — 코어가 책임지면 UI는 그 사실을 반영
- Context: deleteAccount가 oauthAccounts + oauthRevoker deps로 provider 측 token revocation을 자동 수행하므로, DeleteAccountConfirm의 "각 provider 계정에서 직접 끊으세요" 안내 박스와 /privacy 약관 문구를 "탈퇴 시 자동으로 회수된다"로 갱신.
