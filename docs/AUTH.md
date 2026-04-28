# Auth — 인증 흐름

본 문서는 siglens 앱의 인증 흐름을 정리한다. 도메인 로직은 모두
`@y0ngha/siglens-core`가 책임지며, 본 앱은 그 함수를 호출하는 얇은 어댑터(서버
액션 · 라우트 핸들러 · UI · proxy)만 담당한다.

## 핵심 원칙

- 인증은 **옵션**이다. 비회원도 모든 기본 기능을 그대로 이용할 수 있고, 회원이
  되면 등급(tier 기반) 추가 혜택이 제공된다.
- 보호 라우트는 **두지 않는다**. `proxy.ts`는 *이미 로그인된* 사용자가
  `/login`·`/signup`에 접근했을 때 `/`로 보내는 역방향 가드만 담당한다.
- 모든 민감 도메인 로직(검증·해싱·세션 발급)은 siglens-core가 처리한다. 본 앱은
  코어 함수를 호출하고 결과를 Next.js 환경에 매핑할 뿐이다.

## 의존성 / 환경 변수

| 변수 | 용도 | PR-1 필요 | PR-2 필요 |
|---|---|---|---|
| `DATABASE_URL` | Neon Postgres 연결 (siglens-core가 사용) | ✓ | ✓ |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | — | ✓ |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | Kakao OAuth | — | ✓ |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | Apple Sign In | — | ✓ |
| `OAUTH_REDIRECT_BASE_URL` (없으면 `NEXT_PUBLIC_SITE_URL` fallback) | 콜백 URL 베이스 | — | ✓ |

## 파일 맵

```
src/infrastructure/auth/
  db.ts                    siglens-core createDatabaseClient 싱글톤 캐시
  applyAuthCookie.ts       AuthSessionCookie → next/headers cookies().set 매핑
  sessionCookieOptions.ts  isSecureCookieEnv() — NODE_ENV로 secure 플래그 결정
  getCurrentUser.ts        쿠키 → findUserBySessionToken (RSC/Server Action 전용)
  currentUserAction.ts     'use server' wrapper — useCurrentUser용
  registerAction.ts        'use server' — registerUser → 자동 loginUser → cookie set → redirect
  loginAction.ts           'use server' — loginUser → cookie set → redirect(sanitizeNextPath)
  logoutAction.ts          'use server' — logoutUser → 만료 cookie set → redirect('/')

src/lib/authRoutes.ts      AUTH_PATHS, sanitizeNextPath()

proxy.ts                   matcher: ['/login','/signup']. 세션 쿠키 존재 시 / 로 redirect

src/components/auth/       UI 컴포넌트 (AuthCardShell·AuthFieldGroup·PasswordField·
                          PasswordStrengthHint·AuthErrorAlert·SubmitButton·
                          LoginForm·SignupForm·LogoutButton)
src/components/layout/HeaderUserMenu.tsx
src/components/hooks/useCurrentUser.ts

src/app/login/page.tsx     RSC — AuthCardShell + LoginForm
src/app/login/error.tsx    클라이언트 에러 fallback
src/app/signup/page.tsx    RSC — AuthCardShell + SignupForm
```

## 시퀀스

### 이메일 회원가입

```
[Browser] /signup
   ↓
[RSC] signup/page.tsx → SignupForm(client)
   ↓ (form submit, useActionState)
[Server Action] registerAction
   → registerUser(input, DrizzleUserRepository, bcryptPasswordHasher)
       ⤳ 검증(이메일 형식·비밀번호 강도) + 중복 검사 + bcrypt hash + INSERT
   → loginUser(input, deps, { secureCookie })   // 자동 로그인
       ⤳ verify hash + INSERT session
   → cookies().set(applyAuthCookie(loginResult.cookie))
   → redirect(sanitizeNextPath(next))
```

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

### 로그아웃

```
[Header dropdown] LogoutButton
   ↓ useTransition + queryClient.setQueryData(currentUser, null)
[Server Action] logoutAction
   → logoutUser({ sessionToken }, { sessions })  // sessions 행 삭제
   → cookies().set(applyAuthCookie(expiredCookie))
   → redirect('/')
```

### Header 사용자 표시

- `app/layout.tsx` 변경 없음. `cacheComponents: true` 환경에서 root layout
  prefetch는 모든 라우트를 dynamic으로 만들어 비용이 크다.
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

siglens-core가 반환하는 메타를 그대로 사용한다.

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
      비밀번호가 올바르지 않습니다"). 코어 측 `invalid_credentials` 단일 코드.
- [x] 비밀번호 hashing — siglens-core `bcryptPasswordHasher` (cost 12).
- [x] 쿠키 secure(prod)/HttpOnly/SameSite=Lax/Path=/.
- [x] CSRF state (PR-2 OAuth 콜백) — 32바이트 random + timing-safe compare +
      HttpOnly 쿠키 5분 TTL.
- [x] Edge runtime 안전 — proxy.ts는 쿠키 *존재 검사*만 한다(DB·bcrypt 호출 없음).

## 후속 이슈

- siglens-core: 회원탈퇴 use-case는 0.1.12에 포함됨(`deleteAccount`). siglens
  측 UI는 별도 이슈 #387.
- siglens-core: 비밀번호 재설정 use-case는 별도 이슈 #42.
- siglens: 비밀번호 재설정 UI는 별도 이슈 #388.
- siglens: 소셜 로그인(PR-2)은 본 PR-1 머지 후 진행.
