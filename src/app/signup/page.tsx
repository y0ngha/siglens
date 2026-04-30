import { AuthCardShell } from '@/components/auth/AuthCardShell';
import { SignupForm } from '@/components/auth/SignupForm';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { sanitizeNextPath } from '@/domain/auth/redirect';
import { SITE_NAME } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: '회원가입',
    description: `${SITE_NAME} 회원이 되면 추가 혜택을 누릴 수 있어요. 가입은 옵션이며 비회원도 모든 기본 기능을 그대로 이용할 수 있습니다.`,
    robots: { index: false, follow: false },
};

interface SignupPageProps {
    searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
    const params = await searchParams;
    const next = sanitizeNextPath(params.next);
    const nextParam = next === '/' ? undefined : next;
    return (
        <AuthCardShell
            title="회원이 되면 더 많은 걸 볼 수 있어요"
            subtitle="Create your account"
            footer={
                <p>
                    이미 계정이 있으신가요?{' '}
                    <Link
                        href="/login"
                        className="font-medium text-blue-400 underline-offset-4 hover:text-blue-300 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                    >
                        로그인 →
                    </Link>
                </p>
            }
        >
            <SignupForm next={nextParam} />
            <SocialLoginButtons next={nextParam} />
        </AuthCardShell>
    );
}
