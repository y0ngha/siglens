import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { AccountContent } from './_components/AccountContent';
import { AccountContentSkeleton } from './_components/AccountContentSkeleton';

/**
 * 로케일별 메타데이터. 정적 `metadata`는 로케일을 볼 수 없어 `/en/account`의 canonical이
 * 한국어 URL로 나간다 — noindex 페이지에 다른 URL을 canonical로 걸면 Google이 noindex를 그
 * 대상으로 전파할 수 있다. noindex여도 canonical·og:url을 자기 자신으로 둬, 쿼리가 붙은 변형
 * URL이 공유돼도 원본이 `/account` 하나라는 신호를 준다.
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
    const title = tSeo('account.title');
    const description = tSeo('account.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, '/account') },
        ...localePageSocial(locale, '/account', {
            title,
            description,
        }),
        robots: { index: false, follow: false },
    };
}

/**
 * 계정 설정 페이지. 비회원은 대개 프록시 전방 가드(`AUTH_REQUIRED_PATHS`)가 먼저 로그인으로
 * 보내고, 세션 쿠키는 있으나 세션이 유효하지 않은 경우는 `AccountContent`가 보낸다. 머리말은
 * 세션과 무관해 Suspense 밖에 둔다.
 */
export default async function AccountPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    const t = await getTranslations('app.account');
    return (
        <main className="min-h-[calc(100dvh-var(--header-h))] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-2xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold text-secondary-50">
                        {t('page.622fae')}
                    </h1>
                    <p className="mt-1 text-sm text-secondary-400">
                        {t('page.b8fd1b')}
                    </p>
                </header>
                <Suspense fallback={<AccountContentSkeleton />}>
                    <AccountContent locale={locale} />
                </Suspense>
            </div>
        </main>
    );
}
