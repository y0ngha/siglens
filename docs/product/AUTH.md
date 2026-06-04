# Auth — 인증 흐름

본 문서는 siglens 앱의 인증 흐름을 정리한다. 인증 use-case와 관련 인프라는
모두 본 레포(`siglens`)가 직접 소유하며, `@y0ngha/siglens-core`는 인증과 직접
관련된 로직을 더 이상 보유하지 않는다(Phase 1~3 ejection 완료).

## 핵심 원칙

- 인증은 **옵션**이다. 비회원도 모든 기본 기능을 그대로 이용할 수 있고, 회원이
  되면 등급(tier 기반) 추가 혜택이 제공된다.
- 보호 라우트는 **두지 않는다**. `proxy.ts`는 *이미 로그인된* 사용자가
  `/login`·`/signup`에 접근했을 때 `/`로 보내는 역방향 가드만 담당한다.
- 인증 use-case(register/login/logout/social/delete/email-verify/password-reset)는
  FSD 슬라이스(`src/entities/user/lib/`, `src/features/auth-*/actions/`)에 직접 구현되어 있으며,
  비밀번호 해싱(`bcryptjs`), 이메일 토큰 저장소, OAuth 어댑터, 사용자 DB 어댑터(Drizzle/Neon)도
  모두 siglens가 직접 보유한다. siglens-core는 더 이상 인증 도메인을 알지 못한다.

## 의존성 / 환경 변수

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | Neon Postgres 연결 (siglens 로컬 Drizzle 클라이언트가 사용) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | Kakao OAuth — **현재 비활성**(아래 참조). 어댑터를 다시 등록할 때만 필요 |
| `OAUTH_REDIRECT_BASE_URL` (없으면 `NEXT_PUBLIC_SITE_URL` fallback) | OAuth 콜백 URL 베이스 |
| `RESEND_API_KEY` | 비밀번호 재설정 메일 발송용 Resend API key (없으면 noop dispatcher로 fallback) |
| `EMAIL_FROM` (없으면 `Siglens <noreply@siglens.io>`) | 발신자 표시 |

> **현재 활성화된 provider**: **Google만**. `providers.ts`의 `SUPPORTED_PROVIDERS = ['google']`이며,
> Kakao 어댑터는 의도적으로 제외돼 있다(코드 주석 명시). siglens-core 의 `OAuthProvider` union 타입은
> `kakao`·`apple`도 포함하지만 본 앱에서는 비활성. 추후 활성화 시 `providers.ts`의 `SUPPORTED_PROVIDERS`
> 와 `ADAPTERS`, `SocialLoginButtons` 의 PROVIDERS 배열에 추가하면 된다.

## 파일 맵

