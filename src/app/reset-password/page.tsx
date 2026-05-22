import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthCardShell } from '@/components/auth/AuthCardShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
export const metadata: Metadata = {
    title: '비밀번호 재설정',
    description: `${SITE_NAME} 새 비밀번호 설정`,
    alternates: { canonical: `${SITE_URL}/reset-password` },
    openGraph: { url: `${SITE_URL}/reset-password` },
    robots: { index: false, follow: true },
};

interface ResetPasswordPageProps {
    searchParams: Promise<{ email?: string; token?: string }>;
}

const MISSING_PARAMS_MESSAGE =
    '재설정 링크가 올바르지 않습니다. 비밀번호 찾기를 다시 시도해주세요.';

// Awaits searchParams (dynamic) — must be inside Suspense for PPR.
async function ResetPasswordContent({ searchParams }: ResetPasswordPageProps) {
    const params = await searchParams;
    const email = params.email ?? '';
    const token = params.token ?? '';
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

export default function ResetPasswordPage({
    searchParams,
}: ResetPasswordPageProps) {
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
            <Suspense>
                <ResetPasswordContent searchParams={searchParams} />
            </Suspense>
        </AuthCardShell>
    );
}
