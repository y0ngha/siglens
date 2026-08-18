'use client';

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OptionsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import type { SubmitOptionsAnalysisActionResult } from '@/entities/options-chain/actions';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
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
    signal?: AbortSignal,
    cacheOnly?: boolean
): Promise<OptionsAnalysisResponse> {
    const result = await runAnalysisStream<SubmitOptionsAnalysisActionResult>({
        type: 'options',
        params: {
            symbol,
            companyName,
            expirationDate,
            modelId,
            reasoning,
            cacheOnly,
        },
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
    /**
     * `modelId`/`reasoning`이 확정값인지 여부 — 호출부에서
     * `useAnalysisSettingsHydrated()`로 넘긴다. 기본값 `true`는 단위 테스트용.
     */
    isSettingsHydrated?: boolean;
    /**
     * 캐시에 있으면 읽고, 없으면 새 분석을 만들지 않는다(miss → `bot_blocked`).
     *
     * OI가 stale할 때 쓴다: 그 입력으로 새 분석을 태우면 저품질 결과에 비용까지
     * 드는 반면, 장중에 만들어둔 캐시는 정상 결과라 챗봇 컨텍스트로 쓸 수 있다.
     *
     * queryKey에는 넣지 않는다 — 같은 (symbol, expiration, model, reasoning)에
     * 대해 payload가 달라지지 않고, `oiStale`은 한 페이지 렌더 안에서 고정이라
     * 한 세션에서 두 모드가 같은 키를 두고 경쟁하지 않는다.
     */
    cacheOnly?: boolean;
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
    isSettingsHydrated = true,
    cacheOnly = false,
}: UseOptionsAnalysisInput): OptionsAnalysisState {
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
                signal,
                cacheOnly
            ),
        // 캐시가 없을 때만 1회 자동 실행한다. staleTime: Infinity라 캐시가 있으면
        // 조용히 재사용되고(재요청 없음), 포커스/재연결 재요청은 꺼서 실패 이후
        // 창 포커스만으로 AI 분석이 다시 도는 것을 막는다. 수동 재시도는 retry().
        enabled: isSettingsHydrated,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
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
