'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    ModelId,
    OverallAnalysisResponse,
    OverallAxis,
    Timeframe,
} from '@y0ngha/siglens-core';
import { submitOverallAnalysisAction } from '@/infrastructure/market/submitOverallAnalysisAction';
import { pollOverallAnalysisAction } from '@/infrastructure/market/pollOverallAnalysisAction';
import { sleep } from '@/lib/sleep';
import { QUERY_KEYS } from '@/lib/queryConfig';
import {
    AUGMENT_AND_OVERALL_POLL_INTERVAL_MS,
    MAX_DEPENDENCY_RETRIES,
} from '@/lib/pollingConfig';
import { MS_PER_SECOND } from '@/domain/constants/time';
import type {
    OverallAnalysisState,
    ProgressState,
} from '@/components/overall/types';

export interface UseOverallAnalysisReturn {
    state: OverallAnalysisState;
    trigger: () => void;
}

/**
 * submitOverallAnalysisAction이 axis 정보와 함께 에러를 돌려줄 수 있으므로
 * 커스텀 에러 클래스로 axis를 보존한다.
 */
class OverallAnalysisError extends Error {
    constructor(
        message: string,
        public readonly axis?: OverallAxis
    ) {
        super(message);
        this.name = 'OverallAnalysisError';
    }
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted)
        throw new DOMException('Overall analysis aborted', 'AbortError');
}

/**
 * pending_dependencies 상태가 해소될 때까지 submit을 재귀적으로 재시도한다.
 * retryCount를 인자로 전달해 let 재할당 없이 순수하게 유지한다.
 */
async function submitUntilReady(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    signal: AbortSignal,
    onProgress: (p: ProgressState) => void,
    retryCount: number
): Promise<
    Exclude<
        Awaited<ReturnType<typeof submitOverallAnalysisAction>>,
        { status: 'pending_dependencies' }
    >
> {
    const submitted = await submitOverallAnalysisAction(
        symbol,
        companyName,
        timeframe,
        modelId
    );
    throwIfAborted(signal);

    if (submitted.status !== 'pending_dependencies') return submitted;

    if (retryCount >= MAX_DEPENDENCY_RETRIES) {
        const timeoutSeconds = Math.round(
            (MAX_DEPENDENCY_RETRIES * AUGMENT_AND_OVERALL_POLL_INTERVAL_MS) /
                MS_PER_SECOND
        );
        throw new OverallAnalysisError(
            `AI 종합 분석 의존성 분석이 ${timeoutSeconds}초 안에 완료되지 않았습니다. 잠시 후 다시 시도해주세요.`
        );
    }

    onProgress({
        phase: 'pending_dependencies',
        pendingJobs: submitted.pendingJobs,
        retryCount,
    });

    await sleep(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS);
    throwIfAborted(signal);

    return submitUntilReady(
        symbol,
        companyName,
        timeframe,
        modelId,
        signal,
        onProgress,
        retryCount + 1
    );
}

async function fetchOverallAnalysis(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    signal: AbortSignal,
    onProgress: (p: ProgressState) => void
): Promise<OverallAnalysisResponse> {
    onProgress({ phase: 'submitting' });

    const submitted = await submitUntilReady(
        symbol,
        companyName,
        timeframe,
        modelId,
        signal,
        onProgress,
        0
    );

    if (submitted.status === 'cached') return submitted.result;

    if (submitted.status === 'error') {
        throw new OverallAnalysisError(
            typeof submitted.error === 'string'
                ? submitted.error
                : '분석 중 오류가 발생했습니다.',
            submitted.axis
        );
    }

    if (submitted.status === 'limit_error') {
        throw new OverallAnalysisError(
            '오늘 분석 한도를 모두 사용했어요. 내일 다시 시도해 주세요.'
        );
    }

    const { jobId } = submitted;
    onProgress({ phase: 'polling' });

    while (!signal.aborted) {
        await sleep(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS);
        throwIfAborted(signal);

        const polled = await pollOverallAnalysisAction(jobId);
        throwIfAborted(signal);

        if (polled.status === 'done') return polled.result;
        if (polled.status === 'error') {
            throw new OverallAnalysisError(
                polled.error ?? '분석 중 오류가 발생했습니다.'
            );
        }
    }

    throw new DOMException('Overall analysis aborted', 'AbortError');
}

export function useOverallAnalysis(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId
): UseOverallAnalysisReturn {
    const queryClient = useQueryClient();
    const queryKey = QUERY_KEYS.overallAnalysis(
        symbol,
        companyName,
        timeframe,
        modelId
    );

    const [triggered, setTriggered] = useState(false);
    const [progress, setProgress] = useState<ProgressState | null>(null);

    // queryKey를 ref에 캡처해 mount 시 최초 렌더 기준으로 캐시를 확인한다.
    const queryKeyRef = useRef(queryKey);
    useEffect(() => {
        if (queryClient.getQueryData(queryKeyRef.current) !== undefined) {
            setTriggered(true);
        }
    }, [queryClient]);

    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) =>
            fetchOverallAnalysis(
                symbol,
                companyName,
                timeframe,
                modelId,
                signal,
                setProgress
            ),
        enabled: triggered,
        retry: false,
        staleTime: Infinity,
    });

    const state = useMemo((): OverallAnalysisState => {
        if (!triggered) return { status: 'idle' };
        if (query.isError) {
            const err = query.error;
            return {
                status: 'error',
                error:
                    err instanceof Error
                        ? err.message
                        : '분석 중 오류가 발생했습니다.',
                axis:
                    err instanceof OverallAnalysisError
                        ? err.axis
                        : undefined,
            };
        }
        if (query.data !== undefined) return { status: 'done', result: query.data };
        if (progress?.phase === 'pending_dependencies') {
            return {
                status: 'pending_dependencies',
                pendingJobs: progress.pendingJobs,
                retryCount: progress.retryCount,
            };
        }
        if (progress?.phase === 'polling') return { status: 'polling' };
        return { status: 'submitting' };
    }, [triggered, query.isError, query.error, query.data, progress]);

    const trigger = useCallback(() => {
        setProgress(null);
        if (!triggered) {
            setTriggered(true);
        } else {
            void query.refetch();
        }
    }, [triggered, query.refetch]);

    return { state, trigger };
}
