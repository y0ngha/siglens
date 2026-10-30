import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { AuthCrossLink } from '@/shared/ui/auth/AuthCrossLink';
import { AuthFormSkeleton } from '@/shared/ui/auth/AuthFormSkeleton';
import { SignupContent } from './SignupContent';

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
    const title = tSeo('signup.title');
    const description = tSeo('signup.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, '/signup') },
        ...localePageSocial(locale, '/signup', {
            title,
            description,
        }),
        robots: { index: false, follow: true },
    };
}

/**
 * 회원가입 페이지(게스트 전용). 쿼리 읽기를 `SignupContent`('use client')로 격리해 라우트는
 * 정적으로 prerender된다.
 */
export default async function SignupPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    enterLocale(locale);
    const t = await getTranslations('app.signup');
    return (
        <AuthCardShell
            title={t('page.925d56')}
            subtitle={t('page.1c6c68')}
            footer={
                <p>
                    {t('page.9922a0')}{' '}
                    <AuthCrossLink
                        href="/login"
                        className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('page.e2d231')}
                    </AuthCrossLink>
                </p>
            }
        >
            <Suspense fallback={<AuthFormSkeleton rows={3} />}>
                <SignupContent />
            </Suspense>
        </AuthCardShell>
    );
}
