'use client';

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FinancialsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import type { RunFinancialsAnalysisActionResult } from '@/entities/analysis/actions';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';

export type FinancialsAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | {
          status: 'done';
          result: FinancialsAnalysisResponse;
          trigger: () => void;
      }
    | { status: 'bot_blocked'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
async function fetchFinancialsAnalysis(
    symbol: string,
    modelId: ModelId,
    reasoning: boolean,
    signal?: AbortSignal
): Promise<FinancialsAnalysisResponse> {
    const result = await runAnalysisStream<RunFinancialsAnalysisActionResult>({
        type: 'financials',
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

export function useFinancialsAnalysis(
    symbol: string,
    modelId: ModelId,
    /**
     * Member "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Defaults to `false` — pre-toggle callers keep resolving
     * to the exact same query key as before. Part of the query key so
     * toggling re-submits analysis (distinct cache key).
     */
    reasoning = false
): FinancialsAnalysisState {
    const queryClient = useQueryClient();
    const isHydrated = useHydrated();

    // queryKey는 인라인으로 둔다(§17 훅 순서: useMemo는 useQuery보다 뒤여야 함).
    // React Query는 queryKey를 deep-equality로 비교하므로 매 렌더 새 배열 참조가
    // 생성돼도 불필요한 재페치가 발생하지 않는다.
    const query = useQuery({
        queryKey: QUERY_KEYS.financialsAnalysis(symbol, modelId, reasoning),
        queryFn: ({ signal, queryKey: [, qSymbol, qModelId, qReasoning] }) =>
            fetchFinancialsAnalysis(qSymbol, qModelId, qReasoning, signal),
        enabled: false,
        retry: false,
        staleTime: Infinity,
    });

    const { refetch } = query;

    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);

    useEffect(() => {
        if (!isHydrated) return;
        if (
            queryClient.getQueryData(
                QUERY_KEYS.financialsAnalysis(symbol, modelId, reasoning)
            ) === undefined
        ) {
            void refetch();
        }
    }, [isHydrated, queryClient, symbol, modelId, reasoning, refetch]);

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
