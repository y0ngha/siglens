import { Suspense } from 'react';
import { AuthCardShell } from '@/components/auth/AuthCardShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { sanitizeNextPath } from '@/domain/auth/redirect';
import { SITE_NAME, SITE_URL } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';

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

interface LoginPageProps {
    searchParams: Promise<{
        next?: string;
        error?: string;
        password_reset?: string;
    }>;
}

// Awaits searchParams (dynamic) — must be inside Suspense for PPR.
async function LoginContent({ searchParams }: LoginPageProps) {
    const params = await searchParams;
    const next = sanitizeNextPath(params.next);
    const nextParam = next === '/' ? undefined : next;
    const initialError = params.error
        ? OAUTH_ERROR_MESSAGES[params.error]
        : undefined;
    const passwordResetSuccess = params.password_reset === '1';
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

export default function LoginPage({ searchParams }: LoginPageProps) {
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
            <Suspense>
                <LoginContent searchParams={searchParams} />
            </Suspense>
        </AuthCardShell>
    );
}
