import { AuthCardShell } from '@/components/auth/AuthCardShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { sanitizeNextPath } from '@/domain/auth/redirect';
import { SITE_NAME } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: '로그인',
    description: `${SITE_NAME}에 로그인하여 회원 전용 기능을 이용해보세요.`,
    robots: { index: false, follow: false },
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    oauth_email_conflict:
        '이미 비밀번호로 가입된 이메일입니다. 비밀번호로 로그인해주세요.',
    oauth_profile_invalid: '소셜 로그인 정보를 확인할 수 없습니다.',
    oauth_unknown: '소셜 로그인 중 알 수 없는 오류가 발생했습니다.',
};

interface LoginPageProps {
    searchParams: Promise<{
        next?: string;
        error?: string;
        password_reset?: string;
    }>;
}

const PASSWORD_RESET_SUCCESS_MESSAGE =
    '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.';

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = await searchParams;
    const next = sanitizeNextPath(params.next);
    const nextParam = next === '/' ? undefined : next;
    const initialError = params.error
        ? OAUTH_ERROR_MESSAGES[params.error]
        : undefined;
    const passwordResetSuccess = params.password_reset === '1';
    return (
        <AuthCardShell
            title="다시 만나서 반가워요"
            subtitle="Sign in to continue"
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
        </AuthCardShell>
    );
}
