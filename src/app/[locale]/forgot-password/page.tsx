import { AuthCrossLink } from '@/shared/ui/auth/AuthCrossLink';
import { getTranslations } from 'next-intl/server';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { resolveLocale } from '@/shared/i18n/locales';
import type { Metadata } from 'next';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { ForgotPasswordForm } from '@/features/auth-password-reset/ui/ForgotPasswordForm';
import { enterLocale } from '@/shared/lib/enterLocale';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/[locale]/login/page.tsx 주석 참조.
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
