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
