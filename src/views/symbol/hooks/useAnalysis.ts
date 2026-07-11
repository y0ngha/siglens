'use client';

import { useMutation } from '@tanstack/react-query';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type {
    AnalysisResponse,
    ModelId,
    Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_MINUTE, MS_PER_SECOND } from '@/shared/config/time';
import {
    submitAnalysisAction,
    type SubmitAnalysisActionResult,
    pollAnalysisAction,
    cancelAnalysisJobAction,
} from '@/entities/analysis/actions';
import {
    getReanalyzeCooldownMs as fetchReanalyzeCooldownMs,
    releaseReanalyzeCooldown,
    tryAcquireReanalyzeCooldown,
    normalizeAnalysisResponse,
} from '@/entities/analysis';
import { sleep } from '@/shared/lib/sleep';
import { CHART_ANALYSIS_POLL_INTERVAL_MS } from '@/shared/config/pollingConfig';
import { usePageHideCancel } from '@/shared/hooks/usePageHideCancel';
import type { CancelJobEntry } from '@/shared/lib/types';

interface AnalyzeMutationVariables {
    symbol: string;
    companyName: string;
    force: boolean;
    fmpSymbol?: string;
    modelId?: ModelId;
    reasoning?: boolean;
}

/**
 * 재분석 쿨다운 (5분).
 * 진실값은 Redis(서버)이며 클라이언트는 표시 목적으로만 카운트다운한다.
 */
const REANALYZE_COOLDOWN_MS = 5 * MS_PER_MINUTE;

/** 캐시 히트(force=false 즉시 응답) 시 적용하는 짧은 클라이언트 쿨다운 — 같은 캐시의 빠른 반복 호출 방지. */
const CACHE_HIT_COOLDOWN_MS = 30 * MS_PER_SECOND;

interface UseAnalysisOptions {
    symbol: string;
    companyName: string;
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
    /**
     * useSelectedModel이 localStorage에서 저장된 모델을 읽어 hydration이 완료됐는지 여부.
     * false인 동안에는 초기 기본값(DEFAULT_MODEL)을 사용 중이므로
     * initialAnalysisFailed 자동 재분석과 model-change 재분석을 보류한다.
     * undefined이면 hydration 추적을 하지 않는다(하위 호환).
     */
    isModelHydrated?: boolean;
    /**
     * 효과적(tier-gated) "깊은 생각" reasoning 값 (member-reasoning-toggle spec
     * Part A). SymbolModelContext에서 온다 — 회원이 아니면 항상 `false`.
     */
    reasoning?: boolean;
    /**
     * useReasoningToggle의 localStorage read가 끝났는지 여부. isModelHydrated와
     * 동일한 목적 — hydration 중간에 스푸리어스 재분석이 트리거되지 않도록 한다.
     * undefined이면 hydration 추적을 하지 않는다(하위 호환).
     */
    isReasoningHydrated?: boolean;
}

// symbol-page → analysis는 허용된 하향 의존(cross-widget cross-import).
import type { CooldownNotice } from '@/widgets/analysis/model/types';
export type { CooldownNotice } from '@/widgets/analysis/model/types';

export interface UseAnalysisResult {
    analysis: AnalysisResponse;
    /** 새 분석이 완료됐을 때만 값이 세팅됨. initialAnalysis 기반 초기 로드엔 null. */
    analysisResult: AnalysisResponse | null;
    isAnalyzing: boolean;
    analysisError: string | null;
    /**
     * Server Action이 봇 트래픽으로 판정해 캐시 미스 시 워커 작업을 enqueue하지
     * 않고 반환한 상태. UI에서 BotBlockedNotice를 렌더한다.
     */
    isBotBlocked: boolean;
    handleReanalyze: () => void;
    /** 다음 재분석까지 남은 ms. 0이면 즉시 가능. */
    reanalyzeCooldownMs: number;
    /** 사용자가 쿨다운 중에 재분석 버튼을 눌렀을 때 갱신되는 알림. */
    cooldownNotice: CooldownNotice | null;
}

