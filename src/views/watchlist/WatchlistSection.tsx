'use client';

import { useTranslations } from 'next-intl';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import type { WatchlistSort } from '@/features/watchlist/lib/sortWatchlist';
import { useConvertToHolding } from './hooks/useConvertToHolding';
import { useRemovedRowFocus } from './hooks/useRemovedRowFocus';
import { useSortedWatchlist } from './hooks/useSortedWatchlist';
import { isWatchlistListPending } from './lib/watchlistListState';
import { WatchlistRow } from './ui/list/WatchlistRow';
import {
    WatchlistEmptyState,
    WatchlistListSkeleton,
} from './ui/list/WatchlistListStatus';

interface WatchlistSectionProps {
    /** 정렬 기준. 등락률 순일 때만 모든 행의 시세를 한꺼번에 불러온다(그 외에는 보일 때만). */
    sort?: WatchlistSort;
}

/**
 * `/watchlist`의 관심 탭 목록. 비회원은 로컬 목록을 본다. 시세는 행이 뷰포트에 들어올 때만
 * 봉 캐시에서 파생한다(등락률 정렬을 고르면 그때 전부). "보유로 전환"은 회원만 —
 * `HoldingForm`을 심볼 채워 열고 저장 성공 시 관심 항목을 지운다. 행을 지우면(삭제·전환) 포커스는
 * 옆 행, 목록이 비면 빈 상태 안내로 옮긴다(`useRemovedRowFocus`).
 */
export function WatchlistSection({ sort = 'added' }: WatchlistSectionProps) {
    const t = useTranslations('features.watchlist');
    const { items, isHydrated, isIdentityPending, isMember, remove } =
        useWatchlist();
    const sorted = useSortedWatchlist(items, sort);
    // 지운 행의 옆 행을 고르려면 화면의 행 순서(`sorted`)가 필요하다 — 그래서 정렬 바로 뒤에 둔다.
    const {
        remove: removeRow,
        listRef,
        emptyStateRef,
    } = useRemovedRowFocus(
        sorted.map(item => item.symbol),
        remove
    );
    const { convert, isSaving } = useConvertToHolding(removeRow);

    if (
        isWatchlistListPending({
            isHydrated,
            isIdentityPending,
            itemCount: items.length,
        })
    ) {
        return <WatchlistListSkeleton />;
    }
    if (items.length === 0) {
        return <WatchlistEmptyState titleRef={emptyStateRef} />;
    }

    return (
        <ul ref={listRef} aria-label={t('section.list')} className="space-y-2">
            {sorted.map(item => (
                <WatchlistRow
                    key={item.symbol}
                    item={item}
                    isMember={isMember}
                    onRemove={symbol => void removeRow(symbol)}
                    onConvert={convert}
                    isSaving={isSaving}
                />
            ))}
        </ul>
    );
}
