'use client';

import { useTranslations } from 'next-intl';
import { useOpenTickerSearch } from '../../hooks/useOpenTickerSearch';

/** 홈 카드 PC 격자의 마지막 칸 "+ 추가" — 누르면 헤더 종목 검색을 연다. */
export function HomeWatchlistAddCard() {
    const t = useTranslations('features.watchlist');
    const openSearch = useOpenTickerSearch();
    return (
        <button
            type="button"
            onClick={openSearch}
            className="flex size-full min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-control text-sm text-secondary-300 transition-colors hover:border-primary-500 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            <span aria-hidden="true" className="text-xl leading-none">
                +
            </span>
            {t('common.add')}
        </button>
    );
}
