import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { ForgotPasswordForm } from '@/features/auth-password-reset';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
export const metadata: Metadata = {
    title: '비밀번호 찾기',
    description: `${SITE_NAME} 비밀번호 재설정 링크 발송`,
    alternates: { canonical: `${SITE_URL}/forgot-password` },
    openGraph: { url: `${SITE_URL}/forgot-password` },
    robots: { index: false, follow: true },
};

export default async function ForgotPasswordPage({
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
            title="비밀번호를 잊으셨나요?"
            subtitle="가입하신 이메일로 재설정 링크를 보내드립니다"
            footer={
                <p>
                    <Link
                        href="/login"
                        className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
