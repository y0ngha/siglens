import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { PAGE_HEADER_LINK } from '../_personal/pageHeaderLink';
import { PortfolioMemberArea } from './_components/PortfolioMemberArea';
import { PortfolioSkeleton } from './_components/PortfolioStates';

/**
 * 로케일별 메타데이터. 정적 `metadata`는 로케일을 볼 수 없어 `/en/portfolio`의 canonical이
 * 한국어 URL로 나간다 — noindex 페이지에 다른 URL을 canonical로 걸면 Google이 noindex를 그
 * 대상으로 전파할 수 있다. noindex여도 canonical·og:url을 자기 자신으로 둔다.
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
    const title = tSeo('portfolio.title');
    const description = tSeo('portfolio.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, '/portfolio') },
        ...localePageSocial(locale, '/portfolio', {
            title,
            description,
        }),
        // 개인화 서페이스라 색인 대상이 아니다 — 비회원에게는 가입 CTA, 회원에게는 자기
        // 보유종목만 보인다.
        robots: { index: false, follow: false },
    };
}

/**
 * 보유종목 페이지. 머리말과 `/watchlist`로 가는 링크는 세션과 무관해 먼저 그리고, 세션 의존
 * 영역(`PortfolioMemberArea`)은 Suspense 안에서 채운다. 관심종목은 `/watchlist`가 따로 맡는다.
 */
export default async function PortfolioPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    const t = await getTranslations('app.portfolio');
    return (
        <main className="min-h-[calc(100dvh-var(--header-h))] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <header className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold text-secondary-50">
                            {t('page.title')}
                        </h1>
                        <p className="mt-1 text-sm text-secondary-400">
                            {t('page.subtitle')}
                        </p>
                    </div>
                    <Link
                        href="/watchlist"
                        prefetch={false}
                        className={PAGE_HEADER_LINK}
                    >
                        {t('page.toWatchlist')}
                    </Link>
                </header>
                <Suspense fallback={<PortfolioSkeleton />}>
                    <PortfolioMemberArea locale={locale} />
                </Suspense>
            </div>
        </main>
    );
}