export function useAnalysis({
    symbol,
    companyName,
    timeframe,
    initialAnalysis,
    initialAnalysisFailed,
    fmpSymbol,
    timeframeChangeCount,
    modelId,
    isModelHydrated,
    reasoning,
    isReasoningHydrated,
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
    const [isBotBlocked, setIsBotBlocked] = useState(false);
    // 초기 마운트 시 서버 분석 실패 여부를 캡처한다.
    // useState 초기화로 마운트 시 1회만 평가되며, 이후 prop 변경이 있어도 갱신되지 않는다.
    // useRef를 쓰지 않는 이유: 렌더 중 접근이 필요해 react-hooks/refs 룰을 위반하기 때문.
    const [initialAnalysisFailedAtMount] = useState(initialAnalysisFailed);

    // 2. useRef
    const latestRef = useRef<{
        symbol: string;
        companyName: string;
        fmpSymbol?: string;
    }>({
        symbol,
        companyName,
        fmpSymbol,
    });
    const latestTimeframeRef = useRef<Timeframe>(timeframe);
    const latestModelIdRef = useRef<ModelId | undefined>(modelId);
    const latestReasoningRef = useRef<boolean | undefined>(reasoning);
    const prevTimeframeChangeCountRef = useRef(0);
    const prevModelIdRef = useRef<ModelId | undefined>(modelId);
    const prevReasoningRef = useRef<boolean | undefined>(reasoning);
    /**
     * localStorage hydration으로 인한 model 변경(마운트 직후 DEFAULT_MODEL → 저장값)을
     * 사용자 의도 변경과 구분하기 위한 플래그.
     * isModelHydrated가 처음 true가 됐을 때 prevModelIdRef를 동기화한 뒤 true로 설정한다.
     */
    const hasHandledModelHydrationRef = useRef(
        isModelHydrated !== false // undefined(추적 안 함)이면 처음부터 true로 취급
    );
    /**
     * localStorage hydration으로 인한 reasoning 변경(마운트 직후 false → 저장값)을
     * 사용자 의도 변경과 구분하기 위한 플래그. hasHandledModelHydrationRef와 동일 패턴.
     */
    const hasHandledReasoningHydrationRef = useRef(
        isReasoningHydrated !== false // undefined(추적 안 함)이면 처음부터 true로 취급
    );
    // 현재 진행 중인 워커 job ID. 타임프레임 변경 시 취소 신호 전달에 사용.
    const currentJobIdRef = useRef<string | null>(null);
    // polling 완료 시 force 경로 쿨다운 처리를 위해 마지막 요청의 force 여부를 추적
    const lastForceRef = useRef(false);

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
            companyName: mutCompanyName,
            fmpSymbol: mutFmpSymbol,
            modelId: mutModelId,
            reasoning: mutReasoning,
        }) => {
            lastForceRef.current = force;
            return submitAnalysisAction(
                mutSymbol,
                mutCompanyName,
                latestTimeframeRef.current,
                force,
                mutFmpSymbol,
                mutModelId,
                mutReasoning
            );
        },
        onMutate: () => {
            setPollError(null);
            setAnalysisResult(null);
            setIsBotBlocked(false);
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
                setIsPolling(true);
                // submitted 단계에서는 쿨다운을 시작하지 않는다.
                // polling 완료(done) 시에만 쿨다운을 시작한다.
            } else if (data.status === 'miss_no_trigger') {
                // 별도 boolean 상태로 추적하는 이유: 이 훅은 useMutation 기반이라
                // useQuery처럼 에러 브랜치 narrowing으로 비-데이터 상태를 표현할
                // 수 없다. 다른 세 분석 훅(fundamental/news/overall)은 useQuery
                // 기반이라 BotBlockedError 던지기로 동일 의미를 표현한다.
                currentJobIdRef.current = null;
                setIsBotBlocked(true);
            } else if (data.status === 'key_error') {
                currentJobIdRef.current = null;
                setPollError(data.error);
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

    // `@y0ngha/siglens-core`가 부분 응답(누락된 배열/객체)을 돌려줄 수 있으므로
    // 소스에서 1회 정규화해 타입 계약을 런타임에서 다시 보장한다. 이 결과를
    // AnalysisPanel·buildExpertAnalysisReport·useAnalysisDerivedData가 공유한다.
    // (훅은 파생 변수보다 먼저 선언 — MISTAKES §17)
    const analysis = useMemo(
        () => normalizeAnalysisResponse(analysisResult ?? initialAnalysis),
        [analysisResult, initialAnalysis]
    );

    // 5. Derived variables
    const isAnalyzing =
        isSubmitting ||
        isPolling ||
        (initialAnalysisFailedAtMount &&
            (isModelHydrated === false || isReasoningHydrated === false));
    const analysisError = submitError?.message ?? pollError ?? null;
    // 쿨다운 카운트다운이 활성화된 상태. effect deps에 사용해 불필요한 재시작을 방지한다.
    const isCountdownActive = reanalyzeCooldownMs > 0;

    // 6. Handlers
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
                companyName: latestRef.current.companyName,
                force: true,
                fmpSymbol: latestFmpSymbol,
                modelId: latestModelIdRef.current,
                reasoning: latestReasoningRef.current,
            });
        })();
    }, [reset, mutate]);

    /**
     * 타임프레임 변경·모델 변경·reasoning 변경 세 effect에서 공유한다.
     * modelIdOverride/reasoningOverride 미전달 시 각각 latestModelIdRef/
     * latestReasoningRef(=최신 렌더 값)를 사용한다.
     */
    const restartAnalysis = useCallback(
        (modelIdOverride?: ModelId, reasoningOverride?: boolean): void => {
            const jobId = currentJobIdRef.current;
            currentJobIdRef.current = null;
            if (jobId !== null) cancelMutate(jobId);
            reset();
            mutate({
                symbol: latestRef.current.symbol,
                companyName: latestRef.current.companyName,
                force: false,
                fmpSymbol: latestRef.current.fmpSymbol,
                modelId: modelIdOverride ?? latestModelIdRef.current,
                reasoning: reasoningOverride ?? latestReasoningRef.current,
            });
        },
        [cancelMutate, reset, mutate]
    );

    // ref를 null로 초기화해 unmount cleanup과의 이중 cancel을 방지한다.
    const getPageHideJobs = useCallback((): CancelJobEntry[] | null => {
        const jobId = currentJobIdRef.current;
        if (jobId === null) return null;
        currentJobIdRef.current = null;
        return [{ jobId, type: 'analysis' as const }];
    }, []);
    usePageHideCancel(getPageHideJobs);

    // 7. useLayoutEffect
    // symbol, timeframe의 최신 렌더 값을 DOM 커밋 전에 동기 갱신하여
    // mutation 호출 시점에 stale closure를 방지한다.
    useLayoutEffect(() => {
        latestRef.current = { symbol, companyName, fmpSymbol };
        latestTimeframeRef.current = timeframe;
        latestModelIdRef.current = modelId;
        latestReasoningRef.current = reasoning;
    });

    // 8. useEffect

    // 폴링 — submit 결과가 'submitted'이면 polling 시작.
    // setState는 async IIFE 내부에서 호출되므로 react-hooks/set-state-in-effect 규칙 위반이 아니다.
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

        void (async () => {
            while (!cancelled) {
                await sleep(CHART_ANALYSIS_POLL_INTERVAL_MS);
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

    // 서버에서 초기 AI 분석이 실패한 경우, localStorage hydration이 완료된 뒤 자동으로 재분석을 실행한다.
    // isModelHydrated=false 동안에는 기본값(DEFAULT_MODEL)이 사용 중이므로 hydration 완료까지 대기한다.
    // isReasoningHydrated도 동일하게 대기한다 — 그렇지 않으면 회원의 저장된 reasoning=true가
    // 반영되기 전에 reasoning=false(기본값)로 초기 재시도가 나가버린다.
    useEffect(() => {
        if (!initialAnalysisFailedAtMount) return;
        if (isModelHydrated === false) return;
        if (isReasoningHydrated === false) return;
        // 초기 실패 재시도는 이미 reset/cancel 없이 진행 — 진행 중인 작업이 없는 상태에서만 도달한다.
        mutate({
            symbol: latestRef.current.symbol,
            companyName: latestRef.current.companyName,
            force: false,
            fmpSymbol: latestRef.current.fmpSymbol,
            modelId: latestModelIdRef.current,
            reasoning: latestReasoningRef.current,
        });
    }, [
        mutate,
        isModelHydrated,
        isReasoningHydrated,
        initialAnalysisFailedAtMount,
    ]);

    // 타임프레임 변경 시 진행 중인 워커 작업을 취소하고, 이전 mutation 상태를 초기화한 뒤 새 분석을 자동 실행한다.
    useEffect(() => {
        if (timeframeChangeCount === prevTimeframeChangeCountRef.current) {
            return;
        }
        prevTimeframeChangeCountRef.current = timeframeChangeCount;
        restartAnalysis();
    }, [timeframeChangeCount, restartAnalysis]);

    useEffect(() => {
        // localStorage에서 저장된 모델을 처음 읽는 시점(hydration)은 사용자 변경이 아니므로
        // prevModelIdRef를 동기화만 하고 재분석은 트리거하지 않는다.
        if (!hasHandledModelHydrationRef.current && isModelHydrated !== false) {
            hasHandledModelHydrationRef.current = true;
            prevModelIdRef.current = modelId;
            return;
        }

        if (modelId === prevModelIdRef.current) return;
        prevModelIdRef.current = modelId;

        // 모델 변경은 새 modelId를 명시 전달 — latestModelIdRef가 렌더 직후 갱신되지 않은
        // 경우에도 useLayoutEffect 전에 이 effect가 실행될 수 있으므로 값을 직접 주입한다.
        restartAnalysis(modelId);
    }, [modelId, isModelHydrated, restartAnalysis]);

    // 토글 변경 시 재분석(다른 캐시 키) — modelId 변경 effect와 완전히 동일한 패턴.
    // localStorage hydration으로 인한 reasoning 변경(마운트 직후 false → 저장값)은
    // 사용자 의도 변경이 아니므로 재분석을 트리거하지 않는다.
    useEffect(() => {
        if (
            !hasHandledReasoningHydrationRef.current &&
            isReasoningHydrated !== false
        ) {
            hasHandledReasoningHydrationRef.current = true;
            prevReasoningRef.current = reasoning;
            return;
        }

        if (reasoning === prevReasoningRef.current) return;
        prevReasoningRef.current = reasoning;

        // 회원의 명시적 토글 변경은 새 reasoning 값을 직접 주입한다 — modelId 변경과
        // 동일 이유(latestReasoningRef가 이 effect보다 늦게 갱신될 수 있음).
        restartAnalysis(undefined, reasoning);
    }, [reasoning, isReasoningHydrated, restartAnalysis]);

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

    // 마운트 / symbol·timeframe 변경 시 서버 쿨다운 진실값을 동기화한다.
    // setState는 async IIFE 내부에서 호출되므로 react-hooks/set-state-in-effect 규칙 위반이 아니다.
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

    // fire-and-forget이므로 useMutation 없이 직접 호출한다.
    useEffect(() => {
        return () => {
            const jobId = currentJobIdRef.current;
            if (jobId !== null) {
                currentJobIdRef.current = null;
                void cancelAnalysisJobAction(jobId).catch(error => {
                    console.warn('[useAnalysis] cancel failed', error);
                });
            }
        };
    }, [symbol]);

    return {
        analysis,
        analysisResult,
        isAnalyzing,
        analysisError,
        isBotBlocked,
        handleReanalyze,
        reanalyzeCooldownMs,
        cooldownNotice,
    };
}
