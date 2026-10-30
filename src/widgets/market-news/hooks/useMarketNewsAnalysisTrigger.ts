'use client';

/**
 * 마켓 뉴스 수집·AI 보강을 서버에 요청하는 훅.
 */
import { useEffect, useRef } from 'react';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { ensureMarketNewsCardsAnalyzedAction } from '@/entities/market-news/actions/ensureMarketNewsCardsAnalyzedAction';

/**
 * 마운트 때(그리고 카테고리나 `attempt`가 바뀔 때마다) `ensureMarketNewsCardsAnalyzedAction`을
 * 한 번 호출한다. 응답을 기다리지 않고 실패는 로그만 남긴다 — 수집이 실패해도 폴링이 비어
 * 있을 뿐 소비자가 반응할 일은 없다. 재시도가 `attempt`를 올리면 수집도 다시 요청된다.
 */
export function useMarketNewsAnalysisTrigger(
    category: NewsFeedCategoryId,
    attempt: number
): void {
    const triggeredRef = useRef<string | null>(null);

    useEffect(() => {
        const token = `${category}:${attempt}`;
        if (triggeredRef.current === token) return;
        triggeredRef.current = token;
        void ensureMarketNewsCardsAnalyzedAction(category).catch(
            (e: unknown) => {
                console.error(
                    '[useMarketNewsAnalysisTrigger] ensureMarketNewsCardsAnalyzedAction failed:',
                    e
                );
            }
        );
    }, [category, attempt]);
}
