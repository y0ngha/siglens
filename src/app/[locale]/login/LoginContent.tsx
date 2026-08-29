'use client';

import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/shared/i18n/useLocalePath';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/features/auth-login';
import { SocialLoginButtons } from '@/features/auth-oauth/ui/SocialLoginButtons';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

// useSearchParams를 읽어 이 subtree만 CSR로 떨군다(라우트는 static 유지).
// page.tsx의 <Suspense> 경계가 빌드 타임 useSearchParams 요구를 충족시킨다.
export function LoginContent() {
    const params = useSearchParams();
    // `next`를 로케일 경로로 바꾼다. 이 값이 hidden 필드 → 로그인 액션 →
    // OAuth state → 콜백 리다이렉트까지 그대로 흘러가므로, 여기서 접두사를 붙이면
    // 아래 경로 전체가 로케일을 유지한다. `useLocalePath`는 멱등이라 이미 접두사가
    // 있는 `next`(프록시 전방 가드가 발급한 값)를 두 번 붙이지 않는다.
    const toLocalePath = useLocalePath();
    const next = toLocalePath(sanitizeNextPath(params.get('next')));
    // ko는 로케일 홈이 `/`라 기존처럼 hidden 필드를 생략한다. 비-ko는 `/en` 등
    // 의미 있는 값이므로 반드시 넘긴다 — 생략하면 로그인 후 ko 홈으로 떨어진다.
    const nextParam = next === '/' ? undefined : next;
    const tAuth = useTranslations('entities.auth');
    const errorCode = params.get('error');
    const errorKey = errorCode ? AUTH_ERROR_KEY[errorCode] : undefined;
    const initialError = errorKey ? tAuth(errorKey) : undefined;
    const passwordResetSuccess = params.get('password_reset') === '1';
    return (
        <>
            {passwordResetSuccess ? (
                <div
                    role="status"
                    aria-live="polite"
                    className="mb-4 rounded-lg border border-ui-success/30 bg-ui-success/5 p-3 text-sm text-ui-success-text"
                >
                    {tAuth('error.passwordResetSuccess')}
                </div>
            ) : null}
            <LoginForm next={nextParam} initialError={initialError} />
            <SocialLoginButtons next={nextParam} />
        </>
    );
}
