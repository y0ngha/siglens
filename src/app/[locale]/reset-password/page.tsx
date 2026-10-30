import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { AuthFormSkeleton } from '@/shared/ui/auth/AuthFormSkeleton';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ResetPasswordContent } from './ResetPasswordContent';

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
    const title = tSeo('resetPassword.title');
    const description = tSeo('resetPassword.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, '/reset-password') },
        ...localePageSocial(locale, '/reset-password', {
            title,
            description,
        }),
        robots: { index: false, follow: true },
    };
}

/**
 * 비밀번호 재설정 페이지(메일 링크로 들어오는 게스트 전용 화면). 쿼리(`email`·`token`) 읽기를
 * `ResetPasswordContent`('use client')로 격리해 라우트는 정적으로 prerender된다.
 */
export default async function ResetPasswordPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    enterLocale(locale);
    const t = await getTranslations('app.reset-password');
    return (
        <AuthCardShell
            title={t('page.921c49')}
            subtitle={t('page.e10323')}
            footer={
                <p>
                    <Link
                        href="/forgot-password"
                        className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('page.7ba818')}
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
