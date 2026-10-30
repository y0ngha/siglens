import { act, renderHook } from '@testing-library/react';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { MARKET_NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
import { useMarketNewsPagination } from '@/widgets/market-news/hooks/useMarketNewsPagination';

describe('useMarketNewsPagination', () => {
    it('첫 페이지 크기로 시작한다', () => {
        const { result } = renderHook(() => useMarketNewsPagination('general'));
        expect(result.current.visibleCount).toBe(MARKET_NEWS_LIST_PAGE_SIZE);
    });

    it('showMore는 한 페이지씩 늘린다', () => {
        const { result } = renderHook(() => useMarketNewsPagination('general'));
        act(() => result.current.showMore());
        expect(result.current.visibleCount).toBe(
            MARKET_NEWS_LIST_PAGE_SIZE * 2
        );
    });

    it('카테고리가 바뀌면 첫 페이지 크기로 되돌린다', () => {
        const { result, rerender } = renderHook(
            ({ category }: { category: NewsFeedCategoryId }) =>
                useMarketNewsPagination(category),
            { initialProps: { category: 'general' as NewsFeedCategoryId } }
        );
        act(() => result.current.showMore());
        rerender({ category: 'crypto' });
        expect(result.current.visibleCount).toBe(MARKET_NEWS_LIST_PAGE_SIZE);
    });
});
