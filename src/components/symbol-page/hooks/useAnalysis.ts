'use client';

import { useMutation } from '@tanstack/react-query';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import type {
    AnalysisResponse,
    AnalyzeVariables,
    Bar,
    IndicatorResult,
    Timeframe,
} from '@/domain/types';
import { MS_PER_MINUTE } from '@/domain/constants/time';
import { submitAnalysisAction } from '@/infrastructure/market/submitAnalysisAction';
import { pollAnalysisAction } from '@/infrastructure/market/pollAnalysisAction';
import type { SubmitAnalysisResult } from '@/infrastructure/jobs/types';
import {
    tryAcquireReanalyzeCooldown,
    releaseReanalyzeCooldown,
    getReanalyzeCooldownMs as fetchReanalyzeCooldownMs,
} from '@/infrastructure/market/reanalyzeCooldown';

interface AnalyzeMutationVariables extends AnalyzeVariables {
    force: boolean;
}

/**
 * 재분석 쿨다운 (5분).
 * 진실값은 Redis(서버)이며 클라이언트는 표시 목적으로만 카운트다운한다.
 */
const REANALYZE_COOLDOWN_MS = 5 * MS_PER_MINUTE;

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 8 * MS_PER_MINUTE;

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
    /**
     * 타임프레임이 변경된 누적 횟수. SymbolPageClient에서 추적하여 전달한다.
     * Suspense remount 시 isInitialMount ref가 초기화되는 문제를 우회하기 위해
     * 마운트 바깥에서 변경 여부를 추적한다.
     * 0이면 초기 마운트, 1 이상이면 타임프레임 변경으로 인한 마운트다.
     */
    timeframeChangeCount: number;
    /** latestRef를 통해 handleReanalyze 호출 시 최신 값을 읽기 위한 채널 */
    bars: Bar[];
    /** latestRef를 통해 handleReanalyze 호출 시 최신 값을 읽기 위한 채널 */
    indicators: IndicatorResult;
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
    isAnalyzing: boolean;
    analysisError: string | null;
    handleReanalyze: () => void;
    /** 다음 재분석까지 남은 ms. 0이면 즉시 가능. */
    reanalyzeCooldownMs: number;
    /** 사용자가 쿨다운 중에 재분석 버튼을 눌렀을 때 갱신되는 알림. */
    cooldownNotice: CooldownNotice | null;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export function useAnalysis({
    symbol,
    timeframe,
    initialAnalysis,
    initialAnalysisFailed,
    timeframeChangeCount,
    bars,
    indicators,
}: UseAnalysisOptions): UseAnalysisResult {
    // State
    const [analysisResult, setAnalysisResult] =
        useState<AnalysisResponse | null>(null);
    const [reanalyzeCooldownMs, setReanalyzeCooldownMs] = useState<number>(0);
    const [cooldownNotice, setCooldownNotice] = useState<CooldownNotice | null>(
        null
    );
    const [isPolling, setIsPolling] = useState(false);
    const [pollError, setPollError] = useState<string | null>(null);

    // Refs
    const latestRef = useRef<AnalyzeVariables>({ symbol, bars, indicators });
    const latestTimeframeRef = useRef<Timeframe>(timeframe);
    const prevTimeframeChangeCountRef = useRef(0);
    // 초기 마운트 시 서버 분석 실패 여부를 캡처한다.
    // 이후 렌더링에서 이 값이 변경되더라도 마운트 시 한 번만 사용된다.
    const initialAnalysisFailedRef = useRef(initialAnalysisFailed);

    // Mutation
    const {
        data: submitData,
        error: submitError,
        isPending: isSubmitting,
        reset,
        mutate,
    } = useMutation<SubmitAnalysisResult, Error, AnalyzeMutationVariables>({
        mutationFn: ({ ...analyzeVars }) =>
            submitAnalysisAction(analyzeVars, latestTimeframeRef.current),
        onSuccess: (data, variables) => {
            if (data.status === 'cached') {
                setAnalysisResult(data.result);
            }
            if (!variables.force) return;
            setReanalyzeCooldownMs(REANALYZE_COOLDOWN_MS);
        },
        onError: (_error, variables) => {
            if (!variables.force) return;
            void releaseReanalyzeCooldown(
                variables.symbol,
                latestTimeframeRef.current
            );
            setReanalyzeCooldownMs(0);
        },
    });

    // Polling effect — submit 결과가 'submitted'이면 polling 시작
    useEffect(() => {
        if (!submitData || submitData.status !== 'submitted' || !submitData.jobId) {
            return;
        }

        const jobId = submitData.jobId;
        let cancelled = false;
        const startedAt = Date.now();

        setIsPolling(true);
        setPollError(null);

        void (async () => {
            while (!cancelled) {
                await sleep(POLL_INTERVAL_MS);
                if (cancelled) break;

                if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
                    setPollError('분석 시간이 초과되었습니다. 다시 시도해주세요.');
                    setIsPolling(false);
                    return;
                }

                try {
                    const result = await pollAnalysisAction(jobId);
                    if (cancelled) break;

                    if (result.status === 'done') {
                        setAnalysisResult(result.result);
                        setIsPolling(false);
                        return;
                    }
                    if (result.status === 'error') {
                        setPollError(result.error);
                        setIsPolling(false);
                        return;
                    }
                    // 'processing' → 다음 poll 계속
                } catch {
                    if (cancelled) break;
                    setPollError('분석 결과 조회에 실패했습니다.');
                    setIsPolling(false);
                    return;
                }
            }
        })();

        return () => {
            cancelled = true;
            setIsPolling(false);
        };
    }, [submitData]);

    // Derived variables
    const analysis = analysisResult ?? initialAnalysis;
    const isAnalyzing = isSubmitting || isPolling;
    const analysisError = submitError?.message ?? pollError ?? null;

    // Handlers
    // latestRef 패턴을 사용하므로 symbol·bars·indicators를 deps에서 제외하고 안정적인 함수 참조를 유지한다.
    // Redis 기반 쿨다운을 atomic하게 점유한 뒤에만 mutation을 실행한다.
    const handleReanalyze = useCallback((): void => {
        const vars = latestRef.current;
        const tf = latestTimeframeRef.current;
        void (async () => {
            const acquire = await tryAcquireReanalyzeCooldown(vars.symbol, tf);
            if (!acquire.ok) {
                setReanalyzeCooldownMs(acquire.remainingMs);
                setCooldownNotice({
                    nonce: Date.now(),
                    remainingMs: acquire.remainingMs,
                });
                return;
            }
            reset();
            setPollError(null);
            mutate({ ...vars, force: true });
        })();
    }, [reset, mutate]);

    // Effects

    // symbol, bars, indicators, timeframe의 최신 렌더 값을 DOM 커밋 전에 동기 갱신하여
    // mutation 호출 시점에 stale closure를 방지한다.
    // useLayoutEffect는 페인트 전에 동기적으로 실행되므로 useEffect보다 빠르게 갱신된다.
    useLayoutEffect(() => {
        latestRef.current = { symbol, bars, indicators };
        latestTimeframeRef.current = timeframe;
    });

    // 서버에서 초기 AI 분석이 실패한 경우 마운트 직후 자동으로 재분석을 실행한다.
    // initialAnalysisFailedRef는 초기 마운트 시 값을 캡처하므로 이후 변경에 영향받지 않는다.
    // latestRef는 useLayoutEffect에 의해 이 useEffect보다 먼저 현재 렌더의 props로 갱신된다.
    useEffect(() => {
        if (!initialAnalysisFailedRef.current) return;
        if (latestRef.current.bars.length === 0) return;
        mutate({ ...latestRef.current, force: false });
    }, [mutate]);

    // 타임프레임 변경 시 이전 mutation 상태를 초기화하고 새 분석을 자동 실행한다.
    // timeframeChangeCount를 활용하여 초기 마운트와 타임프��임 변경을 구분한다.
    // useSuspenseQuery로 인해 ChartContent가 remount될 때 isInitialMount ref가 초기화되는
    // 문제를 피하기 위해, Suspense 바깥의 SymbolPageClient에서 변경 횟수를 추적한다.
    // timeframeChangeCount > 0이면 타임프레임 변경으�� 인한 마운트이므로 즉시 분석을 실행한다.
    // latestRef는 useLayoutEffect에 의해 이 useEffect보다 먼저 현재 렌더의 props로 갱신된다.
    // ChartContent는 Suspense 경계 내에서 bars 로드가 완료된 후에만 remount되므로,
    // 이 시점의 latestRef.current.bars는 항상 새 타임프레임의 데이터다.
    useEffect(() => {
        if (timeframeChangeCount === prevTimeframeChangeCountRef.current) {
            return;
        }
        prevTimeframeChangeCountRef.current = timeframeChangeCount;
        reset();
        setPollError(null);
        if (latestRef.current.bars.length === 0) return;
        mutate({ ...latestRef.current, force: false });
    }, [timeframeChangeCount, reset, mutate]);

    // 쿨다운이 활성화된 동안 1초마다 로컬에서 카운트다운한다.
    // 진실값은 Redis이지만 매초 서버 호출을 피하기 위해 클라이언트에서 감산한다.
    useEffect(() => {
        if (reanalyzeCooldownMs <= 0) return;
        const startedAt = Date.now();
        const startValue = reanalyzeCooldownMs;
        const intervalId = window.setInterval(() => {
            const remaining = Math.max(
                0,
                startValue - (Date.now() - startedAt)
            );
            setReanalyzeCooldownMs(remaining);
            if (remaining <= 0) window.clearInterval(intervalId);
        }, 1000);
        return () => {
            window.clearInterval(intervalId);
        };
        // reanalyzeCooldownMs가 새 값으로 갱신될 때마다 effect가 재시작되어 startedAt도 다시 잡힌다.
        // 의도적으로 reanalyzeCooldownMs만 deps에 포함한다 — 매 tick마다 재시작되지 않도록
        // 내부에서는 startValue/startedAt 클로저로 단조 감소시킨다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reanalyzeCooldownMs === 0]);

    // 마운트 시점 및 심볼/타임프레임 변경 시 서버에서 쿨다운 진실값을 동기화한다.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const remaining = await fetchReanalyzeCooldownMs(symbol, timeframe);
            if (cancelled) return;
            setReanalyzeCooldownMs(remaining);
        })();
        return () => {
            cancelled = true;
        };
    }, [symbol, timeframe]);

    return {
        analysis,
        isAnalyzing,
        analysisError,
        handleReanalyze,
        reanalyzeCooldownMs,
        cooldownNotice,
    };
}
