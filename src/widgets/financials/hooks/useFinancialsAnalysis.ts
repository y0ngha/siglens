'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FinancialsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import {
    submitFinancialsAnalysisAction,
    pollFinancialsAnalysisAction,
    cancelFinancialsAnalysisJobAction,
} from '@/entities/analysis/actions';
import { isGateBlockedResult } from '@/entities/analysis';
import { sleep } from '@/shared/lib/sleep';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import {
    ANALYSIS_POLL_INTERVAL_MS,
    ANALYSIS_POLL_MAX_DURATION_MS,
} from '@/shared/config/pollingConfig';
import { usePageHideCancel } from '@/shared/hooks/usePageHideCancel';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';
import type { CancelJobEntry } from '@/shared/lib/types';

export type FinancialsAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | {
          status: 'done';
          result: FinancialsAnalysisResponse;
          trigger: () => void;
      }
    | { status: 'bot_blocked'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

// onJobId는 두 번째 인자(expectedCurrent)를 받으면 ref가 일치할 때만 갱신한다 →
// retry/queryKey 변경으로 새 실행이 시작된 뒤에도 이전 실행의 finally가
// 새 jobId를 null로 덮어쓰지 않는다.
async function fetchFinancialsAnalysis(
    symbol: string,
    modelId: ModelId,
    reasoning: boolean,
    signal: AbortSignal,
    onJobId: (jobId: string | null, expectedCurrent?: string | null) => void
): Promise<FinancialsAnalysisResponse> {
    const submitted = await submitFinancialsAnalysisAction(
        symbol,
        modelId,
        reasoning
    );

    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }
    if (submitted.status === 'error') {
        if (isGateBlockedResult(submitted)) {
            throw new Error(submitted.error.message);
        }
        const message =
            submitted.code === 'fetch_failed'
                ? (submitted.error ?? '데이터를 불러오지 못했습니다.')
                : '사용량 한도를 초과했습니다.';
        throw new Error(message);
    }
    if (submitted.status === 'key_error') {
        throw new Error(submitted.error);
    }

    onJobId(submitted.jobId);
    const pollStart = Date.now();
    try {
        const { jobId } = submitted;
        while (!signal.aborted) {
            if (Date.now() - pollStart >= ANALYSIS_POLL_MAX_DURATION_MS) {
                throw new Error(
                    '분석이 너무 오래 걸립니다. 잠시 후 다시 시도해 주세요.'
                );
            }
            await sleep(ANALYSIS_POLL_INTERVAL_MS);
            if (signal.aborted) break;
            const polled = await pollFinancialsAnalysisAction(jobId);
            if (polled.status === 'done') return polled.result;
            if (polled.status === 'error') {
                throw new Error(polled.error ?? '분석 중 오류가 발생했습니다.');
            }
        }
    } finally {
        // 이 실행이 설정한 jobId가 ref에 그대로 있을 때만 null로 비운다.
        onJobId(null, submitted.jobId);
    }
    throw new Error('aborted');
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
    const currentJobIdRef = useRef<string | null>(null);
    const queryClient = useQueryClient();
    const isHydrated = useHydrated();

    // queryKey는 인라인으로 둔다(§17 훅 순서: useMemo는 useQuery보다 뒤여야 함).
    // React Query는 queryKey를 deep-equality로 비교하므로 매 렌더 새 배열 참조가
    // 생성돼도 불필요한 재페치가 발생하지 않는다.
    const query = useQuery({
        queryKey: QUERY_KEYS.financialsAnalysis(symbol, modelId, reasoning),
        queryFn: ({ signal, queryKey: [, qSymbol, qModelId, qReasoning] }) =>
            fetchFinancialsAnalysis(
                qSymbol,
                qModelId,
                qReasoning,
                signal,
                (jobId, expectedCurrent) => {
                    if (
                        expectedCurrent !== undefined &&
                        currentJobIdRef.current !== expectedCurrent
                    ) {
                        return;
                    }
                    currentJobIdRef.current = jobId;
                }
            ),
        enabled: false,
        retry: false,
        staleTime: Infinity,
    });

    const { refetch } = query;

    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);

    // ref를 null로 초기화해 unmount cleanup과의 이중 cancel을 방지한다.
    const getPageHideJobs = useCallback((): CancelJobEntry[] | null => {
        const jobId = currentJobIdRef.current;
        if (jobId === null) return null;
        currentJobIdRef.current = null;
        return [{ jobId, type: 'financials' as const }];
    }, []);
    usePageHideCancel(getPageHideJobs);

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

    // symbol/modelId/reasoning 변경(queryKey 교체) 시, unmount 시 진행 중인 job을 cancel한다.
    // fire-and-forget이므로 useMutation 없이 직접 호출한다.
    useEffect(() => {
        return () => {
            const jobId = currentJobIdRef.current;
            if (jobId !== null) {
                currentJobIdRef.current = null;
                void cancelFinancialsAnalysisJobAction(jobId).catch(error => {
                    console.warn(
                        '[useFinancialsAnalysis] cancel failed',
                        error
                    );
                });
            }
        };
    }, [symbol, modelId, reasoning]);

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
