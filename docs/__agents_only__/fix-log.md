# Fix Log

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


## [PR #395 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: 동일 실패 원인(Redis 미설정)에 대해 verifyEmailAction과 requestEmailVerificationAction이 서로 다른 error.code 반환
- Rule: MISTAKES.md Predictability #1.5 — 동일 입력 경로는 대칭적으로 처리
- Context: verifyEmailAction에서 createEmailTokenStore() === null 시 'invalid_verification_code'를 반환했으나, requestEmailVerificationAction은 동일 조건에서 'redis_unavailable'을 반환. VerifyEmailFormState error.code 타입에 VerifyEmailLocalErrorCode('redis_unavailable')를 추가하고 verifyEmailAction을 통일.

## [Issue #394 stubs removal | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: 미배포 코어 API stub 모듈을 임시로 두고 import 경로를 우회
- Rule: 단일 의존성 원칙 — 외부 패키지 export가 정식 출시되면 stub은 즉시 제거하고 import 경로를 통일
- Context: siglens-core 0.2.1 배포로 모든 새 API(requestEmailVerification, verifyEmail, EmailTokenStore, V2 PasswordReset, V2 RegisterUser, OAuthRevoker, DrizzleOAuthAccountRepository)가 실 export됨. coreStubs.ts 삭제, 모든 import를 @y0ngha/siglens-core로 교체. EmailMessage/EmailDispatcher 또한 코어 export를 그대로 re-export하여 단일 경로 유지.

- Violation: 코어가 자동화한 OAuth revocation을 사용자에게 수동 안내 문구로 노출
- Rule: 도메인 동작과 UI 메시지 동기화 — 코어가 책임지면 UI는 그 사실을 반영
- Context: deleteAccount가 oauthAccounts + oauthRevoker deps로 provider 측 token revocation을 자동 수행하므로, DeleteAccountConfirm의 "각 provider 계정에서 직접 끊으세요" 안내 박스와 /privacy 약관 문구를 "탈퇴 시 자동으로 회수된다"로 갱신.

## [PR #395 Round 3 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: ResetPasswordFormState.error.code가 ConfirmPasswordResetErrorCode만 허용 → Redis 미설정 시 의미상 잘못된 'invalid_token' 반환
- Rule: MISTAKES.md TypeScript #4 — interface field declaration must match runtime behavior
- Context: confirmPasswordResetAction.ts가 Redis 미설정 시 'invalid_token'을 반환했으나 실제 원인은 'redis_unavailable'. ResetPasswordLocalErrorCode 추가 후 타입 유니온으로 확장, confirmPasswordResetAction과 테스트 모두 수정.

- Violation: passwordResetEmail.ts의 SITE_URL이 모듈 로드 시점에 고정 → 테스트에서 env 오버라이드 불가, 분기 커버리지 누락
- Rule: MISTAKES.md Domain Functions #3 — module-level constants frozen at load time; use per-call evaluation instead
- Context: SITE_URL을 buildSiteUrl() lazy 함수로 교체하여 테스트에서 process.env.NEXT_PUBLIC_SITE_URL 오버라이드 가능. 누락된 env 설정 분기 및 trailing slash 정규화 테스트 추가.

## [PR #395 Round 4 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: code 단계에서 동일한 codeState.error.message가 AuthErrorAlert와 AuthFieldGroup.error prop 두 곳에 동시 표시
- Rule: 동일 정보를 두 채널로 동시 노출하지 않음 — 하나의 에러는 하나의 UI 위치에서만 표시
- Context: SignupForm.tsx code phase에서 AuthErrorAlert와 AuthFieldGroup error prop에 모두 codeState.error.message를 전달하여 사용자에게 동일 에러가 중복 노출됨. AuthFieldGroup error prop 제거로 AuthErrorAlert 단일 표시로 통일.



