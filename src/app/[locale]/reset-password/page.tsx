import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
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
export default async function ResetPasswordPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    return (
        <AuthCardShell
            title="새 비밀번호 설정"
            subtitle="이전 비밀번호와 다른 값으로 설정해주세요"
            footer={
                <p>
                    <Link
                        href="/forgot-password"
                        className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
