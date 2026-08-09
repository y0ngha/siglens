'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { OptionsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import type { SubmitOptionsAnalysisActionResult } from '@/entities/options-chain/actions';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

export type OptionsAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | { status: 'done'; result: OptionsAnalysisResponse; trigger: () => void }
    | { status: 'bot_blocked'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
async function fetchOptionsAnalysis(
    symbol: string,
    companyName: string,
    expirationDate: OptionsExpirationSelector,
    modelId: ModelId,
    reasoning: boolean,
    signal?: AbortSignal
): Promise<OptionsAnalysisResponse> {
    const result = await runAnalysisStream<SubmitOptionsAnalysisActionResult>({
        type: 'options',
        params: { symbol, companyName, expirationDate, modelId, reasoning },
        signal,
    });

    if (result.status === 'cached' || result.status === 'done')
        return result.result;
    if (result.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }
    if (result.status === 'no_chains_error') {
        throw new Error(result.error ?? '분석할 옵션 데이터가 없습니다.');
    }
    if (result.status === 'limit_error') {
        throw new Error(result.error.message);
    }
    if (result.status === 'error' && isGateBlockedResult(result)) {
        throw new Error(result.error.message);
    }
    if (result.status === 'key_error') {
        throw new Error(result.error);
    }
    throw new Error('예상치 못한 오류가 발생했습니다.');
}

interface UseOptionsAnalysisInput {
    symbol: string;
    companyName: string;
    expirationDate: OptionsExpirationSelector;
    modelId: ModelId;
    /**
     * Member "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Defaults to `false`. Part of the query key so toggling
     * re-submits analysis (distinct cache key).
     */
    reasoning?: boolean;
}

/**
 * Run hook for options analysis.
 *
 * Mirrors `useFundamentalAnalysis` structurally: auto-triggers on mount if no
 * cached data exists.
 */
export function useOptionsAnalysis({
    symbol,
    companyName,
    expirationDate,
    modelId,
    reasoning = false,
}: UseOptionsAnalysisInput): OptionsAnalysisState {
    const queryClient = useQueryClient();
    const isHydrated = useHydrated();
    const queryKey = useMemo(
        () =>
            QUERY_KEYS.optionsAnalysis(
                symbol,
                companyName,
                expirationDate,
                modelId,
                reasoning
            ),
        [symbol, companyName, expirationDate, modelId, reasoning]
    );

    const query = useQuery({
        queryKey,
        queryFn: ({
            signal,
            queryKey: [
                ,
                qSymbol,
                qCompanyName,
                qExpiration,
                qModelId,
                qReasoning,
            ],
        }) =>
            fetchOptionsAnalysis(
                qSymbol,
                qCompanyName,
                qExpiration,
                qModelId,
                qReasoning,
                signal
            ),
        enabled: false,
        retry: false,
        staleTime: Infinity,
    });

    // §17 exception: `refetch` is destructured immediately after useQuery
    // because it feeds the useCallback below — derived values that are
    // consumed by subsequent hook calls must precede those hooks. The
    // `refetch` reference is stable across renders (React Query guarantee),
    // so this preserves the spirit of §17 (no unstable derived values in
    // hook deps).
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