```
src/entities/session/
  lib/
    db.ts                    Drizzle/Neon 클라이언트 싱글톤 (siglens 로컬)
    applyAuthCookie.ts       AuthSessionCookie → next/headers cookies().set 매핑
    sessionCookieOptions.ts  isSecureCookieEnv() — NODE_ENV로 secure 플래그 결정
    getCurrentUser.ts        쿠키 → findUserBySessionToken (RSC/Server Action 전용)
    bcrypt.ts                bcryptPasswordHasher (cost 12, bcryptjs)
    tokenUtils.ts            세션 토큰 생성/검증
    errorMessages.ts         인증 에러 메시지 상수
  actions/
    currentUserAction.ts     'use server' wrapper — useCurrentUser용
    cleanupExpiredSessionsAction.ts  만료 세션 정리

src/entities/user/
  lib/
    registerUser.ts          registerUser use-case
    loginUser.ts             loginUser use-case
    logoutUser.ts            logoutUser use-case
    deleteAccount.ts         deleteAccount use-case (OAuth unlink 포함)
    findUserBySessionToken.ts  세션 토큰으로 사용자 조회
    requestEmailVerification.ts  이메일 인증 코드 발급
    verifyEmail.ts           이메일 인증 코드 검증
    requestPasswordReset.ts  비밀번호 재설정 토큰 발급
    confirmPasswordReset.ts  비밀번호 재설정 실행

src/entities/oauth-account/
  lib/
    revoker.ts               OAuth token revoker 인터페이스
    googleRevoker.ts          Google OAuth token revocation
    kakaoRevoker.ts           Kakao OAuth token revocation
    pendingOAuthSignupStore.ts  OAuth 가입 대기 상태 저장소

src/entities/email-token/
  api.ts                   createEmailTokenStore 팩토리 (Upstash Redis)
  templates/
    passwordResetEmail.ts    비밀번호 재설정 템플릿 — URL: /reset-password?email=…&token=…
    emailVerificationEmail.ts  회원가입 인증 코드 템플릿 — 6자리 코드 본문 노출

src/shared/email/
  types.ts                 EmailDispatcher / EmailMessage (siglens 로컬 정의)
  dispatcher.ts            ResendEmailDispatcher (RESEND_API_KEY 있을 때) / NoopEmailDispatcher fallback

src/shared/lib/auth/
  redirect.ts              sanitizeNextPath()
  passwordRules.ts         비밀번호 규칙 검증
  validation.ts            이메일 정규화/검증

src/features/auth-login/
  actions/loginAction.ts   'use server' — loginUser → cookie set → redirect(sanitizeNextPath)

src/features/auth-signup/
  actions/registerAction.ts  'use server' — registerUser(emailTokens 포함) → 자동 loginUser → cookie set → redirect

src/features/auth-logout/
  actions/logoutAction.ts  'use server' — logoutUser → 만료 cookie set → redirect('/')

src/features/account-delete/
  actions/deleteAccountAction.ts  'use server' — getCurrentUser + 이메일 일치 검증 → deleteAccount → redirect

src/features/auth-email-verification/
  actions/requestEmailVerificationAction.ts  'use server' — requestEmailVerification 호출
  actions/verifyEmailAction.ts               'use server' — verifyEmail로 코드 확인

src/features/auth-password-reset/
  actions/requestPasswordResetAction.ts  'use server' — requestPasswordReset → 항상 submitted: true
  actions/confirmPasswordResetAction.ts  'use server' — confirmPasswordReset → redirect('/login?password_reset=1')

src/features/auth-oauth/
  lib/
    state.ts               issueOAuthState / verifyOAuthState (HttpOnly 쿠키 5분 TTL, timing-safe 비교)
    providers.ts            provider id → adapter map, isOAuthProvider, buildOAuthRedirectUri
    google.ts               Google OIDC 어댑터 (token + userinfo)
    kakao.ts                Kakao OAuth 2.0 어댑터 (kapi.kakao.com) — 현재 SUPPORTED_PROVIDERS/ADAPTERS에서 제외(비활성)
  actions/
    cancelOAuthSignupAction.ts  OAuth 가입 취소

src/features/auth-oauth-consent/
  actions/finalizeOAuthSignupAction.ts  OAuth 동의 완료 → 사용자 생성

proxy.ts                   matcher: ['/login','/signup']. 세션 쿠키 존재 시 / 로 redirect

src/widgets/layout/HeaderUserMenu.tsx   useCurrentUser 훅 사용

src/app/api/auth/
  [provider]/start/route.ts   state 발급 + provider authorize URL 302
  callback/[provider]/route.ts state 검증 + token 교환 + socialLoginUser + cookie set

src/app/login/page.tsx     RSC — AuthCardShell + LoginForm
src/app/login/error.tsx    클라이언트 에러 fallback
src/app/signup/page.tsx    RSC — AuthCardShell + SignupForm
src/app/account/page.tsx          RSC — 프로필 정보 + 위험존(회원 탈퇴 진입)
src/app/account/delete/page.tsx   RSC — AuthCardShell + DeleteAccountConfirm
src/app/forgot-password/page.tsx  RSC — AuthCardShell + ForgotPasswordForm
src/app/reset-password/page.tsx   RSC — token 쿼리 → AuthCardShell + ResetPasswordForm
```

## 시퀀스

### 이메일 회원가입 (3단계 인증 흐름)

이슈 #394 / siglens-core#55 이후 회원가입은 이메일 인증을 강제하는 3단계 흐름이다.
SignupForm(client)은 useActionState 3개의 결과를 derive해 phase를 결정한다.

```
[Browser] /signup
   ↓ phase = 'email'
[Form 1] 이메일 입력 → useRequestEmailVerification.formAction
[Server Action] requestEmailVerificationAction
   → requestEmailVerification({ email }, { emailTokens, emailDispatcher }, { buildMessage })
       ⤳ use-case가 6자리 코드 발급 + Redis(EmailTokenStore) pending 저장 + dispatcher 호출
   → { submitted: true }   ⇒ phase 자동 'code'
   ↓
[Form 2] 코드 입력 + email hidden → useVerifyEmail.formAction
[Server Action] verifyEmailAction
   → verifyEmail({ email, code }, { emailTokens })
       ⤳ use-case가 Redis 조회 + 코드 일치 + TTL 확인 → pending → verified 상태 전이
   → { verified: true }   ⇒ phase 자동 'details'
   ↓
[Form 3] 비밀번호 + 이름 입력 → useSignupForm.formAction
[Server Action] registerAction
   → registerUser({ email, password, name }, { users, passwordHasher, emailTokens })
       ⤳ use-case가 verified 확인 (아니면 email_not_verified 에러) + bcrypt hash + INSERT users
   → loginUser(...)   // 자동 로그인
   → cookies().set(applyAuthCookie(loginResult.cookie))
   → redirect(sanitizeNextPath(next))
```

