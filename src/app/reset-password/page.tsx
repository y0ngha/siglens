import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCardShell } from '@/components/auth/AuthCardShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
    title: '비밀번호 재설정',
    description: `${SITE_NAME} 새 비밀번호 설정`,
    robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
    searchParams: Promise<{ token?: string }>;
}

const MISSING_TOKEN_MESSAGE =
    '재설정 링크가 올바르지 않습니다. 비밀번호 찾기를 다시 시도해주세요.';

export default async function ResetPasswordPage({
    searchParams,
}: ResetPasswordPageProps) {
    const params = await searchParams;
    const token = params.token ?? '';
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
            {token ? (
                <ResetPasswordForm token={token} />
            ) : (
                <div
                    role="alert"
                    className="border-ui-danger/30 bg-ui-danger/5 text-ui-danger rounded-md border p-3 text-sm"
                >
                    {MISSING_TOKEN_MESSAGE}
                </div>
            )}
        </AuthCardShell>
    );
}
