# Fix Log

## [PR #403 Round 5 | feat/398/contact-us-form | 2026-05-02]
- Violation: 새로 만든 파일이 git에 추가되지 않은 채 PR 푸시되어 빌드가 차단됨
- Rule: PR_FIX_FLOW Step 1-7 — 픽스 적용 후 모든 신규 파일을 commit/push 전에 git add로 추적해야 함
- Context: src/components/contact/utils/contactFormUtils.ts가 로컬 파일 시스템에는 존재했지만 git 인덱스에는 없어 ContactForm.tsx의 import가 원격 빌드에서 해결되지 않음. 같은 라운드에서 lib/contactErrorMessages.ts는 dead code로 남게 됨. git add로 추적 후 다음 커밋에 포함.

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

## [PR #391 코멘트 반영 | feat/387/회원탈퇴-ui | 2026-04-30]
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

## [PR #403 | feat/398/contact-us-form | 2026-05-01]
- Violation: <p role="alert">로 네이티브 ARIA role 덮어쓰기
- Rule: MISTAKES.md Accessibility #1 — 시맨틱 요소의 native role을 role 속성으로 교체 금지
- Context: ContactTextField, ContactTextareaField의 에러 메시지를 <p role="alert">로 렌더링. <div role="alert">로 교체.

- Violation: cn()을 aria-describedby ID 조합에 오용
- Rule: cn()은 Tailwind 클래스 병합 전용 유틸리티로 ARIA ID 문자열 조합에 사용 금지
- Context: ContactTextareaField의 aria-describedby 값 조합에 cn()을 사용. 배열 filter+join 방식으로 교체.

- Violation: 특정 기능 전용 훅을 공유 hooks/ 디렉토리에 배치
- Rule: ARCHITECTURE.md — components/hooks/는 범용 훅 전용, 기능 특화 훅은 해당 기능 폴더의 hooks/ 서브폴더에 위치
- Context: useContactForm.ts가 components/hooks/에 위치. components/contact/hooks/로 이동.

## [PR #403 Round 4 | feat/398/contact-us-form | 2026-05-01]
- Violation: 컴포넌트 파일에서 같은 디렉터리 컴포넌트를 상대 경로('./')로 import
- Rule: CONVENTIONS.md Import Path Rules — 상대 경로 금지, 경로 별칭(@/) 사용 필수
- Context: ContactForm.tsx가 ContactSubmittedNotice, ContactTextField, ContactTextareaField를 './' 상대 경로로 import. @/components/contact/... 로 변경.

## [PR #403 Round 3 | feat/398/contact-us-form | 2026-05-01]
- Violation: domain/ 함수에서 상대 경로 import 사용
- Rule: CONVENTIONS.md Import Path Rules — 상대 경로 금지, 경로 별칭(@/) 사용 필수
- Context: domain/contact/validation.ts가 './constants', './formTypes' 상대 경로로 import. @/domain/contact/constants, @/domain/types로 변경.

- Violation: hook 파일에서 @/domain/types가 아닌 도메인 서브모듈에서 타입 import
- Rule: ARCHITECTURE.md — hook 파일(hooks/*.ts)의 타입 import는 @/domain/types 또는 @y0ngha/siglens-core에서만 허용
- Context: useContactForm.ts가 @/domain/contact/formTypes에서 ContactFormState를 import. formTypes의 모든 타입을 domain/types.ts로 이동 후 @/domain/types로 수정.
