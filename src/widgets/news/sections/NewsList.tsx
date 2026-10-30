'use client';

/**
 * 종목 뉴스 목록 섹션 — 폴링 훅의 결과를 로딩·빈 상태·목록(+더보기)으로 나눠 조립한다.
 * 카드와 스켈레톤은 `ui/news-list/`, 카드 표시 값은 `utils/newsCardView`에 있다.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
import { useNewsPollingWithInvalidation } from '../hooks/useNewsPollingWithInvalidation';
import { NewsCard } from '../ui/news-list/NewsCard';
import { NewsListEmpty } from '../ui/news-list/NewsListEmpty';
import { NewsListHeading } from '../ui/news-list/NewsListHeading';
import { NewsListLoadingState } from '../ui/news-list/NewsListLoadingState';
import { NewsRefreshStatusCard } from '../ui/news-list/NewsRefreshStatusCard';

interface NewsListProps {
    items: NewsDisplayItem[];
    symbol: string;
}

/** 폴링이 계속 실패하면 가까운 에러 바운더리로 던진다. */
export function NewsList({ items: initialItems, symbol }: NewsListProps) {
    const t = useTranslations('widgets.news');
    const [visibleCount, setVisibleCount] = useState(NEWS_LIST_PAGE_SIZE);
    // 마지막으로 그린 심볼 — 클라이언트 내비게이션은 컴포넌트를 유지한 채 새 심볼의
    // `initialItems`를 내려주므로 "더보기" 개수를 렌더 중에 다시 맞춘다.
    const [prevSymbol, setPrevSymbol] = useState(symbol);

    if (prevSymbol !== symbol) {
        setPrevSymbol(symbol);
        setVisibleCount(NEWS_LIST_PAGE_SIZE);
    }

    const { items, isPolling, pollError } = useNewsPollingWithInvalidation(
        symbol,
        initialItems
    );

    // 영구 폴링 오류는 빈 목록이 끝없이 이어지는 대신 에러 바운더리의 폴백이 맡게 한다.
    if (pollError !== null) {
        throw pollError;
    }

    if (items.length === 0) {
        return isPolling ? <NewsListLoadingState /> : <NewsListEmpty />;
    }

    return (
        <section
            aria-labelledby="news-list-heading"
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <NewsListHeading />
            {isPolling ? <NewsRefreshStatusCard /> : null}
            <ul className="space-y-3">
                {items.slice(0, visibleCount).map(item => (
                    <li key={item.id}>
                        <NewsCard item={item} />
                    </li>
                ))}
            </ul>
            {visibleCount < items.length && (
                <button
                    type="button"
                    onClick={() =>
                        setVisibleCount(c => c + NEWS_LIST_PAGE_SIZE)
                    }
                    className="w-full rounded-lg border border-border-control py-2 text-sm text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('NewsList.8e5a3a', { v0: items.length - visibleCount })}
                </button>
            )}
        </section>
    );
}
