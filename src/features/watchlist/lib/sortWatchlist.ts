import type { WatchlistItemView } from '@/entities/watchlist/model';

/** `/watchlist`가 고를 수 있는 정렬(선택 상자의 표시 순서). */
export const WATCHLIST_SORTS = ['added', 'change', 'name'] as const;
/** 정렬 이름. 선택 상자 값은 `isWatchlistSort`로 좁힌 뒤 이 타입으로 쓴다. */
export type WatchlistSort = (typeof WATCHLIST_SORTS)[number];

/** 임의 문자열(선택 상자 값 등)이 정렬 이름인가. */
export function isWatchlistSort(value: string): value is WatchlistSort {
    // 리터럴 튜플을 `readonly string[]`로 넓히는 것뿐이다(좁히는 단언이 아니다) — `includes`가
    // 임의의 문자열을 받게 하려는 것이고, 판정 결과가 곧 타입 가드다.
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
    switch (sort) {
        case 'name': {
            const collator = new Intl.Collator(locale);
            return items.toSorted((a, b) =>
                collator.compare(nameOf(a), nameOf(b))
            );
        }
        case 'change':
            return items.toSorted((a, b) => {
                const ca = changeOf(a);
                const cb = changeOf(b);
                if (ca === null && cb === null) return 0;
                if (ca === null) return 1;
                if (cb === null) return -1;
                return cb - ca;
            });
        case 'added':
            return [...items];
        default: {
            const unreachable: never = sort;
            return unreachable;
        }
    }
}
