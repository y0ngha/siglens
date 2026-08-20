import { getTranslations } from 'next-intl/server';
import { localeCanonical } from '@/shared/lib/seoAlternates';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { ForgotPasswordForm } from '@/features/auth-password-reset';
import { SITE_NAME } from '@/shared/lib/seo';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `/en/forgot-password`도 canonical이 `/forgot-password`(한국어)로 나갔다. noindex 페이지에
 * 다른 URL을 canonical로 걸면 Google이 noindex를 그 대상으로 전파할 수 있다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    return {
        title: '비밀번호 찾기',
        description: `${SITE_NAME} 비밀번호 재설정 링크 발송`,
        alternates: {
            canonical: localeCanonical(resolved, '/forgot-password'),
        },
        openGraph: { url: localeCanonical(resolved, '/forgot-password') },
        robots: { index: false, follow: true },
    };
}

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
    const t = await getTranslations('app.forgot-password');
    return (
        <AuthCardShell
            title={t('page.313efe')}
            subtitle={t('page.dcacc5')}
            footer={
                <p>
                    <Link
                        href="/login"
                        className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('page.524fba')}
                    </Link>
                </p>
            }
        >
            <ForgotPasswordForm />
        </AuthCardShell>
    );
}
