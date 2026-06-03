# 인증 페이지 full-static 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/login`, `/signup`, `/reset-password` 세 라우트를 동적 렌더링(ƒ)에서 full-static(○)으로 전환한다.

**Architecture:** 각 page.tsx의 인라인 async server `XxxContent`(`await searchParams`로 라우트를 동적화)를 신규 `'use client'` `XxxContent.tsx`(`useSearchParams()` 사용)로 격리한다. page.tsx의 default export는 서버 컴포넌트로 유지되어 `AuthCardShell`/footer/metadata가 prerender되고, 쿼리 의존부만 Suspense 경계 아래에서 CSR된다. 기존 폼 컴포넌트의 props 인터페이스는 무수정.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, vitest(jsdom), @testing-library/react.

**Branch:** `refactor/auth-pages-static` (이미 생성됨, 설계 문서 커밋 5b8a5bf0 위에서 작업).

**Spec:** `docs/superpowers/specs/2026-06-03-auth-pages-static-design.md`

---

## File Structure

신규:
- `src/shared/ui/auth/AuthFormSkeleton.tsx` — Suspense fallback용 폼 형태 스켈레톤
- `src/app/login/LoginContent.tsx` — `'use client'`, login 쿼리 도출
- `src/app/signup/SignupContent.tsx` — `'use client'`, signup 쿼리 도출
- `src/app/reset-password/ResetPasswordContent.tsx` — `'use client'`, reset 쿼리 도출
- 각 신규 컴포넌트의 테스트 (아래 각 Task에 명시)

수정:
- `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/reset-password/page.tsx`

무수정 (참조만):
- `src/features/auth-login`, `src/features/auth-signup`, `src/features/auth-password-reset`, `src/features/auth-oauth` (폼/버튼)
- `src/shared/lib/auth/redirect.ts` (`sanitizeNextPath`, 순수 함수)
- `src/proxy.ts` (역방향 가드 — 미들웨어, 무관)

---

## Task 1: AuthFormSkeleton

Suspense fallback으로 쓸 폼 형태 스켈레톤. CLS 최소화를 위해 입력 행 + 버튼 높이를 근사한다.

**Files:**
- Create: `src/shared/ui/auth/AuthFormSkeleton.tsx`
- Test: `src/shared/ui/auth/__tests__/AuthFormSkeleton.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/shared/ui/auth/__tests__/AuthFormSkeleton.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { AuthFormSkeleton } from '../AuthFormSkeleton';

describe('AuthFormSkeleton', () => {
    it('renders the default number of field rows (2) plus a button row', () => {
        const { container } = render(<AuthFormSkeleton />);
        // 각 필드 행은 label bar + input bar 2개. 기본 2행 → 4개. + 버튼 1개 = 5 placeholder bar.
        const bars = container.querySelectorAll('div.bg-secondary-800');
        expect(bars.length).toBe(5);
    });

    it('renders the requested number of field rows', () => {
        const { container } = render(<AuthFormSkeleton rows={3} />);
        const bars = container.querySelectorAll('div.bg-secondary-800');
        // 3행 → 6 + 버튼 1 = 7.
        expect(bars.length).toBe(7);
    });

    it('is hidden from assistive tech', () => {
        const { container } = render(<AuthFormSkeleton />);
        expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/shared/ui/auth/__tests__/AuthFormSkeleton.test.tsx`
Expected: FAIL — `Cannot find module '../AuthFormSkeleton'`.

- [ ] **Step 3: Write minimal implementation**

