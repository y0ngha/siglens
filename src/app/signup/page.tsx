import { Suspense } from 'react';

import { AuthCardShell, AuthFormSkeleton } from '@/shared/ui/auth';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupContent } from './SignupContent';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
export const metadata: Metadata = {
    title: '회원가입',
    description: `${SITE_NAME} 회원이 되면 추가 혜택을 누릴 수 있어요. 가입은 옵션이며 비회원도 모든 기본 기능을 그대로 이용할 수 있습니다.`,
    alternates: { canonical: `${SITE_URL}/signup` },
    openGraph: { url: `${SITE_URL}/signup` },
    robots: { index: false, follow: true },
};

// searchParams 읽기를 SignupContent('use client')로 격리해 이 라우트는 full-static(○)으로 prerender된다.
export default function SignupPage() {
    return (
        <AuthCardShell
            title="회원이 되면 더 많은 걸 볼 수 있어요"
            subtitle="이메일로 시작하기"
            footer={
                <p>
                    이미 계정이 있으신가요?{' '}
                    <Link
                        href="/login"
                        className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                        로그인 →
                    </Link>
                </p>
            }
        >
            <Suspense fallback={<AuthFormSkeleton rows={3} />}>
                <SignupContent />
            </Suspense>
        </AuthCardShell>
    );
}
