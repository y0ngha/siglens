import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { AuthCrossLink } from '@/shared/ui/auth/AuthCrossLink';
import { AuthFormSkeleton } from '@/shared/ui/auth/AuthFormSkeleton';
import { LoginContent } from './LoginContent';

/**
 * 로케일별 메타데이터. 정적 `metadata`는 로케일을 볼 수 없어 `/en/login`의 canonical이 한국어
 * URL로 나간다 — noindex 페이지에 다른 URL을 canonical로 걸면 Google이 noindex를 그 대상으로
 * 전파할 수 있다. noindex여도 canonical을 두는 이유: `?next=/path` 같은 쿼리 변형 URL이 외부에
 * 공유돼도 원본이 `/login` 하나라는 신호를 준다. og:url도 같은 값으로 둔다 — 비우면 루트
 * 레이아웃의 og:url(홈)을 상속해 canonical과 어긋난다.
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

/**
 * 로그인 페이지(게스트 전용 — 세션이 있으면 프록시가 `next`로 돌려보낸다). 쿼리 읽기를
 * `LoginContent`('use client')로 격리해 라우트는 정적으로 prerender되고, 카드·푸터는 정적,
 * 쿼리 의존부만 Suspense 아래에서 CSR로 그린다.
 */
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
                            className="tap-target font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('page.313efe')}
                        </AuthCrossLink>
                    </p>
                    <p>
                        {t('page.15bb24')}{' '}
                        <AuthCrossLink
                            href="/signup"
                            className="tap-target font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