`src/shared/ui/auth/AuthFormSkeleton.tsx`:
```tsx
interface AuthFormSkeletonProps {
    /** 근사할 입력 필드 행 수. 폼 높이에 맞춰 CLS를 줄이기 위한 값. */
    rows?: number;
}

/**
 * 인증 페이지가 full-static으로 prerender될 때 Suspense fallback으로 쓰인다.
 * 쿼리 의존부(폼)가 hydration 후 CSR로 채워지는 동안의 빈 화면 깜빡임을
 * 폼 레이아웃 높이를 근사한 스켈레톤으로 덮어 CLS를 최소화한다.
 */
export function AuthFormSkeleton({ rows = 2 }: AuthFormSkeletonProps) {
    return (
        <div className="space-y-4" aria-hidden="true">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <div className="bg-secondary-800 h-3 w-20 rounded motion-safe:animate-pulse" />
                    <div className="bg-secondary-800 h-10 w-full rounded-md motion-safe:animate-pulse" />
                </div>
            ))}
            <div className="bg-secondary-800 h-10 w-full rounded-md motion-safe:animate-pulse" />
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/shared/ui/auth/__tests__/AuthFormSkeleton.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/auth/AuthFormSkeleton.tsx src/shared/ui/auth/__tests__/AuthFormSkeleton.test.tsx
git commit -m "feat(auth): add AuthFormSkeleton for static auth page fallback"
```

---

## Task 2: LoginContent + login page static화

`login/page.tsx`의 async server `LoginContent`를 `'use client'` 컴포넌트로 이관. `OAUTH_ERROR_MESSAGES`/`PASSWORD_RESET_SUCCESS_MESSAGE` 상수도 함께 이동.

**Files:**
- Create: `src/app/login/LoginContent.tsx`
- Modify: `src/app/login/page.tsx`
- Test: `src/app/login/__tests__/LoginContent.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/app/login/__tests__/LoginContent.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';

const { loginFormSpy, socialSpy, searchParamsRef } = vi.hoisted(() => ({
    loginFormSpy: vi.fn(),
    socialSpy: vi.fn(),
    searchParamsRef: { value: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));
vi.mock('@/features/auth-login', () => ({
    LoginForm: (props: { next?: string; initialError?: string }) => {
        loginFormSpy(props);
        return <div data-testid="login-form" />;
    },
}));
vi.mock('@/features/auth-oauth', () => ({
    SocialLoginButtons: (props: { next?: string }) => {
        socialSpy(props);
        return <div data-testid="social" />;
    },
}));

import { LoginContent } from '../LoginContent';

describe('LoginContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchParamsRef.value = new URLSearchParams();
    });

    it('passes a sanitized next path to the form and social buttons', () => {
        searchParamsRef.value = new URLSearchParams({ next: '/account' });
        render(<LoginContent />);
        expect(loginFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: '/account' })
        );
        expect(socialSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: '/account' })
        );
    });

    it('drops an open-redirect next to undefined', () => {
        searchParamsRef.value = new URLSearchParams({ next: '//evil.com' });
        render(<LoginContent />);
        expect(loginFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: undefined })
        );
    });

    it('maps a known oauth error code to its message', () => {
        searchParamsRef.value = new URLSearchParams({
            error: 'oauth_email_conflict',
        });
        render(<LoginContent />);
        expect(loginFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                initialError:
                    '이미 비밀번호로 가입된 이메일입니다. 비밀번호로 로그인해주세요.',
            })
        );
    });

    it('shows the password-reset success banner when password_reset=1', () => {
        searchParamsRef.value = new URLSearchParams({ password_reset: '1' });
        render(<LoginContent />);
        expect(screen.getByRole('status')).toHaveTextContent(
            '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.'
        );
    });

    it('omits the banner without password_reset', () => {
        render(<LoginContent />);
        expect(screen.queryByRole('status')).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/app/login/__tests__/LoginContent.test.tsx`
Expected: FAIL — `Cannot find module '../LoginContent'`.

- [ ] **Step 3: Create LoginContent**

