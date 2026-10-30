'use client';

import { useTranslations } from 'next-intl';
import { useOpenTickerSearch } from '../../hooks/useOpenTickerSearch';

/**
 * `HomeWatchlistItems`가 PC 격자 끝에 붙이는 "+ 추가" 칸. 별도 추가 화면을 두지 않고 헤더의
 * 종목 검색을 재사용해 담는 길을 하나로 유지한다.
 */
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
