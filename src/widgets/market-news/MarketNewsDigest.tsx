'use client';

/**
 * 카테고리 AI 다이제스트 — 훅이 돌려준 상태를 로딩·오류·결과 화면으로 나눠 그린다.
 */
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { useMarketNewsDigest } from './hooks/useMarketNewsDigest';
import { DigestErrorView } from './ui/digest/DigestErrorView';
import { DigestResultView } from './ui/digest/DigestResultView';
import { DigestStatusCard } from './ui/digest/DigestStatusCard';

export interface MarketNewsDigestProps {
    category: NewsFeedCategoryId;
    /**
     * SSR 스냅샷에 AI 보강이 끝난 카드가 하나라도 있는지. `false`면 훅이 보강을 기다린 뒤에
     * 다이제스트를 요청한다 — 빈 DB에 먼저 보내 `no_news`가 쿼리 캐시에 굳는 것을 막는다.
     */
    hasEnrichedNews: boolean;
    /**
     * SSR이 읽은 캐시된 다이제스트(`peekMarketNewsDigestStatic`), 미스면 `null`. 있으면 스켈레톤
     * 없이 SSR HTML에 바로 그려지고 쿼리의 초기 데이터가 되어 요청도 보내지 않는다.
     */
    peekSeed?: NewsAnalysisResponse | null;
}

/**
 * 카테고리 다이제스트. 수명주기는 `useMarketNewsDigest`가 맡는다(수집 요청 → 보강 카드 대기 →
 * 다이제스트 조회). 섹션은 상태마다 다른 제목 id를 가진다 — 로딩은
 * `market-news-digest-status-heading`, 오류는 `market-news-digest-error-heading`,
 * 결과는 `market-news-digest-heading`.
 */
export function MarketNewsDigest({
    category,
    hasEnrichedNews,
    peekSeed,
}: MarketNewsDigestProps) {
    const digest = useMarketNewsDigest(category, hasEnrichedNews, peekSeed);

    if (digest.status === 'error') {
        return <DigestErrorView error={digest.error} onRetry={digest.retry} />;
    }

    if (digest.status === 'loading') {
        return <DigestStatusCard />;
    }

    return <DigestResultView result={digest.result} />;
}