phase 전이는 `useEffect`로 setState하지 않고 useActionState의 결과를 직접 derive한다
(`react-hooks/set-state-in-effect` 회피).

### 이메일 로그인

```
[Browser] /login → LoginForm
   ↓ submit
[Server Action] loginAction
   → loginUser(...)
       ⤳ verify hash + INSERT session
   → cookies().set(applyAuthCookie(result.cookie))
   → redirect(sanitizeNextPath(next))
```

### 회원 탈퇴

```
[Header dropdown] 계정 설정 → /account
   ↓ 위험존 카드 → /account/delete
[RSC] account/delete/page.tsx
   → getCurrentUser() — null이면 redirect('/login?next=/account/delete')
   → DeleteAccountConfirm(client, userEmail)
       ⤳ 입력 이메일 == userEmail 일 때만 submit 활성
   ↓ submit (useActionState)
[Server Action] deleteAccountAction
   → getCurrentUser() — 재검증 (CSR 위변조 방어)
   → input email !== user.email → { error: 'email_mismatch' } 반환
   → deleteAccount({ userId }, { users, oauthAccounts, oauthRevoker }, { secureCookie })
       ⤳ provider별 OAuth token revoke + user 행 삭제 (sessions·oauth_accounts 는 FK CASCADE)
   → cookies().set(applyAuthCookie(expiredCookie))
   → redirect('/?account_deleted=1')
```

가드 전략은 다른 회원 전용 페이지와 동일하다. proxy.ts는 변경하지 않으며, RSC가
`getCurrentUser()` 결과로 직접 `/login?next=/account/delete` 로 리다이렉트한다.

### 비밀번호 재설정 (Redis 토큰 + email/token URL 쌍)

이슈 #394 / siglens-core#55 이후 password_resets DB 테이블은 제거되고 Redis(EmailTokenStore)로 토큰을 관리한다.

```
[/login] "비밀번호를 잊으셨나요?" 링크 → /forgot-password
   ↓ ForgotPasswordForm submit
[Server Action] requestPasswordResetAction
   → requestPasswordReset({ email }, { users, emailTokens, emailDispatcher }, { buildMessage })
       ⤳ use-case가 사용자 조회 + token 발급 + Redis pending 저장 + dispatcher.sendEmail
   → 항상 { submitted: true } 반환 (enumeration 회피)
   ↓
[메일 수신] 링크 클릭 → /reset-password?email=<email>&token=<raw>
   ↓ ResetPasswordForm submit (email + token 둘 다 hidden input으로 전달)
[Server Action] confirmPasswordResetAction
   → confirmPasswordReset({ email, token, newPassword }, { users, passwordHasher, emailTokens })
       ⤳ use-case가 Redis 조회 + 토큰 일치 + TTL 확인 + 비밀번호 강도 검증 + bcrypt hash + UPDATE users
   → 실패: 폼 상태로 invalid_token / expired_token / weak_password / invalid_password / invalid_email 반환
   → 성공: redirect('/login?password_reset=1') — 로그인은 별도 (의도적으로 자동로그인 안 함)
[/login?password_reset=1] 상단에 "비밀번호 변경 완료" 안내 표시 후 로그인 폼
```

소셜 가입 사용자에 대해서는 use-case가 password_hash 없는 계정으로 토큰 발급을 거부하므로,
사용자 측에서는 enumeration 회피를 위해 동일한 success 메시지가 노출된다.

dispatcher 정책: `RESEND_API_KEY` 환경변수가 설정되어 있을 때 `ResendEmailDispatcher`를
사용하고, 없을 때 `NoopEmailDispatcher`(개발/CI 환경)로 fallback. EmailTokenStore는
siglens 로컬 `createEmailTokenStore()` 팩토리(Upstash Redis 자동 사용) 호출.

deleteAccount use-case가 OAuth provider unlink까지 함께 처리한다(`oauthAccounts`/`oauthRevoker` deps를 받아 provider별 token revocation을 자동 호출).

### 로그아웃

```
[Header dropdown] LogoutButton
   ↓ useTransition + queryClient.setQueryData(currentUser, null)
[Server Action] logoutAction
   → logoutUser({ sessionToken }, { sessions })  // sessions 행 삭제
   → cookies().set(applyAuthCookie(expiredCookie))
   → redirect('/')
```

### 소셜 로그인

