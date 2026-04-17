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
    Timeframe,
    SubmitAnalysisResult,
} from '@/domain/types';
import { MS_PER_MINUTE } from '@/domain/constants/time';
import { submitAnalysisAction } from '@/infrastructure/market/submitAnalysisAction';
import { pollAnalysisAction } from '@/infrastructure/market/pollAnalysisAction';
import { cancelAnalysisJobAction } from '@/infrastructure/market/cancelAnalysisJobAction';
import {
    tryAcquireReanalyzeCooldown,
    releaseReanalyzeCooldown,
    getReanalyzeCooldownMs as fetchReanalyzeCooldownMs,
} from '@/infrastructure/market/reanalyzeCooldown';
import { sleep } from '@/components/symbol-page/utils/sleep';

interface AnalyzeMutationVariables {
    symbol: string;
    force: boolean;
}

/**
 * 재분석 쿨다운 (5분).
 * 진실값은 Redis(서버)이며 클라이언트는 표시 목적으로만 카운트다운한다.
 */
const REANALYZE_COOLDOWN_MS = 5 * MS_PER_MINUTE;

const POLL_INTERVAL_MS = 10000;

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

export function useAnalysis({
    symbol,
    timeframe,
    initialAnalysis,
    initialAnalysisFailed,
    timeframeChangeCount,
}: UseAnalysisOptions): UseAnalysisResult {
    // 1. useState
    const [analysisResult, setAnalysisResult] =
        useState<AnalysisResponse | null>(null);
    const [reanalyzeCooldownMs, setReanalyzeCooldownMs] = useState<number>(0);
    const [cooldownNotice, setCooldownNotice] = useState<CooldownNotice | null>(
        null
    );
    const [isPolling, setIsPolling] = useState(false);
    const [pollError, setPollError] = useState<string | null>(null);

    // 2. useRef
    const latestRef = useRef<{ symbol: string }>({ symbol });
    const latestTimeframeRef = useRef<Timeframe>(timeframe);
    const prevTimeframeChangeCountRef = useRef(0);
    // 현재 진행 중인 워커 job ID. 타임프레임 변경 시 취소 신호 전달에 사용.
    const currentJobIdRef = useRef<string | null>(null);
    // 초기 마운트 시 서버 분석 실패 여부를 캡처한다.
    // 이후 렌더링에서 이 값이 변경되더라도 마운트 시 한 번만 사용된다.
    const initialAnalysisFailedRef = useRef(initialAnalysisFailed);
    // polling 완료 시 force 경로 쿨다운 처리를 위해 마지막 요청의 force 여부를 추적
    const lastForceRef = useRef(false);
    // 3. useMutation
    const {
        data: submitData,
        error: submitError,
        isPending: isSubmitting,
        reset,
        mutate,
    } = useMutation<SubmitAnalysisResult, Error, AnalyzeMutationVariables>({
        mutationFn: ({ force, symbol: mutSymbol }) => {
            lastForceRef.current = force;
            return submitAnalysisAction(mutSymbol, latestTimeframeRef.current);
        },
        onSuccess: (data, variables) => {
            if (data.status === 'cached') {
                currentJobIdRef.current = null;
                setAnalysisResult(data.result);
                // 캐시 히트 = 분석 완료 → force 경로만 쿨다운 시작
                if (variables.force) {
                    setReanalyzeCooldownMs(REANALYZE_COOLDOWN_MS);
                }
            } else if (data.status === 'submitted') {
                currentJobIdRef.current = data.jobId;
                setIsPolling(true);
                // submitted 단계에서는 쿨다운을 시작하지 않는다.
                // polling 완료(done) 시에만 쿨다운을 시작한다.
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

    // 4. Derived variables
    const analysis = analysisResult ?? initialAnalysis;
    const isAnalyzing = isSubmitting || isPolling;
    const analysisError = submitError?.message ?? pollError ?? null;
    // 쿨다운 카운트다운이 활성화된 상태. effect deps에 사용해 불필요한 재시작을 방지한다.
    const isCountdownActive = reanalyzeCooldownMs > 0;

    // 5. Handlers
    // latestRef 패턴을 사용하므로 symbol을 deps에서 제외하고 안정적인 함수 참조를 유지한다.
    // Redis 기반 쿨다운을 atomic하게 점유한 뒤에만 mutation을 실행한다.
    const handleReanalyze = useCallback((): void => {
        const { symbol: latestSymbol } = latestRef.current;
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
            setPollError(null);
            setAnalysisResult(null);
            mutate({ symbol: latestSymbol, force: true });
        })();
    }, [reset, mutate]);

    // 6. useLayoutEffect
    // symbol, timeframe의 최신 렌더 값을 DOM 커밋 전에 동기 갱신하여
    // mutation 호출 시점에 stale closure를 방지한다.
    useLayoutEffect(() => {
        latestRef.current = { symbol };
        latestTimeframeRef.current = timeframe;
    });

    // 7. useEffect

    // 폴링 — submit 결과가 'submitted'이면 polling 시작
    useEffect(() => {
        if (
            !submitData ||
            submitData.status !== 'submitted' ||
            !submitData.jobId
        ) {
            return;
        }

        const jobId = submitData.jobId;
        let cancelled = false;

        setPollError(null);

        void (async () => {
            while (!cancelled) {
                await sleep(POLL_INTERVAL_MS);
                if (cancelled) break;

                try {
                    const result = await pollAnalysisAction(jobId);
                    if (cancelled) break;

                    if (result.status === 'done') {
                        currentJobIdRef.current = null;
                        setAnalysisResult(result.result);
                        if (lastForceRef.current) {
                            setReanalyzeCooldownMs(REANALYZE_COOLDOWN_MS);
                        }
                        setIsPolling(false);
                        return;
                    }
                    if (result.status === 'error') {
                        currentJobIdRef.current = null;
                        // worker/src/retry.ts AI_SERVER_UNSTABLE_CODE 센티넬과 동기화 필요
                        const errorMessage =
                            result.error === 'AI_SERVER_UNSTABLE'
                                ? "죄송합니다. AI 서버가 불안정합니다. 잠시 후 다시 시도해 주세요. 반복해서 발생할 경우 하단 '오류 제보하기'를 이용해 주세요."
                                : result.error;
                        setPollError(errorMessage);
                        if (lastForceRef.current) {
                            void releaseReanalyzeCooldown(
                                latestRef.current.symbol,
                                latestTimeframeRef.current
                            );
                            setReanalyzeCooldownMs(0);
                        }
                        setIsPolling(false);
                        return;
                    }
                    // 'processing' → 다음 poll 계속
                } catch {
                    if (cancelled) break;
                    currentJobIdRef.current = null;
                    setPollError('분석 결과 조회에 실패했습니다.');
                    if (lastForceRef.current) {
                        void releaseReanalyzeCooldown(
                            latestRef.current.symbol,
                            latestTimeframeRef.current
                        );
                        setReanalyzeCooldownMs(0);
                    }
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

    // 서버에서 초기 AI 분석이 실패한 경우 마운트 직후 자동으로 재분석을 실행한다.
    useEffect(() => {
        if (!initialAnalysisFailedRef.current) return;
        mutate({ symbol: latestRef.current.symbol, force: false });
    }, [mutate]);

    // 타임프레임 변경 시 진행 중인 워커 작업을 취소하고, 이전 mutation 상태를 초기화한 뒤 새 분석을 자동 실행한다.
    useEffect(() => {
        if (timeframeChangeCount === prevTimeframeChangeCountRef.current) {
            return;
        }
        prevTimeframeChangeCountRef.current = timeframeChangeCount;

        // 진행 중인 워커 작업에 취소 신호를 보낸다. reset() 호출 이전에 jobId를 캡처해야 한다.
        const jobId = currentJobIdRef.current;
        if (jobId) {
            void cancelAnalysisJobAction(jobId);
            currentJobIdRef.current = null;
        }

        reset();
        setPollError(null);
        setAnalysisResult(null);
        mutate({ symbol: latestRef.current.symbol, force: false });
    }, [timeframeChangeCount, reset, mutate]);

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
