'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import {
    submitNewsAnalysisAction,
    pollNewsAnalysisAction,
    cancelNewsAnalysisJobAction,
} from '@/entities/news-article/actions';
import { isGateBlockedResult } from '@/entities/analysis';
import { sleep } from '@/shared/lib/sleep';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { ANALYSIS_POLL_INTERVAL_MS } from '@/shared/config/pollingConfig';
import { usePageHideCancel } from '@/shared/hooks/usePageHideCancel';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { BotBlockedError } from '@/shared/lib/BotBlockedError';
import type { CancelJobEntry } from '@/shared/lib/types';

export type NewsAnalysisState =
    | { status: 'loading'; trigger: () => void }
    | { status: 'done'; result: NewsAnalysisResponse; trigger: () => void }
    | { status: 'bot_blocked'; trigger: () => void }
    | { status: 'error'; error: Error; retry: () => void; trigger: () => void };

// AbortSignal로 unmount 시 폴링을 즉시 종료한다.
// onJobId는 두 번째 인자(expectedCurrent)를 받으면 ref가 일치할 때만 갱신한다 →
// retry/queryKey 변경으로 새 실행이 시작된 뒤에도 이전 실행의 finally가
// 새 jobId를 null로 덮어쓰지 않는다.
async function fetchNewsAnalysis(
    symbol: string,
    companyName: string,
    modelId: ModelId,
    reasoning: boolean,
    signal: AbortSignal,
    onJobId: (jobId: string | null, expectedCurrent?: string | null) => void
): Promise<NewsAnalysisResponse> {
    if (signal.aborted) throw new Error('aborted');
    const submitted = await submitNewsAnalysisAction(
        symbol,
        companyName,
        modelId,
        reasoning
    );

    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }
    if (submitted.status === 'error') {
        // Handle before the existing SubmitNewsAnalysisResult variants.
        if (isGateBlockedResult(submitted)) {
            throw new Error(submitted.error.message);
        }
        if (submitted.code === 'no_news') {
            throw new Error(
                '분석할 뉴스가 없습니다. 잠시 후 다시 시도해 주세요.'
            );
        }
        if (submitted.code === 'usage_limit_exceeded') {
            throw new Error(submitted.error.message);
        }
        throw new Error('분석 중 오류가 발생했습니다.');
    }
    if (submitted.status === 'key_error') {
        throw new Error(submitted.error);
    }

    onJobId(submitted.jobId);
    try {
        const { jobId } = submitted;
        while (!signal.aborted) {
            await sleep(ANALYSIS_POLL_INTERVAL_MS);
            if (signal.aborted) break;
            const polled = await pollNewsAnalysisAction(jobId);
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
}

export function useNewsAnalysis(
    symbol: string,
    companyName: string,
    modelId: ModelId,
    { enabled = true, reasoning = false }: UseNewsAnalysisOptions = {}
): NewsAnalysisState {
    const currentJobIdRef = useRef<string | null>(null);
    const isHydrated = useHydrated();
    const queryKey = useMemo(
        () => QUERY_KEYS.newsAnalysis(symbol, companyName, modelId, reasoning),
        [symbol, companyName, modelId, reasoning]
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
        enabled: isHydrated && enabled,
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

    // ref를 null로 초기화해 unmount cleanup과의 이중 cancel을 방지한다.
    const getPageHideJobs = useCallback((): CancelJobEntry[] | null => {
        const jobId = currentJobIdRef.current;
        if (jobId === null) return null;
        currentJobIdRef.current = null;
        return [{ jobId, type: 'news' as const }];
    }, []);
    usePageHideCancel(getPageHideJobs);

    // symbol 또는 modelId 변경(queryKey 교체) 시, unmount 시 진행 중인 job을 cancel한다.
    // fire-and-forget이므로 useMutation 없이 직접 호출한다.
    useEffect(() => {
        return () => {
            const jobId = currentJobIdRef.current;
            if (jobId !== null) {
                currentJobIdRef.current = null;
                void cancelNewsAnalysisJobAction(jobId).catch(error => {
                    console.warn('[useNewsAnalysis] cancel failed', error);
                });
            }
        };
    }, [queryKey]);

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
