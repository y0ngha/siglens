import { getTranslations } from 'next-intl/server';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { resolveLocale } from '@/shared/i18n/locales';
import { Suspense } from 'react';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { AuthFormSkeleton } from '@/shared/ui/auth/AuthFormSkeleton';
import { AuthCrossLink } from '@/shared/ui/auth/AuthCrossLink';
import type { Metadata } from 'next';
import { LoginContent } from './LoginContent';
import { enterLocale } from '@/shared/lib/enterLocale';

// noindex 페이지에도 canonical을 두는 이유: ?next=/path 같은 쿼리 변형 URL이 외부에 공유되더라도
// "원본은 /login 하나"라는 신호를 명확히 해 두면 일부 크롤러/공유 도구가 변형을 강조하지 않게 된다.
// openGraph.url을 명시해 두지 않으면 root layout의 og:url(SITE_URL)이 그대로 상속되어
// canonical과 og:url이 불일치한다(SEO 일관성 위반).
/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `/en/login`도 canonical이 `/login`(한국어)로 나갔다. noindex 페이지에
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
    const title = tSeo('login.title');
    const description = tSeo('login.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, '/login') },
        ...localePageSocial(locale, '/login', {
            title,
            description,
        }),
        robots: { index: false, follow: true },
    };
}

// searchParams 읽기를 LoginContent('use client')로 격리해 이 라우트는 full-static(○)으로 prerender된다.
// shell/footer/metadata는 정적, 쿼리 의존부만 Suspense 아래에서 CSR.
export default async function LoginPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    enterLocale(locale);
    const t = await getTranslations('app.login');
    return (
        <AuthCardShell
            title={t('page.9d6e84')}
            subtitle={t('page.2241cc')}
            footer={
                <div className="space-y-2">
                    <p>
                        <AuthCrossLink
                            href="/forgot-password"
                            className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('page.313efe')}
                        </AuthCrossLink>
                    </p>
                    <p>
                        {t('page.15bb24')}{' '}
                        <AuthCrossLink
                            href="/signup"
                            className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('page.49f561')}
                        </AuthCrossLink>
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
