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
import {
    AUGMENT_AND_OVERALL_POLL_INTERVAL_MS,
    MAX_DEPENDENCY_RETRIES,
} from '@/lib/pollingConfig';
import { MS_PER_SECOND } from '@/domain/constants/time';

type OverallAnalysisState =
    | { status: 'idle' }
    | {
          status: 'pending_dependencies';
          pendingJobs: Record<OverallAxis, string | undefined>;
          // 0 = 첫 진입, 1+ = polling 횟수. ETA 표시(`약 N초 남음`)에 사용.
          retryCount: number;
      }
    | { status: 'submitting' | 'polling' }
    | { status: 'done'; result: OverallAnalysisResponse }
    | { status: 'error'; error: string; axis?: OverallAxis };

type CleanupFn = () => void;

export interface UseOverallAnalysisReturn {
    state: OverallAnalysisState;
    trigger: () => void;
}

// trigger 호출마다 만들어지는 실행 컨텍스트. 모듈 레벨 run/poll 함수가 클로저 대신 명시적으로 받는다.
interface RunContext {
    symbol: string;
    timeframe: Timeframe;
    modelId: ModelId;
    setState: (state: OverallAnalysisState) => void;
    isAlive: () => boolean;
    setRetryHandle: (h: ReturnType<typeof setTimeout> | null) => void;
    setPollHandle: (h: ReturnType<typeof setTimeout> | null) => void;
}

async function pollOverallJob(jobId: string, ctx: RunContext): Promise<void> {
    const polled = await pollOverallAnalysisAction(jobId);
    if (!ctx.isAlive()) return;

    if (polled.status === 'processing') {
        const handle = setTimeout(() => {
            void pollOverallJob(jobId, ctx);
        }, AUGMENT_AND_OVERALL_POLL_INTERVAL_MS);
        ctx.setPollHandle(handle);
        return;
    }
    if (polled.status === 'done') {
        ctx.setState({ status: 'done', result: polled.result });
        return;
    }
    ctx.setState({
        status: 'error',
        error: polled.error ?? '분석 중 오류가 발생했습니다.',
    });
}

async function runOverallAnalysis(
    ctx: RunContext,
    dependencyRetryCount: number
): Promise<void> {
    // 첫 호출에서만 submitting 스피너를 띄운다. retry는 `pending_dependencies` 스냅샷을
    // 유지해 DependencyProgress가 깜빡이지 않도록 한다 (한 틱 동안 generic spinner로 전환되지 않음).
    if (dependencyRetryCount === 0) {
        ctx.setState({ status: 'submitting' });
    }

    const submitted = await submitOverallAnalysisAction(
        ctx.symbol,
        ctx.timeframe,
        ctx.modelId
    );

    if (!ctx.isAlive()) return;

    if (submitted.status === 'cached') {
        ctx.setState({ status: 'done', result: submitted.result });
        return;
    }

    if (submitted.status === 'pending_dependencies') {
        if (dependencyRetryCount >= MAX_DEPENDENCY_RETRIES) {
            const timeoutSeconds = Math.round(
                (MAX_DEPENDENCY_RETRIES *
                    AUGMENT_AND_OVERALL_POLL_INTERVAL_MS) /
                    MS_PER_SECOND
            );
            ctx.setState({
                status: 'error',
                error: `AI 종합 분석 의존성 분석이 ${timeoutSeconds}초 안에 완료되지 않았습니다. 잠시 후 다시 시도해주세요.`,
            });
            return;
        }
        ctx.setState({
            status: 'pending_dependencies',
            pendingJobs: submitted.pendingJobs,
            retryCount: dependencyRetryCount,
        });
        // Retry the full submit after a delay; core will re-check cache hits.
        const handle = setTimeout(() => {
            void runOverallAnalysis(ctx, dependencyRetryCount + 1);
        }, AUGMENT_AND_OVERALL_POLL_INTERVAL_MS);
        ctx.setRetryHandle(handle);
        return;
    }

    if (submitted.status === 'error') {
        const errorMsg =
            typeof submitted.error === 'string'
                ? submitted.error
                : '분석 중 오류가 발생했습니다.';
        ctx.setState({
            status: 'error',
            error: errorMsg,
            axis: submitted.axis,
        });
        return;
    }

    if (submitted.status === 'limit_error') {
        ctx.setState({
            status: 'error',
            error: '오늘 분석 한도를 모두 사용했어요. 내일 다시 시도해 주세요.',
        });
        return;
    }

    // status === 'submitted' — start polling
    const { jobId } = submitted;
    ctx.setState({ status: 'polling' });
    void pollOverallJob(jobId, ctx);
}

// 얇은 coordinator — 클로저로 alive flag와 setTimeout 핸들을 관리하고 run/poll에 위임한다.
export function useOverallAnalysis(
    symbol: string,
    timeframe: Timeframe,
    modelId: ModelId
): UseOverallAnalysisReturn {
    const [state, setState] = useState<OverallAnalysisState>({
        status: 'idle',
    });

    const cleanupRef = useRef<CleanupFn | null>(null);

    const trigger = useCallback(() => {
        // Cancel any prior in-flight run before starting a new one.
        cleanupRef.current?.();

        let alive = true;
        let retryHandle: ReturnType<typeof setTimeout> | null = null;
        let pollHandle: ReturnType<typeof setTimeout> | null = null;

        cleanupRef.current = () => {
            alive = false;
            if (retryHandle !== null) clearTimeout(retryHandle);
            if (pollHandle !== null) clearTimeout(pollHandle);
        };

        const ctx: RunContext = {
            symbol,
            timeframe,
            modelId,
            setState,
            isAlive: () => alive,
            setRetryHandle: h => {
                retryHandle = h;
            },
            setPollHandle: h => {
                pollHandle = h;
            },
        };

        void runOverallAnalysis(ctx, 0);
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
