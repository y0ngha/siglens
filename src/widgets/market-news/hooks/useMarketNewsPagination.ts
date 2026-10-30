'use client';

/**
 * 카테고리 전환 때 이전 카테고리에서 펼친 개수가 새 목록에 남지 않게 하려고 분리했다.
 */
import { useState } from 'react';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { MARKET_NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';

export interface UseMarketNewsPaginationReturn {
    visibleCount: number;
    showMore: () => void;
}

/**
 * 클라이언트 내비게이션은 컴포넌트를 유지한 채 새 카테고리의 스냅샷을 내려주므로, 효과가
 * 아니라 렌더 중에 첫 페이지로 되돌려 한 프레임이라도 옛 개수가 새 목록에 보이지 않게 한다.
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
