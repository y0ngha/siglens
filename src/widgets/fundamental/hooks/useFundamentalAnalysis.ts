'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    FundamentalAnalysisResponse,
    ModelId,
} from '@y0ngha/siglens-core';
import type { RunFundamentalAnalysisActionResult } from '@/entities/analysis/actions';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';

export type FundamentalAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | {
          status: 'done';
          result: FundamentalAnalysisResponse;
          trigger: () => void;
      }
    | { status: 'bot_blocked'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
async function fetchFundamentalAnalysis(
    symbol: string,
    modelId: ModelId,
    reasoning: boolean,
    signal?: AbortSignal
): Promise<FundamentalAnalysisResponse> {
    const result = await runAnalysisStream<RunFundamentalAnalysisActionResult>({
        type: 'fundamental',
        params: { symbol, modelId, reasoning },
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
        const message =
            result.code === 'fetch_failed'
                ? (result.error ?? '데이터를 불러오지 못했습니다.')
                : '사용량 한도를 초과했습니다.';
        throw new Error(message);
    }
    if (result.status === 'key_error') {
        throw new Error(result.error);
    }
    throw new Error('예상치 못한 오류가 발생했습니다.');
}

export function useFundamentalAnalysis(
    symbol: string,
    modelId: ModelId,
    /**
     * Member "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Defaults to `false`. Part of the query key so toggling
     * re-submits analysis (distinct cache key).
     */
    reasoning = false
): FundamentalAnalysisState {
    const queryClient = useQueryClient();
    const isHydrated = useHydrated();
    const queryKey = useMemo(
        () => QUERY_KEYS.fundamentalAnalysis(symbol, modelId, reasoning),
        [symbol, modelId, reasoning]
    );

    const query = useQuery({
        queryKey,
        queryFn: ({ signal, queryKey: [, qSymbol, qModelId, qReasoning] }) =>
            fetchFundamentalAnalysis(qSymbol, qModelId, qReasoning, signal),
        enabled: false,
        retry: false,
        staleTime: Infinity,
    });

    // §17 exception: `refetch` is destructured immediately after useQuery
    // because it feeds the useCallback below — derived values that are
    // consumed by subsequent hook calls must precede those hooks. The
    // `refetch` reference is stable across renders (React Query guarantee).
    const { refetch } = query;

    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);

    useEffect(() => {
        if (!isHydrated) return;
        if (queryClient.getQueryData(queryKey) === undefined) {
            void refetch();
        }
    }, [isHydrated, queryClient, queryKey, refetch]);

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

    if (query.data !== undefined) {
        return { status: 'done', result: query.data, trigger: retry };
    }

    return { status: 'loading', trigger: retry };
}