`src/app/login/LoginContent.tsx`:
```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/features/auth-login';
import { SocialLoginButtons } from '@/features/auth-oauth';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    oauth_email_conflict:
        '이미 비밀번호로 가입된 이메일입니다. 비밀번호로 로그인해주세요.',
    oauth_profile_invalid: '소셜 로그인 정보를 확인할 수 없습니다.',
    oauth_unknown: '소셜 로그인 중 알 수 없는 오류가 발생했습니다.',
    oauth_consent_invalid:
        '잘못된 가입 요청입니다. 처음부터 다시 시작해주세요.',
    oauth_consent_expired: '가입 시간이 만료되었습니다. 다시 시도해주세요.',
    service_unavailable:
        '서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.',
};

const PASSWORD_RESET_SUCCESS_MESSAGE =
    '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.';

// useSearchParams를 읽어 이 subtree만 CSR로 떨군다(라우트는 static 유지).
// page.tsx의 <Suspense> 경계가 빌드 타임 useSearchParams 요구를 충족시킨다.
export function LoginContent() {
    const params = useSearchParams();
    const next = sanitizeNextPath(params.get('next'));
    const nextParam = next === '/' ? undefined : next;
    const errorCode = params.get('error');
    const initialError = errorCode
        ? OAUTH_ERROR_MESSAGES[errorCode]
        : undefined;
    const passwordResetSuccess = params.get('password_reset') === '1';
    return (
        <>
            {passwordResetSuccess ? (
                <div
                    role="status"
                    aria-live="polite"
                    className="border-ui-success/30 bg-ui-success/5 text-ui-success mb-4 rounded-md border p-3 text-sm"
                >
                    {PASSWORD_RESET_SUCCESS_MESSAGE}
                </div>
            ) : null}
            <LoginForm next={nextParam} initialError={initialError} />
            <SocialLoginButtons next={nextParam} />
        </>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/app/login/__tests__/LoginContent.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Rewrite login/page.tsx to use the client content + skeleton fallback**

`src/app/login/page.tsx` 전체를 다음으로 교체:
```tsx
import { Suspense } from 'react';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { AuthFormSkeleton } from '@/shared/ui/auth/AuthFormSkeleton';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginContent } from './LoginContent';

// noindex 페이지에도 canonical을 두는 이유: ?next=/path 같은 쿼리 변형 URL이 외부에 공유되더라도
// "원본은 /login 하나"라는 신호를 명확히 해 두면 일부 크롤러/공유 도구가 변형을 강조하지 않게 된다.
// openGraph.url을 명시해 두지 않으면 root layout의 og:url(SITE_URL)이 그대로 상속되어
// canonical과 og:url이 불일치한다(SEO 일관성 위반).
export const metadata: Metadata = {
    title: '로그인',
    description: `${SITE_NAME}에 로그인하여 회원 전용 기능을 이용해보세요.`,
    alternates: { canonical: `${SITE_URL}/login` },
    openGraph: { url: `${SITE_URL}/login` },
    robots: { index: false, follow: true },
};

// searchParams 읽기를 LoginContent('use client')로 격리해 이 라우트는 full-static(○)으로 prerender된다.
// shell/footer/metadata는 정적, 쿼리 의존부만 Suspense 아래에서 CSR.
export default function LoginPage() {
    return (
        <AuthCardShell
            title="다시 만나서 반가워요"
            subtitle="이메일과 비밀번호로 로그인"
            footer={
                <div className="space-y-2">
                    <p>
                        <Link
                            href="/forgot-password"
                            className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                            비밀번호를 잊으셨나요?
                        </Link>
                    </p>
                    <p>
                        처음이세요?{' '}
                        <Link
                            href="/signup"
                            className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                            회원가입 →
                        </Link>
                    </p>
                </div>
            }
        >
            <Suspense fallback={<AuthFormSkeleton rows={2} />}>
                <LoginContent />
            </Suspense>
        </AuthCardShell>
    );
}
```

- [ ] **Step 6: Verify existing login page test (metadata) still passes**

Run: `yarn vitest run src/app/login/__tests__/page.test.ts`
Expected: PASS — metadata export 검증은 그대로 유효 (단, 이 테스트가 `vi.mock('@/shared/lib/auth/redirect', ...)`를 갖고 있는데 page.tsx가 더 이상 거기서 import하지 않아도 mock은 무해하게 통과한다. 깨지면 해당 mock 라인 제거).

- [ ] **Step 7: Typecheck the route**

Run: `yarn vitest run src/app/login/__tests__/LoginContent.test.tsx src/app/login/__tests__/page.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/login/LoginContent.tsx src/app/login/page.tsx src/app/login/__tests__/LoginContent.test.tsx
git commit -m "refactor(login): isolate searchParams into client LoginContent for static render"
```

---

## Task 3: SignupContent + signup page static화

**Files:**
- Create: `src/app/signup/SignupContent.tsx`
- Modify: `src/app/signup/page.tsx`
- Test: `src/app/signup/__tests__/SignupContent.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/app/signup/__tests__/SignupContent.test.tsx`:
```tsx
import { render } from '@testing-library/react';

