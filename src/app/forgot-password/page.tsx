import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCardShell } from '@/components/auth/AuthCardShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
export const metadata: Metadata = {
    title: '비밀번호 찾기',
    description: `${SITE_NAME} 비밀번호 재설정 링크 발송`,
    alternates: { canonical: `${SITE_URL}/forgot-password` },
    openGraph: { url: `${SITE_URL}/forgot-password` },
    robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
    return (
        <AuthCardShell
            title="비밀번호를 잊으셨나요?"
            subtitle="가입하신 이메일로 재설정 링크를 보내드립니다"
            footer={
                <p>
                    <Link
                        href="/login"
                        className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                        ← 로그인으로 돌아가기
                    </Link>
                </p>
            }
        >
            <ForgotPasswordForm />
        </AuthCardShell>
    );
}
