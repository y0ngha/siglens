import { Suspense } from 'react';
import { AuthCardShell, AuthFormSkeleton } from '@/shared/ui/auth';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginContent } from './LoginContent';

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

// searchParams 읽기를 LoginContent('use client')로 격리해 이 라우트는 full-static(○)으로 prerender된다.
// shell/footer/metadata는 정적, 쿼리 의존부만 Suspense 아래에서 CSR.
export default function LoginPage() {
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
            <Suspense fallback={<AuthFormSkeleton rows={2} />}>
                <LoginContent />
            </Suspense>
        </AuthCardShell>
    );
}
