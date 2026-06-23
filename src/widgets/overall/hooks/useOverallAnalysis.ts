'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    ModelId,
    OverallAnalysisResponse,
    OverallAxis,
    Timeframe,
} from '@y0ngha/siglens-core';
import type { AssetClass } from '@/shared/config/marketProfile';
import {
    submitOverallAnalysisAction,
    pollOverallAnalysisAction,
    pollAnalysisAction,
    pollFundamentalAnalysisAction,
    cancelAnalysisJobAction,
    cancelFundamentalAnalysisJobAction,
    cancelOverallAnalysisJobAction,
} from '@/entities/analysis/actions';
import { isGateBlockedResult } from '@/entities/analysis';
import {
    pollNewsAnalysisAction,
    cancelNewsAnalysisJobAction,
} from '@/entities/news-article/actions';
import {
    cancelOptionsAnalysisJobAction,
    pollOptionsAnalysisAction,
} from '@/entities/options-chain/actions';
import { sleep } from '@/shared/lib/sleep';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { AUGMENT_AND_OVERALL_POLL_INTERVAL_MS } from '@/shared/config/pollingConfig';
import type { CancelJobEntry } from '@/shared/lib/types';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { usePageHideCancel } from '@/shared/hooks/usePageHideCancel';
import { BotBlockedError } from '@/widgets/symbol-page';
import type { OverallAnalysisState, ProgressState } from '../types';
import { axesForAssetClass } from '../utils/axesForAssetClass';

export interface UseOverallAnalysisReturn {
    state: OverallAnalysisState;
    trigger: () => void;
}

/**
 * 현재 진행 중인 job 상태.
 * pending_dependencies 단계에서는 각 axis jobId를,
 * overall polling 단계에서는 overall jobId를 추적한다.
 */
type CurrentJobs =
    | {
          phase: 'dependencies';
          jobs: Record<OverallAxis, string | undefined>;
      }
    | { phase: 'overall'; jobId: string }
    | null;

/** dependency axis별 polling 함수의 공통 응답 형태. */
interface DependencyPollResult {
    status: string;
    error?: string;
}

/**
 * submitUntilReady 재진입 한도. dedup이 적용된 뒤에도 의존성 분석이 끊임없이
 * 다시 pending 상태로 돌아가는 비정상 흐름을 멈추기 위한 안전망.
 */
const MAX_SUBMIT_RETRY_DEPTH = 3;

/**
 * submitOverallAnalysisAction이 axis 정보와 함께 에러를 돌려줄 수 있어
 * 커스텀 에러 클래스로 axis를 보존한다. 게이트 오류(AnalysisGateBlockedResult)는
 * axis가 없으므로 undefined로 전달된다.
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
): Promise<DependencyPollResult> {
    switch (axis) {
        case 'technical':
            return pollAnalysisAction(jobId);
        case 'fundamental':
            return pollFundamentalAnalysisAction(jobId);
        case 'news':
            return pollNewsAnalysisAction(jobId);
        case 'options':
            return pollOptionsAnalysisAction(jobId);
    }
}

/**
 * pending_dependencies 응답에서 받은 각 axis jobId를 직접 polling해
 * 모든 dependency가 완료될 때까지 대기한다.
 * submit을 반복 호출하지 않으므로 중복 job이 생성되지 않는다.
 *
 * `applicableAxes`는 asset class에 따라 결정된 축 목록이다. crypto는
 * ['technical', 'news']만 폴링하고 fundamental/options는 무시한다.
 */
