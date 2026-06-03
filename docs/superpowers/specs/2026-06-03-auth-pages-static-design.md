# 인증 페이지 full-static 전환 설계 (login / signup / reset-password)

- 작성일: 2026-06-03
- 상태: 설계 승인 완료, 구현 계획 대기
- 관련: `docs/superpowers/specs/2026-05-18-ppr-resumable-slots-fix-design.md` (#439 PPR 비활성 배경), `docs/superpowers/specs/2026-06-02-symbol-isr-seo-design.md`

## 1. 배경 & 목표

빌드 output에서 `/login`, `/signup`, `/reset-password` 세 라우트가 `ƒ (Dynamic)`로 잡힌다.
원인은 단 하나 — 각 페이지가 서버 컴포넌트에서 `await searchParams`를 호출하기 때문이다.
`searchParams`는 Next.js의 Request-time(Dynamic) API라, 읽는 순간 라우트 전체가 동적 렌더링으로 전환된다.

PPR(Cache Components)을 켜면 정적 shell + 동적 Suspense hole로 부분 prerender가 가능하지만,
이 레포는 #439("Couldn't find all resumable slots" → client fallback → SEO 봇이 metadata 미수신)
때문에 `cacheComponents`를 **의도적으로 비활성** 상태로 둔다. 따라서 PPR은 선택지가 아니다.

**목표:** PPR 없이 세 라우트를 `○ (Static)`으로 전환한다.
방법은 ISR이 아니라(쿼리스트링은 Full Route Cache 키가 아니므로 ISR이 부적합),
`searchParams` 읽기를 `useSearchParams()` 기반 client 컴포넌트로 격리해 페이지를 full-static화하는 것이다.

### 왜 ISR이 아닌가 (자료조사 검증 완료)

- ISR/Full Route Cache는 **path(route params)만** 키로 쓰고 쿼리스트링은 무시한다.
  `/login?next=/a` 와 `/login?next=/b` 가 동일 HTML을 받게 되어 리다이렉트 타깃이 깨진다.
  (vercel/next.js #69920로 확인)
- 그래서 `searchParams`를 서버에서 읽는 한 ISR 캐시에 절대 안 들어간다.
- 대안은 "쿼리 의존부를 client로 옮겨 path-static화"뿐이다.

### SEO 안전성 (자료조사 검증 완료)

- ISR/SSG는 SEO-safe(봇이 prerender HTML + head metadata 수신).
- 단, 본 설계의 client-화 방식은 쿼리 의존 콘텐츠를 **CSR로 떨군다**(초기 HTML에 없음).
  이는 indexed 페이지에선 SEO 손실이지만, **세 라우트 모두 `robots: { index: false }`**(noindex)라
  영향이 0이다. metadata는 `page.tsx`(서버)에 남아 prerender되므로 그대로 노출된다.

## 2. 적용 범위

| 라우트 | 변환 | 비고 |
|---|---|---|
| `/login` | ƒ → ○ | `next`, `error`, `password_reset` 쿼리 |
| `/signup` | ƒ → ○ | `next` 쿼리 |
| `/reset-password` | ƒ → ○ | `email`, `token` 쿼리 |

**범위 외 (동적 유지가 정당함):**
- `/signup/oauth/consent` — 서버 Redis `store.peek(token)` (client-화 불가)
- `/market` — `getMarketSummaryAction` 내부 `await headers()` 봇 탐지 (client-화 불가)
- `/account`, `/account/delete` — `await cookies()` 유저별 데이터
- `/api/*` — 라우트 핸들러

## 3. 아키텍처

### 변환 패턴 (라우트별 동일)

변환 전:
```
page.tsx (server)
 ├─ XxxPage (default export, server)  → AuthCardShell + <Suspense><XxxContent searchParams/></Suspense>
 └─ XxxContent (async server)         → await searchParams → 폼에 props 전달
```

변환 후:
```
page.tsx (server, 유지)              → AuthCardShell + <Suspense fallback={<AuthFormSkeleton/>}><XxxContent/></Suspense>
XxxContent.tsx ('use client', 신규)  → useSearchParams() → 동일 props 도출 → 기존 폼에 전달
```

- `page.tsx`의 default export는 **서버 컴포넌트로 유지** → `AuthCardShell`/footer/metadata가 prerender → 라우트 `○`.
- `searchParams` 읽기만 신규 `XxxContent.tsx`(`'use client'`)로 격리 → 이 subtree만 CSR.
- 기존 폼(`LoginForm`/`SignupForm`/`ResetPasswordForm`/`SocialLoginButtons`)과 **props 인터페이스 무수정.**
- `useSearchParams()` 사용 컴포넌트는 Suspense 경계 필수(Next 빌드 요구) — 기존 `<Suspense>`가 이미 있어 충족.

### 신규/수정 파일

신규:
- `src/app/login/LoginContent.tsx` (`'use client'`)
- `src/app/signup/SignupContent.tsx` (`'use client'`)
- `src/app/reset-password/ResetPasswordContent.tsx` (`'use client'`)
- `src/shared/ui/auth/AuthFormSkeleton.tsx`

수정:
- `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/reset-password/page.tsx`
  (인라인 async server `XxxContent` 제거 → 신규 client 컴포넌트 import + Suspense fallback 지정)

### 컴포넌트 계약

**`AuthFormSkeleton`**
- `AuthCardShell` children 자리에 들어가는 폼 형태 스켈레톤.
- props: `rows?: number` (기본값 지정) — 필드 개수 근사로 CLS 최소화. 과설계 회피.

**`XxxContent` (3개)**
- 입력: 없음. `useSearchParams()`로 URL 읽음.
- 출력: 기존 서버판 `XxxContent`와 **동일 JSX** (폼 + 버튼 + login의 배너).
- 도출 로직 1:1 이식:
  - login: `sanitizeNextPath(get('next'))` → `nextParam`; `get('error')` → `OAUTH_ERROR_MESSAGES` 매핑; `get('password_reset')==='1'` → 성공 배너.
  - signup: `sanitizeNextPath(get('next'))` → `nextParam`.
  - reset: `get('email')`/`get('token')` → 둘 다 있으면 폼, 아니면 누락 에러 메시지.
- `sanitizeNextPath`는 `shared/lib`의 순수 함수(server import 없음) → client-safe. 호출만 함(무수정).
- login의 `OAUTH_ERROR_MESSAGES` 로컬 상수는 `LoginContent`로 함께 이동(자기완결).

## 4. 데이터 흐름

요청 → (미들웨어 `proxy.ts` 역방향 가드: 로그인 사용자면 `/`로 리다이렉트) →
정적 HTML(shell + skeleton fallback) 즉시 응답 → hydration 시 `XxxContent`가
`useSearchParams()`로 쿼리 읽어 폼/배너 렌더.

- `next`/`token` 등은 원래도 URL(=client 가시) 값이라 client-read로 인한 **신규 노출 없음**.
- 폼 자체가 `'use client'`라 기존에도 JS 의존. 변경되는 건 첫 페인트 시점뿐.

## 5. 영향 격리 (검증 완료)

| 항목 | 결과 |
|---|---|
| 폼 컴포넌트 사용처 | 각 페이지 + 통합테스트 한정. props 무수정이라 무영향 |
| `sanitizeNextPath` | 다수 사용처 있으나 호출(read)만, 함수 무수정 |
| 역방향 가드 | `src/proxy.ts`(미들웨어)에 존재. static/dynamic 무관하게 매 요청 실행 → 가드 유지 |
| `OAUTH_ERROR_MESSAGES` | login 로컬 상수 → `LoginContent`로 이동, 자기완결 |
| app route page를 import하는 외부 코드 | 없음 |

**변경 범위:** page 3개 수정 + Content 3개 신규 + 스켈레톤 1개 신규. 그 외 무수정.

## 6. UX 트레이드오프

지금은 동적 SSR이라 서버가 폼 HTML을 완성 → 첫 페인트에 폼이 보인다.
static 전환 후엔 prerender HTML에 shell + skeleton만 담기고 폼은 hydration 후 채워진다.
즉 폼 영역에 짧은 깜빡임이 생긴다.

- **완화책:** 폼 레이아웃 높이를 근사한 `AuthFormSkeleton`을 fallback으로 prerender → CLS 없이 "로딩 중"이 의도적으로 보이게.
- noindex·저트래픽 인증 페이지라 체감 영향 미미. 실익(서버 compute 제거 + CDN 직빵)은 modest하나 안전하고 깔끔.

## 7. 테스트 & 검증

**기존 테스트 (영향 최소)**
- `app/{login,signup,reset-password}/__tests__/page.test.ts` — metadata export 검증. metadata는 `page.tsx`에 잔류 → 그대로 통과.
- `__integration__/auth*Flow.test.tsx` — 폼을 props로 직접 렌더. 폼 무수정 → 그대로 통과.

**신규 테스트**
- `app/{login,signup,reset-password}/__tests__/XxxContent.test.tsx` — `next/navigation`의 `useSearchParams` mock으로 분기 검증:
  - login: `error` → 메시지, `password_reset=1` → 성공 배너, `next` → sanitize 후 전달
  - signup: `next` 전달
  - reset: `email`+`token` 있음 → 폼, 없음 → 에러 메시지
- `AuthFormSkeleton` 렌더 스모크 테스트 1개.

**최종 검증**
- `yarn build` → 세 라우트가 `ƒ` → `○`로 바뀌는지 build output 직접 확인 (= 성공 기준).
- `yarn test` 그린.
- E2E auth 스펙(로그인/회원가입 플로우) 회귀 없음 — `next` 리다이렉트·에러 배너 동작 확인.

## 8. 성공 기준

build output에서 `/login`, `/signup`, `/reset-password`가 `○ (Static)`으로 표기되고,
기존 동작(`next` 리다이렉트, OAuth 에러 배너, 비밀번호 변경 성공 배너, reset 누락-파라미터 에러)이 유지된다.
