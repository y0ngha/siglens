'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import type {
    AnalysisResponse,
    ModelId,
    Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_MINUTE } from '@/domain/constants/time';
import {
    submitAnalysisAction,
    type SubmitAnalysisActionResult,
} from '@/infrastructure/market/submitAnalysisAction';
import { pollAnalysisAction } from '@/infrastructure/market/pollAnalysisAction';
import { cancelAnalysisJobAction } from '@/infrastructure/market/cancelAnalysisJobAction';
import {
    getReanalyzeCooldownMs as fetchReanalyzeCooldownMs,
    releaseReanalyzeCooldown,
    tryAcquireReanalyzeCooldown,
} from '@/infrastructure/market/reanalyzeCooldown';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { CHART_ANALYSIS_POLL_INTERVAL_MS } from '@/infrastructure/market/pollingConfig';

interface AnalyzeMutationVariables {
    symbol: string;
    force: boolean;
    fmpSymbol?: string;
    modelId?: ModelId;
}

/**
 * 재분석 쿨다운 (5분).
 * 진실값은 Redis(서버)이며 클라이언트는 표시 목적으로만 카운트다운한다.
 */
const REANALYZE_COOLDOWN_MS = 5 * MS_PER_MINUTE;

/** 캐시 히트(force=false 즉시 응답) 시 적용하는 짧은 클라이언트 쿨다운 — 같은 캐시의 빠른 반복 호출 방지. */
const CACHE_HIT_COOLDOWN_MS = 30_000;

interface UseAnalysisOptions {
    symbol: string;
    /** latestTimeframeRef를 통해 analyzeAction 호출 시 최신 timeframe 값을 읽기 위한 채널 */
    timeframe: Timeframe;
    initialAnalysis: AnalysisResponse;
    /**
     * 서버에서 초기 AI 분석이 실패했는지 여부.
     * true이면 마운트 시 자동으로 재분석을 실행한다.
     */
    initialAnalysisFailed: boolean;
    fmpSymbol?: string;
    /**
     * 타임프레임이 변경된 누적 횟수. SymbolPageClient에서 추적하여 전달한다.
     * Suspense remount 시 isInitialMount ref가 초기화되는 문제를 우회하기 위해
     * 마운트 바깥에서 변경 여부를 추적한다.
     * 0이면 초기 마운트, 1 이상이면 타임프레임 변경으로 인한 마운트다.
     */
    timeframeChangeCount: number;
    modelId?: ModelId;
}

/**
 * 쿨다운 차단 알림. 같은 클릭에 대해 toast가 한 번만 뜨도록
 * 단조 증가하는 nonce와 잔여 시간을 함께 노출한다.
 */
export interface CooldownNotice {
    nonce: number;
    remainingMs: number;
}

interface UseAnalysisResult {
    analysis: AnalysisResponse;
    /** 새 분석이 완료됐을 때만 값이 세팅됨. initialAnalysis 기반 초기 로드엔 null. */
    analysisResult: AnalysisResponse | null;
    isAnalyzing: boolean;
    analysisError: string | null;
    handleReanalyze: () => void;
    /** 다음 재분석까지 남은 ms. 0이면 즉시 가능. */
    reanalyzeCooldownMs: number;
    /** 사용자가 쿨다운 중에 재분석 버튼을 눌렀을 때 갱신되는 알림. */
    cooldownNotice: CooldownNotice | null;
}