async function waitForDependencies(
    initialPendingJobs: Record<OverallAxis, string | undefined>,
    signal: AbortSignal,
    onProgress: (p: ProgressState) => void,
    onJobsUpdate: (jobs: CurrentJobs) => void,
    applicableAxes: readonly OverallAxis[]
): Promise<void> {
    let remainingJobs = { ...initialPendingJobs };
    let retryCount = 0;

    onJobsUpdate({ phase: 'dependencies', jobs: remainingJobs });

    while (applicableAxes.some(axis => remainingJobs[axis] !== undefined)) {
        throwIfAborted(signal);
        await sleep(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS);
        throwIfAborted(signal);

        // 병렬 폴링 결과를 모은 뒤 한 번에 remainingJobs를 갱신해 동시 mutation을
        // 피한다. 두 callback이 같은 직전 값을 읽어 spread로 덮어쓰면 한쪽
        // 변경이 사라지는 race를 막기 위함.
        const completedAxes = await Promise.all(
            applicableAxes
                .filter(axis => remainingJobs[axis] !== undefined)
                .map(async (axis): Promise<OverallAxis | null> => {
                    const jobId = remainingJobs[axis]!;
                    const result = await pollDependencyJob(axis, jobId);
                    if (result.status === 'error') {
                        throw new OverallAnalysisError(
                            result.error ??
                                `${axis} 분석 중 오류가 발생했습니다.`,
                            axis
                        );
                    }
                    return result.status === 'done' ? axis : null;
                })
        );
        remainingJobs = completedAxes.reduce(
            (acc, axis) =>
                axis === null ? acc : { ...acc, [axis]: undefined },
            remainingJobs
        );

        retryCount++;
        onJobsUpdate({ phase: 'dependencies', jobs: remainingJobs });
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
 *
 * `force`는 사용자가 done 상태에서 재분석을 트리거할 때만 true로 전달된다.
 * pending_dependencies로 진입 후 재submit하는 재귀 호출에서는 propagation하지
 * 않는다 — dependency가 이미 새로 만들어진 상태이므로 추가 force는 불필요하다.
 */
async function submitUntilReady(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    signal: AbortSignal,
    onProgress: (p: ProgressState) => void,
    onJobsUpdate: (jobs: CurrentJobs) => void,
    applicableAxes: readonly OverallAxis[],
    options: { force?: boolean } = {},
    depth = 0
): Promise<
    Exclude<
        Awaited<ReturnType<typeof submitOverallAnalysisAction>>,
        { status: 'pending_dependencies' }
    >
> {
    if (depth >= MAX_SUBMIT_RETRY_DEPTH) {
        throw new OverallAnalysisError(
            '의존성 분석이 반복적으로 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
        );
    }

    const submitted = await submitOverallAnalysisAction(
        symbol,
        companyName,
        timeframe,
        modelId,
        options
    );
    throwIfAborted(signal);

    if (submitted.status !== 'pending_dependencies') return submitted;

    onProgress({
        phase: 'pending_dependencies',
        pendingJobs: submitted.pendingJobs,
        retryCount: 0,
    });

    await waitForDependencies(
        submitted.pendingJobs,
        signal,
        onProgress,
        onJobsUpdate,
        applicableAxes
    );
    throwIfAborted(signal);

    // 모든 dependency 완료 후 재submit — 이번엔 pending_dependencies가 반환되지
    // 않는다. force는 의도적으로 전파하지 않는다(위 JSDoc 참고).
    return submitUntilReady(
        symbol,
        companyName,
        timeframe,
        modelId,
        signal,
        onProgress,
        onJobsUpdate,
        applicableAxes,
        {},
        depth + 1
    );
}

async function fetchOverallAnalysis(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    signal: AbortSignal,
    onProgress: (p: ProgressState) => void,
    // expectedCurrent가 주어지면 ref가 일치할 때만 갱신한다. retry/queryKey
    // 변경으로 새 실행이 시작된 뒤 이전 실행의 finally가 새 실행의 ref를 null로
    // 덮어쓰는 race를 막기 위해 사용한다.
    onJobsUpdate: (jobs: CurrentJobs, expectedCurrent?: CurrentJobs) => void,
    applicableAxes: readonly OverallAxis[],
    options: { force?: boolean } = {}
): Promise<OverallAnalysisResponse> {
    // 이 실행이 마지막으로 ref에 기록한 값. finally에서 compare-and-clear의
    // 비교 기준으로 사용한다 — 다른 실행이 ref를 갱신했다면 그 값을 보존한다.
    let lastSetByThisRun: CurrentJobs = null;
    const trackedUpdate = (jobs: CurrentJobs): void => {
        lastSetByThisRun = jobs;
        onJobsUpdate(jobs);
    };

    onProgress({ phase: 'submitting' });

    const submitted = await submitUntilReady(
        symbol,
        companyName,
        timeframe,
        modelId,
        signal,
        onProgress,
        trackedUpdate,
        applicableAxes,
        options
    );

    if (submitted.status === 'cached') return submitted.result;

    if (submitted.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }

    if (submitted.status === 'error') {
        // AnalysisGateBlockedResult: error is { code: AnalysisGateErrorCode, message }, no axis.
        if (isGateBlockedResult(submitted)) {
            throw new OverallAnalysisError(submitted.error.message, undefined);
        }
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
    if (submitted.status === 'key_error') {
        throw new OverallAnalysisError(submitted.error, undefined);
    }

    const { jobId } = submitted;
    trackedUpdate({ phase: 'overall', jobId });
    onProgress({ phase: 'polling' });

    try {
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
    } finally {
        // 이 실행이 마지막으로 기록한 값이 여전히 ref에 있을 때만 비운다.
        // 새 실행이 ref를 갱신했다면 그 상태를 보존한다.
        onJobsUpdate(null, lastSetByThisRun);
    }

    throw new DOMException('Overall analysis aborted', 'AbortError');
}

export function useOverallAnalysis(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    /**
     * 서버에서 peek로 미리 읽은 캐시 분석 서사(SSR seed). 주어지면 마운트 즉시
     * done 상태로 보여 준다. staleTime: Infinity가 자동 재요청을 막으므로
     * seed가 있어도 LLM 생성은 트리거되지 않는다(순수 additive).
     *
     * staleTime: Infinity라 seed된 query는 자동 갱신되지 않는다. 그러나 timeframe
     * 변경 시 queryKey가 바뀌어 이 initialData(seed)는 옛 key에만 적용되고 새 key는
     * 빈 상태에서 시작하므로, "절대 갱신 안 됨" 사각지대는 생기지 않는다. 동일
     * 세션·동일 timeframe에서의 명시적 갱신은 재분석(trigger force)으로 처리된다.
     */
    initialResult?: OverallAnalysisResponse,
    /**
     * Asset class of the symbol being analysed.
     * Crypto runs on technical + news only — fundamental and options axes are
     * never submitted, polled, or cancelled for crypto symbols.
     * Defaults to 'equity' so existing callers that don't yet pass this param
     * continue to get the full 4-axis behaviour.
     */
    assetClass: AssetClass = 'equity'
): UseOverallAnalysisReturn {
    const queryClient = useQueryClient();
    const isHydrated = useHydrated();
    const [triggered, setTriggered] = useState(initialResult !== undefined);
    const [progress, setProgress] = useState<ProgressState | null>(null);
    const currentJobsRef = useRef<CurrentJobs>(null);
    // 재분석 trigger가 다음 queryFn 호출에서 force=true를 사용해야 한다고 신호를
    // 보내는 single-shot ref. queryFn 안에서 read 후 즉시 false로 reset한다.
    // useState 대신 ref를 쓰는 이유: trigger → refetch → queryFn 흐름이 같은
    // React commit cycle 안에서 진행돼야 해서 setState의 비동기 반영 타이밍에
    // 의존할 수 없다.
    const queryFnForceRef = useRef<boolean>(false);
    const queryKey = useMemo(
        () =>
            QUERY_KEYS.overallAnalysis(symbol, companyName, timeframe, modelId),
        [symbol, companyName, timeframe, modelId]
    );
    // queryKey를 ref에 캡처해 mount 시 최초 렌더 기준으로 캐시를 확인한다.
    const queryKeyRef = useRef(queryKey);

    const query = useQuery({
        queryKey,
        queryFn: ({
            signal,
            queryKey: [, qSymbol, qCompanyName, qTimeframe, qModelId],
        }) => {
            const force = queryFnForceRef.current;
            queryFnForceRef.current = false;
            return fetchOverallAnalysis(
                qSymbol,
                qCompanyName,
                qTimeframe,
                qModelId,
                signal,
                setProgress,
                (jobs, expectedCurrent) => {
                    if (
                        expectedCurrent !== undefined &&
                        currentJobsRef.current !== expectedCurrent
                    ) {
                        return;
                    }
                    currentJobsRef.current = jobs;
                },
                axesForAssetClass(assetClass),
                { force }
            );
        },
        enabled: isHydrated && triggered,
        retry: false,
        staleTime: Infinity,
        // SSR seed: 캐시 HIT면 마운트 시점부터 query.data가 채워져 있어 즉시 done.
        // staleTime: Infinity와 결합해 자동 refetch(=재생성) 없이 서사를 보여 준다.
        initialData: initialResult,
    });

    const state = useMemo((): OverallAnalysisState => {
        if (!triggered) return { status: 'idle' };
        if (query.isError) {
            const err = query.error;
            if (err instanceof BotBlockedError) {
                return { status: 'bot_blocked' };
            }
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
            // 이미 한 번 분석이 끝난 뒤의 사용자 행동은 항상 4-axis full force
            // 재분석으로 간주한다 (spec §2: "재분석 = 4축 전체 force").
            queryFnForceRef.current = true;
            void refetch();
        }
    }, [triggered, refetch]);

    // ref를 null로 초기화해 unmount cleanup과의 이중 cancel을 방지한다.
    const getPageHideJobs = useCallback((): CancelJobEntry[] | null => {
        // axesForAssetClass returns a module-level constant array (CRYPTO_AXIS_ORDER or
        // EQUITY_AXIS_ORDER), so the reference is already stable across renders — useMemo
        // would be redundant and, with preserve-manual-memoization, preserved as dead
        // weight rather than optimised away. Computed inline so assetClass is the real
        // dependency (pure function, stable result).
        const applicableAxes = axesForAssetClass(assetClass);
        const current = currentJobsRef.current;
        if (current === null) return null;
        currentJobsRef.current = null;

        const jobs: CancelJobEntry[] =
            current.phase === 'dependencies'
                ? [
                      ...(applicableAxes.includes('technical') &&
                      current.jobs.technical !== undefined
                          ? [
                                {
                                    jobId: current.jobs.technical,
                                    type: 'analysis' as const,
                                },
                            ]
                          : []),
                      ...(applicableAxes.includes('fundamental') &&
                      current.jobs.fundamental !== undefined
                          ? [
                                {
                                    jobId: current.jobs.fundamental,
                                    type: 'fundamental' as const,
                                },
                            ]
                          : []),
                      ...(applicableAxes.includes('news') &&
                      current.jobs.news !== undefined
                          ? [
                                {
                                    jobId: current.jobs.news,
                                    type: 'news' as const,
                                },
                            ]
                          : []),
                      ...(applicableAxes.includes('options') &&
                      current.jobs.options !== undefined
                          ? [
                                {
                                    jobId: current.jobs.options,
                                    type: 'options' as const,
                                },
                            ]
                          : []),
                  ]
                : [{ jobId: current.jobId, type: 'overall' as const }];

        return jobs.length > 0 ? jobs : null;
    }, [assetClass]);
    usePageHideCancel(getPageHideJobs);

    useEffect(() => {
        if (queryClient.getQueryData(queryKeyRef.current) !== undefined) {
            setTriggered(true);
        }
    }, [queryClient]);

    // symbol, companyName, timeframe, modelId 변경(queryKey 교체) 시, unmount 시
    // 진행 중인 job을 cancel한다.
    // fire-and-forget이므로 useMutation 없이 직접 호출한다.
    useEffect(() => {
        return () => {
            // Inline (no useMemo) for the same stability reason as getPageHideJobs above.
            const applicableAxes = axesForAssetClass(assetClass);
            const current = currentJobsRef.current;
            if (current === null) return;
            currentJobsRef.current = null;

            if (current.phase === 'dependencies') {
                const { technical, fundamental, news, options } = current.jobs;
                if (
                    applicableAxes.includes('technical') &&
                    technical !== undefined
                )
                    void cancelAnalysisJobAction(technical).catch(error =>
                        console.warn(
                            '[useOverallAnalysis] cancel technical failed',
                            error
                        )
                    );
                if (
                    applicableAxes.includes('fundamental') &&
                    fundamental !== undefined
                )
                    void cancelFundamentalAnalysisJobAction(fundamental).catch(
                        error =>
                            console.warn(
                                '[useOverallAnalysis] cancel fundamental failed',
                                error
                            )
                    );
                if (applicableAxes.includes('news') && news !== undefined)
                    void cancelNewsAnalysisJobAction(news).catch(error =>
                        console.warn(
                            '[useOverallAnalysis] cancel news failed',
                            error
                        )
                    );
                if (applicableAxes.includes('options') && options !== undefined)
                    void cancelOptionsAnalysisJobAction(options).catch(error =>
                        console.warn(
                            '[useOverallAnalysis] cancel options failed',
                            error
                        )
                    );
            } else {
                void cancelOverallAnalysisJobAction(current.jobId).catch(
                    error =>
                        console.warn(
                            '[useOverallAnalysis] cancel overall failed',
                            error
                        )
                );
            }
        };
    }, [queryKey, assetClass]);

    return { state, trigger };
}
