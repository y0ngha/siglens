/**
 * `fetchCategoryPreviews`(React.cache) 요청 내 dedup을 고정한다 — 허브의 메타데이터와 본문이
 * 같은 카테고리를 읽어도 캐시 래퍼·DB 읽기는 한 번이다.
 *
 * vitest는 RSC 요청 스코프가 없어 실제 `React.cache`가 메모하지 않는다. 그래서 `cache`를
 * "요청 하나" 동안 인자로 메모하는 구현으로 바꾸고, 테스트마다 그 스코프를 비운다.
 */
const { requestMemo, mocks } = vi.hoisted(() => ({
    requestMemo: new Map<unknown, Map<string, unknown>>(),
    mocks: {
        cacheNonEmpty: vi.fn(
            (
                _keyParts: readonly string[],
                _sentinel: string,
                fetcher: () => Promise<unknown[]>
            ) => fetcher()
        ),
        getMarketNewsCards: vi.fn(),
    },
}));
vi.mock('react', async importOriginal => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
            return (...args: A): R => {
                const memo = requestMemo.get(fn) ?? new Map<string, unknown>();
                requestMemo.set(fn, memo);
                const key = JSON.stringify(args);
                if (!memo.has(key)) memo.set(key, fn(...args));
                return memo.get(key) as R;
            };
        },
    };
});
vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/cacheNonEmpty', () => ({
    cacheNonEmpty: mocks.cacheNonEmpty,
}));
vi.mock('@/entities/market-news/api/marketNewsRepository', () => ({
    getMarketNewsCards: mocks.getMarketNewsCards,
}));
vi.mock('@/widgets/news-hub/CategoryCard', () => ({
    PREVIEW_HEADLINE_LIMIT: 2,
}));
vi.mock('@/shared/lib/news/resolveNewsTitle', () => ({
    resolveNewsTitle: (row: { titleKo: string }) => row.titleKo,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCategoryPreviews } from '@/app/[locale]/news/_lib/categoryPreviews';

describe('fetchCategoryPreviews 요청 내 dedup', () => {
    beforeEach(() => {
        requestMemo.clear();
        vi.clearAllMocks();
        mocks.getMarketNewsCards.mockResolvedValue([{ titleKo: '헤드라인' }]);
    });

    it('같은 요청에서 두 번 불러도 cacheNonEmpty·getMarketNewsCards는 한 번이다', async () => {
        const first = await fetchCategoryPreviews('forex', 'ko');
        const second = await fetchCategoryPreviews('forex', 'ko');

        expect(second).toEqual(first);
        expect(mocks.cacheNonEmpty).toHaveBeenCalledTimes(1);
        expect(mocks.getMarketNewsCards).toHaveBeenCalledTimes(1);
    });

    it('카테고리가 다르면 따로 읽는다', async () => {
        await fetchCategoryPreviews('forex', 'ko');
        await fetchCategoryPreviews('crypto', 'ko');

        expect(mocks.cacheNonEmpty).toHaveBeenCalledTimes(2);
    });
});