```
[Browser] /login → SocialLoginButtons → <a href="/api/auth/google/start?next=...">
   ↓
[Route] api/auth/google/start
   → issueOAuthState('google', sanitizeNextPath(next))
       ⤳ 32바이트 random state 발급 + StatePayload(JSON base64url)을 HttpOnly 쿠키 5분 TTL
   → response.cookies.set(state cookie)
   → redirect(googleOAuthAdapter.authorizeUrl({ state, redirectUri }))
   ↓
[Provider] Google 인증 동의 후 redirect_uri로 복귀
   ↓
[Route] api/auth/callback/google?code=...&state=...
   → verifyOAuthState('google', queryState, cookie)  // timing-safe 비교 + 만료 검사
   → adapter.exchangeCodeForProfile({ code, redirectUri })
       ⤳ token 교환 → userinfo 조회 → SocialLoginUserInput 빌드
   → socialLoginUser(profile, { users, sessions })
       ⤳ 기존 OAuth 링크 인증 또는 신규 OAuth 사용자 생성 + 세션
   → 세션 쿠키 set, state 쿠키 만료 + redirect(state.next)
```

콜백 단계의 실패는 `redirect('/login?error=...')` 로 통일한다:
- `oauth_unknown` — provider 파라미터 잘못/state 불일치/code 누락
- `oauth_profile_invalid` — token 교환 실패, profile 조회 실패, email 누락, socialLoginUser invalid_oauth_profile
- `oauth_email_conflict` — 동일 이메일이 비밀번호 계정으로 가입돼 있음. `email` 쿼리에 해당 이메일을 함께 전달해 LoginForm에서 안내.

provider별 정책:
- **Google** — OIDC scope `openid email profile`. userinfo endpoint 사용. (현재 유일한 활성 provider)
- **Kakao** *(현재 비활성)* — 재활성화 시: scope `account_email profile_nickname profile_image`. `kapi.kakao.com/v2/user/me`. `KAKAO_CLIENT_SECRET`은 카카오 개발자 콘솔에서 발급한 경우에만 전달.

### Header 사용자 표시

- `app/layout.tsx` 변경 없음. root layout에서 사용자 prefetch를 수행하면 모든
  라우트를 dynamic으로 만들 수 있어 비용이 크다.
- HeaderUserMenu(client)가 `useCurrentUser()` (= `useQuery(currentUserAction)`)
  로 마운트 후 fetch한다. 첫 페인트 동안은 `size-10` placeholder가 잠깐 보인다.
- 로그아웃 시 `queryClient.setQueryData(QUERY_KEYS.currentUser(), null)` 으로
  즉시 미로그인 상태를 반영한 뒤 redirect.

### 보호 라우트 (역방향만)

```
proxy.ts (matcher: /login, /signup)
   ↓
세션 쿠키 존재? → NextResponse.redirect('/')
세션 쿠키 없음 → NextResponse.next()  // 그대로 페이지 진입
```

DB lookup은 하지 않는다 — 만료/위조 쿠키는 페이지 안에서 useCurrentUser가 null을
반환하므로 UI가 자연스럽게 미로그인 상태로 표시된다.

## 쿠키 정책

siglens 로컬 auth use-case가 반환하는 `AuthSessionCookie` 메타를 그대로 사용한다.

| 항목 | 값 |
|---|---|
| 이름 | `siglens_session` (`AUTH_SESSION_COOKIE_NAME`) |
| HttpOnly | `true` |
| SameSite | `Lax` |
| Secure | 운영(NODE_ENV=production)에서만 `true` |
| Path | `/` |
| Max-Age | 30일 (`DEFAULT_SESSION_TTL_SECONDS`) |

## 보안 체크리스트

- [x] open-redirect — `sanitizeNextPath`가 path-only 화이트리스트로 검증.
- [x] enumeration 회피 — 로그인 실패 시 단일 generic 메시지 ("이메일 또는
      비밀번호가 올바르지 않습니다"). loginUser use-case의 `invalid_credentials` 단일 코드.
- [x] 비밀번호 hashing — siglens 로컬 `bcryptPasswordHasher` (cost 12, `bcryptjs`).
- [x] 쿠키 secure(prod)/HttpOnly/SameSite=Lax/Path=/.
- [x] CSRF state (PR-2 OAuth 콜백) — 32바이트 random + timing-safe compare +
      HttpOnly 쿠키 5분 TTL.
- [x] Edge runtime 안전 — proxy.ts는 쿠키 *존재 검사*만 한다(DB·bcrypt 호출 없음).

## 후속 이슈

- ~~siglens: 비밀번호 재설정 UI는 별도 이슈 #388~~ — **완료**(#388 CLOSED). 구현: `/forgot-password`·`/reset-password` 페이지, `ForgotPasswordForm`/`ResetPasswordForm`, `requestPasswordResetAction`/`confirmPasswordResetAction`.
