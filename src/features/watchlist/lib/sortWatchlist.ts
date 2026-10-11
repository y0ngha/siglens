import type { WatchlistItemView } from '@/entities/watchlist/model';

export const WATCHLIST_SORTS = ['added', 'change', 'name'] as const;
export type WatchlistSort = (typeof WATCHLIST_SORTS)[number];

export function isWatchlistSort(value: string): value is WatchlistSort {
    return (WATCHLIST_SORTS as readonly string[]).includes(value);
}

interface SortAccessors {
    /** 화면에 보이는 이름(이름 순 정렬 기준). */
    nameOf: (item: WatchlistItemView) => string;
    /** 등락률(%). 시세를 아직 모르면 null — 이런 행은 맨 뒤로 간다. */
    changeOf: (item: WatchlistItemView) => number | null;
    /** 이름 비교에 쓸 로케일. 실행 환경의 기본 로케일에 기대면 한글·영문 순서가 서버·기기마다 갈린다. */
    locale: string;
}

/**
 * 관심종목 목록 정렬. 입력(`useWatchlist`의 `items`)은 이미 담은 순(최근 것부터)이라 `added`는
 * 그대로 돌려준다. 정렬은 저장하지 않는다 — 보는 동안만의 선택이다.
 */
export function sortWatchlistItems(
    items: readonly WatchlistItemView[],
    sort: WatchlistSort,
    { nameOf, changeOf, locale }: SortAccessors
): WatchlistItemView[] {
    if (sort === 'name') {
        const collator = new Intl.Collator(locale);
        return items.toSorted((a, b) => collator.compare(nameOf(a), nameOf(b)));
    }
    if (sort === 'change') {
        return items.toSorted((a, b) => {
            const ca = changeOf(a);
            const cb = changeOf(b);
            if (ca === null && cb === null) return 0;
            if (ca === null) return 1;
            if (cb === null) return -1;
            return cb - ca;
        });
    }
    return [...items];
}