const { signupFormSpy, socialSpy, searchParamsRef } = vi.hoisted(() => ({
    signupFormSpy: vi.fn(),
    socialSpy: vi.fn(),
    searchParamsRef: { value: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));
vi.mock('@/features/auth-signup', () => ({
    SignupForm: (props: { next?: string }) => {
        signupFormSpy(props);
        return <div data-testid="signup-form" />;
    },
}));
vi.mock('@/features/auth-oauth', () => ({
    SocialLoginButtons: (props: { next?: string }) => {
        socialSpy(props);
        return <div data-testid="social" />;
    },
}));

import { SignupContent } from '../SignupContent';

describe('SignupContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchParamsRef.value = new URLSearchParams();
    });

    it('passes a sanitized next path to the form and social buttons', () => {
        searchParamsRef.value = new URLSearchParams({ next: '/market' });
        render(<SignupContent />);
        expect(signupFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: '/market' })
        );
        expect(socialSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: '/market' })
        );
    });

    it('drops an open-redirect next to undefined', () => {
        searchParamsRef.value = new URLSearchParams({ next: 'https://evil.com' });
        render(<SignupContent />);
        expect(signupFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: undefined })
        );
    });

    it('passes undefined next when absent', () => {
        render(<SignupContent />);
        expect(signupFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: undefined })
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/app/signup/__tests__/SignupContent.test.tsx`
Expected: FAIL — `Cannot find module '../SignupContent'`.

- [ ] **Step 3: Create SignupContent**

`src/app/signup/SignupContent.tsx`:
```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { SignupForm } from '@/features/auth-signup';
import { SocialLoginButtons } from '@/features/auth-oauth';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

// useSearchParams를 읽어 이 subtree만 CSR로 떨군다(라우트는 static 유지).
export function SignupContent() {
    const params = useSearchParams();
    const next = sanitizeNextPath(params.get('next'));
    const nextParam = next === '/' ? undefined : next;
    return (
        <>
            <SignupForm next={nextParam} />
            <p className="text-secondary-500 mt-6 mb-2 text-xs">
                소셜 로그인 시작 후 약관 동의 단계가 있습니다.
            </p>
            <SocialLoginButtons next={nextParam} />
        </>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/app/signup/__tests__/SignupContent.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Rewrite signup/page.tsx**

`src/app/signup/page.tsx` 전체를 다음으로 교체:
```tsx
import { Suspense } from 'react';

import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { AuthFormSkeleton } from '@/shared/ui/auth/AuthFormSkeleton';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupContent } from './SignupContent';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
export const metadata: Metadata = {
    title: '회원가입',
    description: `${SITE_NAME} 회원이 되면 추가 혜택을 누릴 수 있어요. 가입은 옵션이며 비회원도 모든 기본 기능을 그대로 이용할 수 있습니다.`,
    alternates: { canonical: `${SITE_URL}/signup` },
    openGraph: { url: `${SITE_URL}/signup` },
    robots: { index: false, follow: true },
};

// searchParams 읽기를 SignupContent('use client')로 격리해 이 라우트는 full-static(○)으로 prerender된다.
export default function SignupPage() {
    return (
        <AuthCardShell
            title="회원이 되면 더 많은 걸 볼 수 있어요"
            subtitle="이메일로 시작하기"
            footer={
                <p>
                    이미 계정이 있으신가요?{' '}
                    <Link
                        href="/login"
                        className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                        로그인 →
                    </Link>
                </p>
            }
        >
            <Suspense fallback={<AuthFormSkeleton rows={3} />}>
                <SignupContent />
            </Suspense>
        </AuthCardShell>
    );
}
```

- [ ] **Step 6: Verify existing signup page test still passes**

Run: `yarn vitest run src/app/signup/__tests__/page.test.ts`
Expected: PASS (metadata 검증). 깨지면 page.tsx가 더 이상 import하지 않는 모듈의 잔여 `vi.mock` 라인을 제거.

- [ ] **Step 7: Commit**

```bash
git add src/app/signup/SignupContent.tsx src/app/signup/page.tsx src/app/signup/__tests__/SignupContent.test.tsx
git commit -m "refactor(signup): isolate searchParams into client SignupContent for static render"
```

---

## Task 4: ResetPasswordContent + reset-password page static화

**Files:**
- Create: `src/app/reset-password/ResetPasswordContent.tsx`
- Modify: `src/app/reset-password/page.tsx`
- Test: `src/app/reset-password/__tests__/ResetPasswordContent.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/app/reset-password/__tests__/ResetPasswordContent.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';

const { resetFormSpy, searchParamsRef } = vi.hoisted(() => ({
    resetFormSpy: vi.fn(),
    searchParamsRef: { value: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));
vi.mock('@/features/auth-password-reset', () => ({
    ResetPasswordForm: (props: { email: string; token: string }) => {
        resetFormSpy(props);
        return <div data-testid="reset-form" />;
    },
}));

import { ResetPasswordContent } from '../ResetPasswordContent';

describe('ResetPasswordContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchParamsRef.value = new URLSearchParams();
    });

    it('renders the form with email and token when both present', () => {
        searchParamsRef.value = new URLSearchParams({
            email: 'user@example.com',
            token: 'tok123',
        });
        render(<ResetPasswordContent />);
        expect(resetFormSpy).toHaveBeenCalledWith({
            email: 'user@example.com',
            token: 'tok123',
        });
    });

    it('shows the missing-params alert when token is absent', () => {
        searchParamsRef.value = new URLSearchParams({
            email: 'user@example.com',
        });
        render(<ResetPasswordContent />);
        expect(resetFormSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(
            '재설정 링크가 올바르지 않습니다. 비밀번호 찾기를 다시 시도해주세요.'
        );
    });

    it('shows the missing-params alert when both absent', () => {
        render(<ResetPasswordContent />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/app/reset-password/__tests__/ResetPasswordContent.test.tsx`
Expected: FAIL — `Cannot find module '../ResetPasswordContent'`.

- [ ] **Step 3: Create ResetPasswordContent**

`src/app/reset-password/ResetPasswordContent.tsx`:
```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/features/auth-password-reset';

const MISSING_PARAMS_MESSAGE =
    '재설정 링크가 올바르지 않습니다. 비밀번호 찾기를 다시 시도해주세요.';

// useSearchParams를 읽어 이 subtree만 CSR로 떨군다(라우트는 static 유지).
// token은 원래도 URL(client 가시) 값이라 client-read로 인한 신규 노출 없음.
export function ResetPasswordContent() {
    const params = useSearchParams();
    const email = params.get('email') ?? '';
    const token = params.get('token') ?? '';
    const ready = email.length > 0 && token.length > 0;
    return ready ? (
        <ResetPasswordForm email={email} token={token} />
    ) : (
        <div
            role="alert"
            className="border-ui-danger/30 bg-ui-danger/5 text-ui-danger rounded-md border p-3 text-sm"
        >
            {MISSING_PARAMS_MESSAGE}
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/app/reset-password/__tests__/ResetPasswordContent.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Rewrite reset-password/page.tsx**

`src/app/reset-password/page.tsx` 전체를 다음으로 교체:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { AuthFormSkeleton } from '@/shared/ui/auth/AuthFormSkeleton';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { ResetPasswordContent } from './ResetPasswordContent';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
export const metadata: Metadata = {
    title: '비밀번호 재설정',
    description: `${SITE_NAME} 새 비밀번호 설정`,
    alternates: { canonical: `${SITE_URL}/reset-password` },
    openGraph: { url: `${SITE_URL}/reset-password` },
    robots: { index: false, follow: true },
};

// searchParams 읽기를 ResetPasswordContent('use client')로 격리해 이 라우트는 full-static(○)으로 prerender된다.
export default function ResetPasswordPage() {
    return (
        <AuthCardShell
            title="새 비밀번호 설정"
            subtitle="이전 비밀번호와 다른 값으로 설정해주세요"
            footer={
                <p>
                    <Link
                        href="/forgot-password"
                        className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                        재설정 링크 다시 받기 →
                    </Link>
                </p>
            }
        >
            <Suspense fallback={<AuthFormSkeleton rows={2} />}>
                <ResetPasswordContent />
            </Suspense>
        </AuthCardShell>
    );
}
```

- [ ] **Step 6: Verify existing reset-password page test still passes**

Run: `yarn vitest run src/app/reset-password/__tests__/page.test.ts`
Expected: PASS (metadata 검증). 깨지면 잔여 `vi.mock` 라인 제거.

- [ ] **Step 7: Commit**

```bash
git add src/app/reset-password/ResetPasswordContent.tsx src/app/reset-password/page.tsx src/app/reset-password/__tests__/ResetPasswordContent.test.tsx
git commit -m "refactor(reset-password): isolate searchParams into client content for static render"
```

---

## Task 5: 전체 검증 (ƒ → ○ 확인)

성공 기준 검증: build output에서 세 라우트가 `○ (Static)`으로 표기되는지 직접 확인 + 전체 테스트 그린.

**Files:** (없음 — 검증만)

- [ ] **Step 1: Run lint**

Run: `yarn lint`
Expected: 신규/수정 파일 통과. 위반 시 수정.

- [ ] **Step 2: Run the full unit test suite**

Run: `yarn test`
Expected: PASS (신규 테스트 4개 파일 포함, 기존 통합/페이지 테스트 회귀 없음).

- [ ] **Step 3: Production build and inspect the route table**

빌드 exit code를 파이프로 가리지 말고 직접 캡처한다(메모리: build exit code pipe masks failure):
```bash
yarn build > /tmp/auth-static-build.log 2>&1; echo "EXIT=$?"
```
Expected: `EXIT=0`.

- [ ] **Step 4: Confirm the three routes are now static**

```bash
grep -E '/(login|signup|reset-password)\b' /tmp/auth-static-build.log
```
Expected: `/login`, `/signup`, `/reset-password` 행이 `○ (Static)` 마커로 표기된다(빌드 직전엔 `ƒ`였음). `●`/`ƒ`로 남아있으면 해당 라우트의 page.tsx가 여전히 동적 API(`await searchParams` 등)를 직접 호출하는지 점검.

- [ ] **Step 5: Final commit (if any lint/build fixups were made)**

```bash
git add -A
git commit -m "test(auth): verify login/signup/reset-password render static"
```

만약 Step 1~4에서 추가 수정이 없었다면 이 커밋은 건너뛴다.

---

## 검증 후 흐름

이 plan 완료 후, 구현 결과에 대해 CLAUDE.md 라우팅대로 `review-agent` → (수정) → `mistake-managing-agent` → `git-agent`(push/PR) 순으로 진행한다. push는 사용자 승인 후, ls-remote로 반영 확인(메모리: verify push landed).
