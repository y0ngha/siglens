'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import type { SubmitNewsAnalysisActionResult } from '@/entities/news-article/actions';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';

export type NewsAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | { status: 'done'; result: NewsAnalysisResponse; trigger: () => void }
    | { status: 'bot_blocked'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
async function fetchNewsAnalysis(
    symbol: string,
    companyName: string,
    modelId: ModelId,
    reasoning: boolean,
    signal?: AbortSignal
): Promise<NewsAnalysisResponse> {
    const result = await runAnalysisStream<SubmitNewsAnalysisActionResult>({
        type: 'news',
        params: { symbol, companyName, modelId, reasoning },
        signal,
    });

    if (result.status === 'cached' || result.status === 'done')
        return result.result;
    if (result.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }
    if (result.status === 'error') {
        if (isGateBlockedResult(result)) {
            throw new Error(result.error.message);
        }
        if (result.code === 'no_news') {
            throw new Error(
                '분석할 뉴스가 없습니다. 잠시 후 다시 시도해 주세요.'
            );
        }
        if (result.code === 'usage_limit_exceeded') {
            throw new Error(result.error.message);
        }
        throw new Error('분석 중 오류가 발생했습니다.');
    }
    if (result.status === 'key_error') {
        throw new Error(result.error);
    }
    throw new Error('예상치 못한 오류가 발생했습니다.');
}

interface UseNewsAnalysisOptions {
    /**
     * 분석 submit을 트리거할지 여부. 기본값 `true`.
     *
     * `false` 일 때 useQuery는 비활성 — 호출자가 사전 조건(예: enriched news cards
     * 준비 완료)을 기다리는 동안 빈 DB에 대해 submit 이 fire되어 `no_news` 결과가
     * `retry: false + staleTime: Infinity` 정책 하에 영구 캐시되는 회귀를 막는다.
     */
    enabled?: boolean;
    /**
     * Member "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Defaults to `false`. Part of the query key so toggling
     * re-submits analysis (distinct cache key).
     */
    reasoning?: boolean;
    /**
     * `modelId`/`reasoning`이 확정값인지 여부 — 호출부에서
     * `useAnalysisSettingsHydrated()`로 넘긴다. 기본값 `true`는 단위 테스트용.
     */
    isSettingsHydrated?: boolean;
}

export function useNewsAnalysis(
    symbol: string,
    companyName: string,
    modelId: ModelId,
    {
        enabled = true,
        reasoning = false,
        isSettingsHydrated = true,
    }: UseNewsAnalysisOptions = {}
): NewsAnalysisState {
    const queryKey = QUERY_KEYS.newsAnalysis(
        symbol,
        companyName,
        modelId,
        reasoning
    );

    const query = useQuery({
        queryKey,
        queryFn: ({
            signal,
            queryKey: [, qSymbol, qCompanyName, qModelId, qReasoning],
        }) =>
            fetchNewsAnalysis(
                qSymbol,
                qCompanyName,
                qModelId,
                qReasoning,
                signal
            ),
        enabled: isSettingsHydrated && enabled,
        retry: false,
        staleTime: Infinity,
    });

    // §17 exception: `refetch` is destructured immediately after useQuery
    // because it feeds the useCallback below — derived values that are
    // consumed by subsequent hook calls must precede those hooks. The
    // `refetch` reference is stable across renders (React Query guarantee).
    const { refetch } = query;

    const retry = () => {
        void refetch();
    };

    if (query.isError) {
        if (query.error instanceof BotBlockedError) {
            return { status: 'bot_blocked', trigger: retry };
        }
        return {
            status: 'error',
            error:
                query.error instanceof Error
                    ? query.error
                    : new Error('분석 중 오류가 발생했습니다.'),
            retry,
            trigger: retry,
        };
    }

    // isFetching을 data보다 먼저 확인해야 background refetch(뉴스 갱신 후 재분석) 중에도
    // 스피너가 표시된다. data 체크를 먼저 두면 이전 결과가 그대로 노출되어 스피너가 뜨지 않는다.
    if (query.isFetching) {
        return { status: 'loading', trigger: retry };
    }

    if (query.data !== undefined) {
        return { status: 'done', result: query.data, trigger: retry };
    }

    return { status: 'loading', trigger: retry };
}
