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

## [PR #389 | feat/369/auth-email | 2026-04-29]
- Violation: registerAction이 password에 .trim() 적용, loginAction은 trim 없이 사용 — 회원가입 시 trim된 비밀번호로 해시되어 로그인 시 verify 실패
- Rule: FF.md Predictability — 동일 입력에 대한 동일 처리 보장; 양 액션 간 비대칭 처리 금지
- Context: 사용자가 비밀번호에 의도적/비의도적 공백 포함 가입 시 로그인 불가 버그. password는 양쪽 모두 trim 제거(원본 유지), email은 양쪽 모두 trim 적용으로 통일.

## [Issue #394 stubs removal | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: 미배포 코어 API stub 모듈을 임시로 두고 import 경로를 우회
- Rule: 단일 의존성 원칙 — 외부 패키지 export가 정식 출시되면 stub은 즉시 제거하고 import 경로를 통일
- Context: siglens-core 0.2.1 배포로 모든 새 API(requestEmailVerification, verifyEmail, EmailTokenStore, V2 PasswordReset, V2 RegisterUser, OAuthRevoker, DrizzleOAuthAccountRepository)가 실 export됨. coreStubs.ts 삭제, 모든 import를 @y0ngha/siglens-core로 교체. EmailMessage/EmailDispatcher 또한 코어 export를 그대로 re-export하여 단일 경로 유지.

- Violation: 코어가 자동화한 OAuth revocation을 사용자에게 수동 안내 문구로 노출
- Rule: 도메인 동작과 UI 메시지 동기화 — 코어가 책임지면 UI는 그 사실을 반영
- Context: deleteAccount가 oauthAccounts + oauthRevoker deps로 provider 측 token revocation을 자동 수행하므로, DeleteAccountConfirm의 "각 provider 계정에서 직접 끊으세요" 안내 박스와 /privacy 약관 문구를 "탈퇴 시 자동으로 회수된다"로 갱신.

## [PR #395 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: multi-step Server Action 폼에서 이전 단계로 되돌아갈 수 없어 잘못 입력한 이메일을 수정할 수 없음
- Rule: FF.md Predictability — 사용자가 표시된 단계와 입력 상태를 예측 가능한 방식으로 되돌릴 수 있어야 함
- Context: SignupForm의 phase가 useActionState 결과에서만 derive되어 코드 확인/상세 입력 단계에서 이메일 수정 수단이 없었음. flow를 key로 remount하는 이메일 수정 버튼을 추가해 인증 상태와 폼 입력을 함께 초기화.