export function useAnalysis({
    symbol,
    timeframe,
    initialAnalysis,
    initialAnalysisFailed,
    fmpSymbol,
    timeframeChangeCount,
    modelId,
}: UseAnalysisOptions): UseAnalysisResult {
    // 1. useState
    const [analysisResult, setAnalysisResult] =
        useState<AnalysisResponse | null>(null);
    const [reanalyzeCooldownMs, setReanalyzeCooldownMs] = useState<number>(0);
    const [cooldownNotice, setCooldownNotice] = useState<CooldownNotice | null>(
        null
    );
    const [pollError, setPollError] = useState<string | null>(null);

    // 2. useRef
    const latestRef = useRef<{ symbol: string; fmpSymbol?: string }>({
        symbol,
        fmpSymbol,
    });
    const latestTimeframeRef = useRef<Timeframe>(timeframe);
    const latestModelIdRef = useRef<ModelId | undefined>(modelId);
    const prevTimeframeChangeCountRef = useRef(0);
    const prevModelIdRef = useRef<ModelId | undefined>(modelId);
    // 현재 진행 중인 워커 job ID. 타임프레임 변경 시 취소 신호 전달에 사용.
    const currentJobIdRef = useRef<string | null>(null);
    // 초기 마운트 시 서버 분석 실패 여부를 캡처한다.
    // 이후 렌더링에서 이 값이 변경되더라도 마운트 시 한 번만 사용된다.
    const initialAnalysisFailedRef = useRef(initialAnalysisFailed);
    // polling 완료 시 force 경로 쿨다운 처리를 위해 마지막 요청의 force 여부를 추적
    const lastForceRef = useRef(false);
    // 폴링 결과의 useEffect 처리에서 동일 데이터 중복 처리 방지
    const handledPollRef = useRef<unknown>(null);

    // 3. useMutation — submit
    const {
        data: submitData,
        error: submitError,
        isPending: isSubmitting,
        reset,
        mutate,
    } = useMutation<
        SubmitAnalysisActionResult,
        Error,
        AnalyzeMutationVariables
    >({
        mutationFn: ({
            force,
            symbol: mutSymbol,
            fmpSymbol: mutFmpSymbol,
            modelId: mutModelId,
        }) => {
            lastForceRef.current = force;
            return submitAnalysisAction(
                mutSymbol,
                latestTimeframeRef.current,
                force,
                mutFmpSymbol,
                mutModelId
            );
        },
        onMutate: () => {
            setPollError(null);
            setAnalysisResult(null);
            handledPollRef.current = null;
        },
        onSuccess: (data, variables) => {
            if (data.status === 'cached') {
                currentJobIdRef.current = null;
                setAnalysisResult(data.result);
                // force 경로는 정상 5분 쿨다운, 일반 캐시 히트는 짧은
                // 쿨다운(30s) — 같은 결과 즉시 재호출로 인한 스팸 방지.
                setReanalyzeCooldownMs(prev =>
                    Math.max(
                        prev,
                        variables.force
                            ? REANALYZE_COOLDOWN_MS
                            : CACHE_HIT_COOLDOWN_MS
                    )
                );
            } else if (data.status === 'submitted') {
                currentJobIdRef.current = data.jobId;
                // submitted 단계에서는 쿨다운을 시작하지 않는다.
                // polling 완료(done) 시에만 쿨다운을 시작한다.
            } else {
                // tier gate / 일일 사용 한도 초과
                currentJobIdRef.current = null;
                setPollError(data.error.message);
                if (variables.force) {
                    void releaseReanalyzeCooldown(
                        latestRef.current.symbol,
                        latestTimeframeRef.current
                    );
                    setReanalyzeCooldownMs(0);
                }
            }
        },
        onError: (_error, { force, symbol: mutSymbol }) => {
            if (!force) return;
            void releaseReanalyzeCooldown(
                mutSymbol,
                latestTimeframeRef.current
            );
            setReanalyzeCooldownMs(0);
        },
    });

    // 4. useMutation — cancel
    const { mutate: cancelMutate } = useMutation({
        mutationFn: (jobId: string) => cancelAnalysisJobAction(jobId),
        onError: error => {
            console.warn('[useAnalysis] cancel failed', error);
        },
    });

    // 5. useQuery — polling (submitted 후 jobId가 있을 때만 활성화)
    const pollingJobId =
        submitData?.status === 'submitted' ? submitData.jobId : null;
    const { data: pollData } = useQuery({
        queryKey: pollingJobId
            ? QUERY_KEYS.analysisJob(pollingJobId)
            : ['analysis-job', '__disabled__'],
        queryFn: () => pollAnalysisAction(pollingJobId!),
        enabled: pollingJobId !== null,
        refetchInterval: query => {
            const data = query.state.data;
            return data?.status === 'processing'
                ? CHART_ANALYSIS_POLL_INTERVAL_MS
                : false;
        },
        // 폴링 결과는 캐시될 필요 없음 (jobId는 일회성)
        gcTime: 0,
    });

    // 6. useQuery — cooldown TTL 동기화 (서버 진실값)
    const { data: cooldownTtlMs } = useQuery({
        queryKey: QUERY_KEYS.reanalyzeCooldown(symbol, timeframe),
        queryFn: () => fetchReanalyzeCooldownMs(symbol, timeframe),
        // 서버 카운터는 실시간 변하지 않음; 마운트 시 한번만 가져오면 충분
        staleTime: Infinity,
        gcTime: 0,
    });

    // 7. Derived variables
    const analysis = analysisResult ?? initialAnalysis;
    const isPolling = pollData?.status === 'processing';
    const isAnalyzing = isSubmitting || isPolling;
    const analysisError = submitError?.message ?? pollError ?? null;
    // 쿨다운 카운트다운이 활성화된 상태. effect deps에 사용해 불필요한 재시작을 방지한다.
    const isCountdownActive = reanalyzeCooldownMs > 0;

    // 8. Handlers
    // latestRef 패턴을 사용하므로 symbol을 deps에서 제외하고 안정적인 함수 참조를 유지한다.
    // Redis 기반 쿨다운을 atomic하게 점유한 뒤에만 mutation을 실행한다.
    const handleReanalyze = useCallback((): void => {
        const { symbol: latestSymbol, fmpSymbol: latestFmpSymbol } =
            latestRef.current;
        const tf = latestTimeframeRef.current;
        void (async () => {
            const acquire = await tryAcquireReanalyzeCooldown(latestSymbol, tf);
            if (!acquire.ok) {
                setReanalyzeCooldownMs(acquire.remainingMs);
                setCooldownNotice({
                    nonce: Date.now(),
                    remainingMs: acquire.remainingMs,
                });
                return;
            }
            reset();
            mutate({
                symbol: latestSymbol,
                force: true,
                fmpSymbol: latestFmpSymbol,
                modelId: latestModelIdRef.current,
            });
        })();
    }, [reset, mutate]);

    // 9. useLayoutEffect
    // symbol, timeframe의 최신 렌더 값을 DOM 커밋 전에 동기 갱신하여
    // mutation 호출 시점에 stale closure를 방지한다.
    useLayoutEffect(() => {
        latestRef.current = { symbol, fmpSymbol };
        latestTimeframeRef.current = timeframe;
        latestModelIdRef.current = modelId;
    });

    // 10. useEffect

    // 폴링 결과의 done/error 전이는 cooldown release 같은 외부 사이드이펙트가 동반되므로
    // 렌더 시 derive 불가능 — setState in effect 패턴이 불가피하다. handledPollRef로 중복 처리는 차단.
    useEffect(() => {
        if (!pollData) return;
        if (handledPollRef.current === pollData) return;
        handledPollRef.current = pollData;

        if (pollData.status === 'done') {
            currentJobIdRef.current = null;
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAnalysisResult(pollData.result);
            if (lastForceRef.current) {
                setReanalyzeCooldownMs(REANALYZE_COOLDOWN_MS);
            }
            return;
        }
        if (pollData.status === 'error') {
            currentJobIdRef.current = null;
            // worker/src/retry.ts AI_SERVER_UNSTABLE_CODE 센티넬과 동기화 필요
            const errorMessage =
                pollData.error === 'AI_SERVER_UNSTABLE'
                    ? "죄송합니다. AI 서버가 불안정합니다. 잠시 후 다시 시도해 주세요. 반복해서 발생할 경우 하단 '오류 제보하기'를 이용해 주세요."
                    : pollData.error;
            setPollError(errorMessage);
            if (lastForceRef.current) {
                void releaseReanalyzeCooldown(
                    latestRef.current.symbol,
                    latestTimeframeRef.current
                );
                setReanalyzeCooldownMs(0);
            }
        }
    }, [pollData]);

    // 서버 쿨다운 TTL은 외부 진실값 — 1초 카운트다운 interval과 mutation onSuccess 등 다중 소스가
    // 같은 state를 갱신하므로 derive 불가능하다.
    useEffect(() => {
        if (cooldownTtlMs === undefined) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReanalyzeCooldownMs(cooldownTtlMs);
    }, [cooldownTtlMs]);

    // 서버에서 초기 AI 분석이 실패한 경우 마운트 직후 자동으로 재분석을 실행한다.
    useEffect(() => {
        if (!initialAnalysisFailedRef.current) return;
        mutate({
            symbol: latestRef.current.symbol,
            force: false,
            fmpSymbol: latestRef.current.fmpSymbol,
            modelId: latestModelIdRef.current,
        });
    }, [mutate]);

    // 타임프레임 변경 시 진행 중인 워커 작업을 취소하고, 이전 mutation 상태를 초기화한 뒤 새 분석을 자동 실행한다.
    useEffect(() => {
        if (timeframeChangeCount === prevTimeframeChangeCountRef.current) {
            return;
        }
        prevTimeframeChangeCountRef.current = timeframeChangeCount;

        const jobId = currentJobIdRef.current;
        currentJobIdRef.current = null;

        if (jobId !== null) cancelMutate(jobId);
        reset();
        mutate({
            symbol: latestRef.current.symbol,
            force: false,
            fmpSymbol: latestRef.current.fmpSymbol,
            modelId: latestModelIdRef.current,
        });
    }, [timeframeChangeCount, reset, mutate, cancelMutate]);

    useEffect(() => {
        if (modelId === prevModelIdRef.current) return;
        prevModelIdRef.current = modelId;

        const jobId = currentJobIdRef.current;
        currentJobIdRef.current = null;

        if (jobId !== null) cancelMutate(jobId);
        reset();
        mutate({
            symbol: latestRef.current.symbol,
            force: false,
            fmpSymbol: latestRef.current.fmpSymbol,
            modelId,
        });
    }, [modelId, reset, mutate, cancelMutate]);

    // 쿨다운이 활성화된 동안 1초마다 로컬에서 카운트다운한다.
    // isCountdownActive(0 → 양수 전환)가 true가 될 때만 인터벌을 시작해 중복 시작을 방지한다.
    useEffect(() => {
        if (!isCountdownActive) return;
        const intervalId = window.setInterval(() => {
            setReanalyzeCooldownMs(prev => Math.max(0, prev - 1000));
        }, 1000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [isCountdownActive]);

    return {
        analysis,
        analysisResult,
        isAnalyzing,
        analysisError,
        handleReanalyze,
        reanalyzeCooldownMs,
        cooldownNotice,
    };
}
