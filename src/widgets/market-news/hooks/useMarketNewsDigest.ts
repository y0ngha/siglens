'use client';

/**
 * 마켓 뉴스 카테고리 다이제스트의 전체 수명주기를 `loading | done | error`로 접어 돌려주는 훅.
 */
import { useTranslations } from 'next-intl';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import { useState, startTransition, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { fetchMarketNewsDigest } from '../utils/fetchMarketNewsDigest';
import {
    resolveDigestState,
    toDigestError,
    type MarketNewsDigestState,
} from '../utils/digestState';
import { useMarketNewsAnalysisTrigger } from './useMarketNewsAnalysisTrigger';
import { useWaitForMarketNewsCards } from './useWaitForMarketNewsCards';

/**
 * 다이제스트 수명주기:
 *
 * 1. 마운트 때 `ensureMarketNewsCardsAnalyzedAction(category)`를 한 번 요청해 수집·보강을 시작한다
 *    (응답을 기다리지 않는다).
 * 2. 보강된 카드가 하나라도 생길 때까지 기다린다(SSR이 이미 보강 카드를 가졌으면
 *    `hasEnrichedNews`로 건너뛴다) — 빈 DB에 먼저 요청하면 `no_news`가 쿼리 캐시에 굳는다.
 * 3. 준비되면 `fetchMarketNewsDigest`가 SSE 한 연결로 결과를 받아온다.
 *
 * `peekSeed`(SSR이 읽은 캐시된 다이제스트)는 쿼리의 초기 데이터다. 그래서 시드가 있는 방문은
 * 요청을 보내지 않고, SSR HTML의 본문이 스켈레톤이나 오류 카드로 바뀌지도 않는다. 화면에
 * 있는 결과는 대기·재조회 실패보다 우선한다.
 *
 * 재시도는 실패한 단계를 다시 돈다 — 카드 대기가 실패했으면 대기와 수집 요청을 처음부터,
 * 다이제스트 조회가 실패했으면 그 조회만 다시.
 */
export function useMarketNewsDigest(
    category: NewsFeedCategoryId,
    hasEnrichedNews: boolean,
    peekSeed?: NewsAnalysisResponse | null
): MarketNewsDigestState {
    const tError = useTranslations('shared.ui.analysisError');
    const locale = useCurrentLocale();
    const streamMessages = useStreamErrorMessages();
    const [isHydrated, setIsHydrated] = useState(false);
    // 카드 대기 재시도 횟수 — 대기 폴러와 수집 요청이 이 값으로 처음부터 다시 시작한다.
    const [attempt, setAttempt] = useState(0);

    const { isReady: isCardsReady, waitError } = useWaitForMarketNewsCards(
        category,
        hasEnrichedNews,
        attempt
    );

    const query = useQuery({
        queryKey: QUERY_KEYS.marketNewsDigest(category, locale),
        queryFn: ({ signal }) =>
            fetchMarketNewsDigest(category, streamMessages, signal),
        initialData: peekSeed ?? undefined,
        // 하이드레이션과 보강된 카드를 기다린 뒤에 보낸다. 빈 DB에 보내면 곧바로 no_news가
        // 나오고 staleTime: Infinity가 그 오류를 새로고침 전까지 굳힌다.
        enabled: isHydrated && isCardsReady,
        retry: false,
        staleTime: Infinity,
    });

    useMarketNewsAnalysisTrigger(category, attempt);

    // 서버 렌더와 클라이언트 첫 렌더를 맞추려고 마운트 뒤에 켠다(하이드레이션 중 쿼리 발사 방지).
    useEffect(() => {
        startTransition(() => setIsHydrated(true));
    }, []);

    const { refetch } = query;
    const retry = () => {
        if (waitError !== null) {
            setAttempt(n => n + 1);
            return;
        }
        void refetch();
    };

    // 대기 실패의 원문('timeout', DB 오류 등)은 로그에만 남고 화면에는 일반 문구만 보인다.
    return resolveDigestState({
        result: query.data,
        waitError:
            waitError === null ? null : new Error(tError('digestFailed')),
        queryError: query.isError
            ? toDigestError(query.error, tError('digestFailed'))
            : null,
        retry,
    });
}
