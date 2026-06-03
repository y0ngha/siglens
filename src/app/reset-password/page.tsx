import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthCardShell, AuthFormSkeleton } from '@/shared/ui/auth';
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
