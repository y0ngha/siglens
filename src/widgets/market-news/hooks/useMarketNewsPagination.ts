'use client';

/**
 * 마켓 뉴스 목록의 "더보기" 개수 상태.
 */
import { useState } from 'react';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { MARKET_NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';

export interface UseMarketNewsPaginationReturn {
    visibleCount: number;
    showMore: () => void;
}

/**
 * 보이는 카드 수를 들고, 카테고리가 바뀌면 첫 페이지로 되돌린다. 클라이언트 내비게이션은
 * 컴포넌트를 유지한 채 새 카테고리의 스냅샷을 내려주므로 렌더 중에 다시 맞춘다.
 */
export function useMarketNewsPagination(
    category: NewsFeedCategoryId
): UseMarketNewsPaginationReturn {
    const [visibleCount, setVisibleCount] = useState(
        MARKET_NEWS_LIST_PAGE_SIZE
    );
    const [prevCategory, setPrevCategory] = useState(category);

    if (prevCategory !== category) {
        setPrevCategory(category);
        setVisibleCount(MARKET_NEWS_LIST_PAGE_SIZE);
    }

    return {
        visibleCount,
        showMore: () => setVisibleCount(c => c + MARKET_NEWS_LIST_PAGE_SIZE),
    };
}
