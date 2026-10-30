'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import {
    isWatchlistSort,
    WATCHLIST_SORTS,
    type WatchlistSort,
} from '@/features/watchlist/lib/sortWatchlist';
import { NativeSelect } from '@/shared/ui/NativeSelect';

interface WatchlistSortSelectProps {
    value: WatchlistSort;
    onChange: (next: WatchlistSort) => void;
}

/** 관심 탭의 정렬 선택(라벨 + 네이티브 셀렉트). 옵션 순서는 `WATCHLIST_SORTS`를 따른다. */
export function WatchlistSortSelect({
    value,
    onChange,
}: WatchlistSortSelectProps) {
    const t = useTranslations('features.watchlist');
    const id = useId();
    // 키를 정적으로 적는다 — i18n 추출기는 변수로 넘긴 키를 따라가지 못한다.
    const optionLabel: Record<WatchlistSort, string> = {
        added: t('page.sortAdded'),
        change: t('page.sortChange'),
        name: t('page.sortName'),
    };
    return (
        <>
            <label htmlFor={id} className="text-sm text-secondary-400">
                {t('page.sort')}
            </label>
            <NativeSelect
                wrapperClassName="w-32"
                id={id}
                value={value}
                onChange={event => {
                    const next = event.target.value;
                    if (isWatchlistSort(next)) onChange(next);
                }}
            >
                {WATCHLIST_SORTS.map(sort => (
                    <option key={sort} value={sort}>
                        {optionLabel[sort]}
                    </option>
                ))}
            </NativeSelect>
        </>
    );
}
