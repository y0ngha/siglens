import { getTranslations } from 'next-intl/server';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { WatchlistPageContent } from '@/views/watchlist/WatchlistPageContent';
import { PAGE_HEADER_LINK } from '@/app/[locale]/_personal/pageHeaderLink';

/**
 * `/watchlist` 본문 셸(제목·`/portfolio` 링크 + 클라이언트 목록). 쿠키·DB를 읽지 않는 정적
 * 셸이고 목록의 출처(계정 DB 또는 기기 localStorage)는 `useWatchlist`가 숨긴다.
 */
export async function WatchlistShell() {
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
                        className={PAGE_HEADER_LINK}
                    >
                        {t('page.toPortfolio')}
                    </Link>
                </header>
                <WatchlistPageContent />
            </div>
        </main>
    );
}
