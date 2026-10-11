'use client';

import { useTranslations } from 'next-intl';
import { useInViewOnce } from '@/shared/hooks/useInViewOnce';
import { cn } from '@/shared/lib/cn';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import {
    useWatchlistPreview,
    type WatchlistPreviewItem,
} from '../hooks/useWatchlistPreview';
import { WATCHLIST_ROW_CHROME } from '../lib/watchlistStyles';
import { MiniQuote, MiniTrend } from './MiniQuoteRow';
import { WatchlistToggleButton } from './WatchlistToggleButton';

interface RecentRowProps {
    item: WatchlistPreviewItem;
}

function RecentRow({ item }: RecentRowProps) {
    const [setNode, isVisible] = useInViewOnce<HTMLLIElement>();
    return (
        <li
            ref={setNode}
            className={cn(WATCHLIST_ROW_CHROME, 'flex items-center gap-3')}
        >
            <Link
                href={`/${item.symbol}`}
                prefetch={false}
                className="min-w-0 flex-1 rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <span className="block truncate font-semibold text-secondary-100 transition-colors hover:text-primary-300">
                    {item.name}
                </span>
                <span className="mt-0.5 block font-mono text-xs text-secondary-400">
                    {item.symbol}
                </span>
            </Link>
            <MiniTrend
                symbol={item.symbol}
                enabled={isVisible}
                className="hidden h-8 w-28 sm:block"
            />
            <span className="w-24 shrink-0">
                <MiniQuote symbol={item.symbol} enabled={isVisible} />
            </span>
            <WatchlistToggleButton
                symbol={item.symbol}
                label={item.name}
                source="watchlist_page"
            />
        </li>
    );
}

/** `/watchlist` 최근 본 탭. 기기 로컬 기록이라 로그인 여부와 무관하다. 행의 ☆로 바로 담는다. */
export function RecentSymbolsList() {
    const t = useTranslations('features.watchlist');
    const { recent } = useWatchlistPreview();
    if (recent.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-secondary-700 px-4 py-8 text-center text-sm text-secondary-400">
                {t('preview.emptyRecent')}
            </p>
        );
    }
    return (
        <ul aria-label={t('preview.tabRecent')} className="space-y-2">
            {recent.map(item => (
                <RecentRow key={item.symbol} item={item} />
            ))}
        </ul>
    );
}
