import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { WatchlistPageContent } from '@/features/watchlist/ui/WatchlistPageContent';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

/**
 * `generateMetadata`인 이유는 `/portfolio`와 같다 — 정적 객체는 로케일을 못 봐서 `/en/watchlist`의
 * canonical이 한국어 경로로 나간다. noindex 페이지라도 canonical·og:url을 자기 자신으로 둔다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const title = tSeo('watchlist.title');
    const description = tSeo('watchlist.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, '/watchlist') },
        ...localePageSocial(locale, '/watchlist', { title, description }),
        // 개인화 서페이스라 색인 대상이 아니다 — 목록이 방문자(계정·기기)마다 다르다.
        robots: { index: false, follow: false },
    };
}

/**
 * 관심종목 페이지(관심종목 동선 설계 §3.1). 비회원에게도 열린다 — 목록의 출처(계정 DB 또는 기기
 * localStorage)는 `useWatchlist`가 숨긴다. 쿠키·DB를 읽지 않는 정적 셸이고 본문은 전부
 * 클라이언트에서 그린다. 보유종목은 `/portfolio`가 따로 맡는다.
 */
export default async function WatchlistPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    enterLocale(rawLocale);
    const t = await getTranslations('app.watchlist');
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
                        href="/portfolio"
                        prefetch={false}
                        className="inline-flex min-h-11 items-center rounded px-1 text-sm font-semibold text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('page.toPortfolio')}
                    </Link>
                </header>
                <WatchlistPageContent />
            </div>
        </main>
    );
}
