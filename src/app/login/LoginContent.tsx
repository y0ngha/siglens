'use client';

import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/features/auth-login';
import { SocialLoginButtons } from '@/features/auth-oauth';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

export const OAUTH_ERROR_MESSAGES: Partial<Record<string, string>> = {
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

export const PASSWORD_RESET_SUCCESS_MESSAGE =
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
