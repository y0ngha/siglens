'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { submitOverallAnalysisAction } from '@/infrastructure/market/submitOverallAnalysisAction';
import { pollOverallAnalysisAction } from '@/infrastructure/market/pollOverallAnalysisAction';
import type {
    ModelId,
    OverallAnalysisResponse,
    OverallAxis,
    Timeframe,
} from '@y0ngha/siglens-core';

const POLL_INTERVAL_MS = 3000;
const DEPENDENCY_RETRY_MS = 3000;
const MAX_DEPENDENCY_RETRIES = 20; // 20 × 3 s = 60 s wall-clock

type OverallAnalysisState =
    | { status: 'idle' }
    | {
          status: 'pending_dependencies';
          pendingJobs: Record<OverallAxis, string | undefined>;
      }
    | { status: 'submitting' | 'polling' }
    | { status: 'done'; result: OverallAnalysisResponse }
    | { status: 'error'; error: string; axis?: OverallAxis };

type CleanupFn = () => void;

// State machine; each trigger cancels any in-flight run via the alive flag + clearTimeout.
export function useOverallAnalysis(
    symbol: string,
    timeframe: Timeframe,
    modelId: ModelId
): { state: OverallAnalysisState; trigger: () => void } {
    const [state, setState] = useState<OverallAnalysisState>({
        status: 'idle',
    });

    // Holds the cancel function for the currently in-flight run.
    const cleanupRef = useRef<CleanupFn | null>(null);

    const trigger = useCallback(() => {
        // Cancel any prior in-flight run before starting a new one.
        cleanupRef.current?.();

        let alive = true;
        let retryHandle: ReturnType<typeof setTimeout> | null = null;
        let pollHandle: ReturnType<typeof setTimeout> | null = null;
        let dependencyRetryCount = 0;

        cleanupRef.current = () => {
            alive = false;
            if (retryHandle !== null) clearTimeout(retryHandle);
            if (pollHandle !== null) clearTimeout(pollHandle);
        };

        async function run(): Promise<void> {
            setState({ status: 'submitting' });

            const submitted = await submitOverallAnalysisAction(
                symbol,
                timeframe,
                modelId
            );

            if (!alive) return;

            if (submitted.status === 'cached') {
                setState({ status: 'done', result: submitted.result });
                return;
            }

            if (submitted.status === 'pending_dependencies') {
                if (dependencyRetryCount >= MAX_DEPENDENCY_RETRIES) {
                    setState({
                        status: 'error',
                        error: 'AI 종합 분석 의존성 분석이 1분 안에 완료되지 않았습니다. 잠시 후 다시 시도해주세요.',
                    });
                    return;
                }
                dependencyRetryCount += 1;
                setState({
                    status: 'pending_dependencies',
                    pendingJobs: submitted.pendingJobs,
                });
                // Retry the full submit after a delay; core will re-check cache hits.
                retryHandle = setTimeout(() => {
                    void run();
                }, DEPENDENCY_RETRY_MS);
                return;
            }

            if (submitted.status === 'error') {
                const errorMsg =
                    typeof submitted.error === 'string'
                        ? submitted.error
                        : '분석 중 오류가 발생했습니다.';
                setState({
                    status: 'error',
                    error: errorMsg,
                    axis: submitted.axis,
                });
                return;
            }

            // status === 'submitted' — start polling
            const { jobId } = submitted;
            setState({ status: 'polling' });

            const poll = async (): Promise<void> => {
                const polled = await pollOverallAnalysisAction(jobId);
                if (!alive) return;

                if (polled.status === 'processing') {
                    pollHandle = setTimeout(() => {
                        void poll();
                    }, POLL_INTERVAL_MS);
                } else if (polled.status === 'done') {
                    setState({ status: 'done', result: polled.result });
                } else {
                    setState({
                        status: 'error',
                        error: polled.error ?? '분석 중 오류가 발생했습니다.',
                    });
                }
            };

            void poll();
        }

        void run();
    }, [symbol, timeframe, modelId]);

    // Cancel on unmount.
    useEffect(
        () => () => {
            cleanupRef.current?.();
        },
        []
    );

    return { state, trigger };
}
