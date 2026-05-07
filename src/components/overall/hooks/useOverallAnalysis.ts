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
import { pollAnalysisAction } from '@/infrastructure/market/pollAnalysisAction';
import { pollFundamentalAnalysisAction } from '@/infrastructure/market/pollFundamentalAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
import { sleep } from '@/lib/sleep';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { AUGMENT_AND_OVERALL_POLL_INTERVAL_MS } from '@/lib/pollingConfig';
import type {
    OverallAnalysisState,
    ProgressState,
} from '@/components/overall/types';

export interface UseOverallAnalysisReturn {
    state: OverallAnalysisState;
    trigger: () => void;
}

const AXIS_ORDER: readonly OverallAxis[] = ['technical', 'fundamental', 'news'];

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

async function pollDependencyJob(
    axis: OverallAxis,
    jobId: string
): Promise<{ status: string; error?: string }> {
    switch (axis) {
        case 'technical':
            return pollAnalysisAction(jobId);
        case 'fundamental':
            return pollFundamentalAnalysisAction(jobId);
        case 'news':
            return pollNewsAnalysisAction(jobId);
    }
}

/**
 * pending_dependencies 응답에서 받은 각 axis jobId를 직접 polling해
 * 모든 dependency가 완료될 때까지 대기한다.
 * submit을 반복 호출하지 않으므로 중복 job이 생성되지 않는다.
 */
async function waitForDependencies(
    initialPendingJobs: Record<OverallAxis, string | undefined>,
    signal: AbortSignal,
    onProgress: (p: ProgressState) => void
): Promise<void> {
    let remainingJobs = { ...initialPendingJobs };
    let retryCount = 0;

    while (AXIS_ORDER.some(axis => remainingJobs[axis] !== undefined)) {
        throwIfAborted(signal);
        await sleep(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS);
        throwIfAborted(signal);

        await Promise.all(
            AXIS_ORDER.filter(axis => remainingJobs[axis] !== undefined).map(
                async axis => {
                    const jobId = remainingJobs[axis]!;
                    const result = await pollDependencyJob(axis, jobId);
                    if (result.status === 'done') {
                        remainingJobs = { ...remainingJobs, [axis]: undefined };
                    } else if (result.status === 'error') {
                        throw new OverallAnalysisError(
                            result.error ?? `${axis} 분석 중 오류가 발생했습니다.`,
                            axis
                        );
                    }
                }
            )
        );

        retryCount++;
        onProgress({
            phase: 'pending_dependencies',
            pendingJobs: remainingJobs,
            retryCount,
        });
    }
}

/**
 * submitOverallAnalysisAction을 호출하고, pending_dependencies이면
 * 각 axis job을 직접 polling한 뒤 완료 후 한 번만 재submit한다.
 */
async function submitUntilReady(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    signal: AbortSignal,
    onProgress: (p: ProgressState) => void
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

    onProgress({
        phase: 'pending_dependencies',
        pendingJobs: submitted.pendingJobs,
        retryCount: 0,
    });

    await waitForDependencies(submitted.pendingJobs, signal, onProgress);
    throwIfAborted(signal);

    // 모든 dependency 완료 후 재submit — 이번엔 pending_dependencies가 반환되지 않는다.
    return submitUntilReady(
        symbol,
        companyName,
        timeframe,
        modelId,
        signal,
        onProgress
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
        onProgress
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
                    err instanceof OverallAnalysisError ? err.axis : undefined,
            };
        }
        if (query.data !== undefined)
            return { status: 'done', result: query.data };
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

    const { refetch } = query;
    const trigger = useCallback(() => {
        setProgress(null);
        if (!triggered) {
            setTriggered(true);
        } else {
            void refetch();
        }
    }, [triggered, refetch]);

    return { state, trigger };
}
