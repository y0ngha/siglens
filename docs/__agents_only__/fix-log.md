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


## [Issue #394 stubs removal | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: 미배포 코어 API stub 모듈을 임시로 두고 import 경로를 우회
- Rule: 단일 의존성 원칙 — 외부 패키지 export가 정식 출시되면 stub은 즉시 제거하고 import 경로를 통일
- Context: siglens-core 0.2.1 배포로 모든 새 API(requestEmailVerification, verifyEmail, EmailTokenStore, V2 PasswordReset, V2 RegisterUser, OAuthRevoker, DrizzleOAuthAccountRepository)가 실 export됨. coreStubs.ts 삭제, 모든 import를 @y0ngha/siglens-core로 교체. EmailMessage/EmailDispatcher 또한 코어 export를 그대로 re-export하여 단일 경로 유지.

- Violation: 코어가 자동화한 OAuth revocation을 사용자에게 수동 안내 문구로 노출
- Rule: 도메인 동작과 UI 메시지 동기화 — 코어가 책임지면 UI는 그 사실을 반영
- Context: deleteAccount가 oauthAccounts + oauthRevoker deps로 provider 측 token revocation을 자동 수행하므로, DeleteAccountConfirm의 "각 provider 계정에서 직접 끊으세요" 안내 박스와 /privacy 약관 문구를 "탈퇴 시 자동으로 회수된다"로 갱신.

## [PR #395 Round 6 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: infrastructure Server Action에서 네트워크 응답 없이 무한 대기 가능
- Rule: MISTAKES.md Fire-and-Forget #1 — fetch 기반 외부 호출에는 반드시 타임아웃 설정
- Context: ResendEmailDispatcher.sendEmail이 AbortSignal 없이 Resend SDK를 호출해 네트워크 지연 시 Server Action이 무기한 블로킹. AbortSignal.timeout + Promise.race 패턴으로 10초 타임아웃 추가.

## [PR #395 Round 5 | feat/394/email-verification-redis-migration | 2026-05-01]
- Violation: 동일 중간 타입 별칭 3개가 LocalInfraErrorCode와 동일한 값으로 중복 선언
- Rule: CLAUDE.md — 작업 범위를 벗어나는 불필요한 추상화 추가 금지; 독립적 확장 계획이 없는 타입 별칭은 중복
- Context: formTypes.ts에서 SignupLocalErrorCode / ResetPasswordLocalErrorCode / VerifyEmailLocalErrorCode가 모두 LocalInfraErrorCode와 동일. LocalInfraErrorCode를 export로 승격하고 중간 별칭 3개를 제거하여 인터페이스에서 직접 참조.

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
- Violation: <p role="alert">로 네이티브 ARIA role 덮어쓰기
- Rule: MISTAKES.md Accessibility #1 — 시맨틱 요소의 native role을 role 속성으로 교체 금지
- Context: ContactTextField, ContactTextareaField의 에러 메시지를 <p role="alert">로 렌더링. <div role="alert">로 교체.

- Violation: cn()을 aria-describedby ID 조합에 오용
- Rule: cn()은 Tailwind 클래스 병합 전용 유틸리티로 ARIA ID 문자열 조합에 사용 금지
- Context: ContactTextareaField의 aria-describedby 값 조합에 cn()을 사용. 배열 filter+join 방식으로 교체.

- Violation: 특정 기능 전용 훅을 공유 hooks/ 디렉토리에 배치
- Rule: ARCHITECTURE.md — components/hooks/는 범용 훅 전용, 기능 특화 훅은 해당 기능 폴더의 hooks/ 서브폴더에 위치
- Context: useContactForm.ts가 components/hooks/에 위치. components/contact/hooks/로 이동.

- Violation: hook 파일에서 @/domain/types가 아닌 도메인 서브모듈에서 타입 import
- Rule: ARCHITECTURE.md — hook 파일(hooks/*.ts)의 타입 import는 @/domain/types 또는 @y0ngha/siglens-core에서만 허용
- Context: useContactForm.ts가 @/domain/contact/formTypes에서 ContactFormState를 import. formTypes의 모든 타입을 domain/types.ts로 이동 후 @/domain/types로 수정.

## [Issue #401 | feat/401/worker-ai-provider-enhancement | 2026-05-02]
- Violation: 동일 정책 상수가 여러 retry 모듈에 중복 정의 (AI_RETRY_MAX_ATTEMPTS, AI_RETRY_DELAY_MS)
- Rule: MISTAKES.md Design 1 / FF Cohesion — 함께 변해야 하는 상수는 single source of truth에 모아야 함
- Context: claude-retry/gemini-retry/chatgpt-retry 세 파일이 `AI_RETRY_MAX_ATTEMPTS = 5`와 `AI_RETRY_DELAY_MS = 5000`을 각자 정의. 모두 retry.ts로 이동해 공유.

- Violation: 동일 utility 함수(isMaxTokensError) 중복 구현
- Rule: MISTAKES.md Coding Paradigm 1 — 새 함수 작성 전 기존 helper 확인
- Context: claude-retry.ts와 gemini-retry.ts 양쪽이 `isMaxTokensError`를 동일 로직으로 정의. retry.ts에 `hasErrorCode(error, code)`로 추출하여 양쪽이 import.

- Violation: 에러 처리 의도와 retryable 플래그 모순
- Rule: MISTAKES.md Predictability 6 — 인터페이스/구현/문서 정합성
- Context: chatgpt.ts에서 `finish_reason === 'length'` 처리 시 주석은 "재시도해도 결과는 같다"라고 적었지만 `{ retryable: true }`로 throw. ChatGPT는 budget 축소 등 mitigation이 없으므로 non-retryable로 변경.

- Violation: process.env 값을 type alias로 force-cast (검증 없이 `as`)
- Rule: MISTAKES.md TypeScript 7 — `as` 캐스트 시 runtime 보장 또는 가드 명시
- Context: config.ts에서 `process.env.AI_PROVIDER as AIProviderType`, BRIEFING_CLAUDE_MODEL/BRIEFING_GEMINI_MODEL을 검증 없이 cast. parseAIProvider/parseBriefingModel 함수로 runtime 검증 후 throw 처리.

- Violation: Array.find 후 type narrow를 위한 중복 type check
- Rule: MISTAKES.md Coding Paradigm 4 — 결과에 영향 없는 로직 제거
- Context: claude.ts에서 `find(b => b.type === 'text')` 후 `if (textBlock && textBlock.type === 'text')`로 재검사. find에 explicit type predicate(`(block): block is TextBlock`)을 적용해 후속 narrow 가드 제거.
