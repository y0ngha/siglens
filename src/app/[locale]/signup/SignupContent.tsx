'use client';

import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/shared/i18n/useLocalePath';
import { useSearchParams } from 'next/navigation';
import { SignupForm } from '@/features/auth-signup';
import { SocialLoginButtons } from '@/features/auth-oauth/ui/SocialLoginButtons';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

// useSearchParams를 읽어 이 subtree만 CSR로 떨군다(라우트는 static 유지).
export function SignupContent() {
    const t = useTranslations('app.signup');
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
    return (
        <>
            <SignupForm next={nextParam} />
            <p className="mt-6 mb-2 text-xs text-secondary-500">
                {t('SignupContent.50f3e4')}
            </p>
            <SocialLoginButtons next={nextParam} />
        </>
    );
}
