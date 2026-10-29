'use client';

import { useTranslations } from 'next-intl';
import { useOpenTickerSearch } from '@/features/watchlist/hooks/useOpenTickerSearch';
import { WATCHLIST_ROW_CHROME } from '@/features/watchlist/lib/watchlistStyles';
import { cn } from '@/shared/lib/cn';
import { LINK_ACCENT } from '@/shared/lib/linkStyles';

/** 로딩 자리표시 행 수 — 목록이 오기 전 화면이 비어 보이지 않을 만큼만. */
const SKELETON_ROW_KEYS = [0, 1] as const;

/** 관심 목록이 확정되기 전의 로딩 상태. 스크린 리더에는 문장 하나로 알린다. */
export function WatchlistListSkeleton() {
    const t = useTranslations('features.watchlist');
    return (
        <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">{t('section.loading')}</span>
            <div className="space-y-2" aria-hidden="true">
                {SKELETON_ROW_KEYS.map(key => (
                    <div
                        key={key}
                        className={cn(
                            WATCHLIST_ROW_CHROME,
                            'h-16 animate-pulse'
                        )}
                    />
                ))}
            </div>
        </div>
    );
}

/** 담은 종목이 없을 때의 안내와 종목 검색 버튼. */
export function WatchlistEmptyState() {
    const t = useTranslations('features.watchlist');
    const openSearch = useOpenTickerSearch();
    return (
        <div className="rounded-lg border border-dashed border-secondary-700 px-4 py-8 text-center text-sm text-secondary-400">
            <p className="font-medium text-secondary-200">
                {t('section.empty')}
            </p>
            <p className="mt-1">{t('common.emptyBody')}</p>
            <button
                type="button"
                onClick={openSearch}
                className={cn(
                    LINK_ACCENT,
                    'mt-3 inline-flex min-h-11 items-center rounded px-2'
                )}
            >
                {t('common.search')}
            </button>
        </div>
    );
}
