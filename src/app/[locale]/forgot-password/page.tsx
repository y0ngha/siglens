import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ForgotPasswordForm } from '@/features/auth-password-reset/ui/ForgotPasswordForm';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { AuthCrossLink } from '@/shared/ui/auth/AuthCrossLink';

/**
 * 로케일별 메타데이터 — `/login`과 같은 이유로 정적 `metadata`가 아니고, noindex여도
 * canonical·og:url을 자기 자신으로 둔다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    const title = tSeo('forgotPassword.title');
    const description = tSeo('forgotPassword.description');
    return {
        title,
        description,
        alternates: {
            canonical: localeCanonical(locale, '/forgot-password'),
        },
        ...localePageSocial(locale, '/forgot-password', {
            title,
            description,
        }),
        robots: { index: false, follow: true },
    };
}

/** 비밀번호 재설정 메일 요청 페이지(게스트 전용). 쿼리를 읽지 않아 통째로 정적이다. */
export default async function ForgotPasswordPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    enterLocale(locale);
    const t = await getTranslations('app.forgot-password');
    return (
        <AuthCardShell
            title={t('page.313efe')}
            subtitle={t('page.dcacc5')}
            footer={
                <p>
                    <AuthCrossLink
                        href="/login"
                        className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('page.524fba')}
                    </AuthCrossLink>
                </p>
            }
        >
            <ForgotPasswordForm />
        </AuthCardShell>
    );
}
