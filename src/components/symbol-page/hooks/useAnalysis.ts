'use client';

import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type {
    AnalysisResponse,
    AnalyzeVariables,
    Bar,
    IndicatorResult,
} from '@/domain/types';
import { postAnalyze } from '@/infrastructure/market/analysisApi';

interface UseAnalysisOptions {
    symbol: string;
    initialAnalysis: AnalysisResponse;
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

interface UseAnalysisResult {
    analysis: AnalysisResponse;
    isAnalyzing: boolean;
    analysisError: string | null;
    handleReanalyze: () => void;
}

export function useAnalysis({
    symbol,
    initialAnalysis,
    timeframeChangeCount,
    bars,
    indicators,
}: UseAnalysisOptions): UseAnalysisResult {
    // Refs
    const latestRef = useRef<AnalyzeVariables>({ symbol, bars, indicators });
    const prevTimeframeChangeCountRef = useRef(0);

    // Query hooks
    const { data, error, isPending, reset, mutate } = useMutation<
        AnalysisResponse,
        Error,
        AnalyzeVariables
    >({
        mutationFn: postAnalyze,
    });

    // Derived variables
    const analysis = data ?? initialAnalysis;
    const analysisError = error?.message ?? null;

    // Handlers
    // latestRef 패턴을 사용하므로 symbol·bars·indicators를 deps에서 제외하고 안정적인 함수 참조를 유지한다.
    const handleReanalyze = useCallback((): void => {
        mutate(latestRef.current);
    }, [mutate]);

    // Effects

    // symbol, bars, indicators의 최신 렌더 값을 DOM 커밋 전에 동기 갱신하여
    // mutation 호출 시점에 stale closure를 방지한다.
    // useLayoutEffect는 페인트 전에 동기적으로 실행되므로 useEffect보다 빠르게 갱신된다.
    useLayoutEffect(() => {
        latestRef.current = { symbol, bars, indicators };
    });

    // 타임프레임 변경 시 이전 mutation 상태를 초기화하고 새 분석을 자동 실행한다.
    // timeframeChangeCount를 활용하여 초기 마운트와 타임프레임 변경을 구분한다.
    // useSuspenseQuery로 인해 ChartContent가 remount될 때 isInitialMount ref가 초기화되는
    // 문제를 피하기 위해, Suspense 바깥의 SymbolPageClient에서 변경 횟수를 추적한다.
    // timeframeChangeCount > 0이면 타임프레임 변경으로 인한 마운트이므로 즉시 분석을 실행한다.
    // latestRef는 useLayoutEffect에 의해 이 useEffect보다 먼저 현재 렌더의 props로 갱신된다.
    // ChartContent는 Suspense 경계 내에서 bars 로드가 완료된 후에만 remount되므로,
    // 이 시점의 latestRef.current.bars는 항상 새 타임프레임의 데이터다.
    useEffect(() => {
        if (timeframeChangeCount === prevTimeframeChangeCountRef.current) {
            return;
        }
        prevTimeframeChangeCountRef.current = timeframeChangeCount;
        reset();
        mutate(latestRef.current);
    }, [timeframeChangeCount, reset, mutate]);

    return {
        analysis,
        isAnalyzing: isPending,
        analysisError,
        handleReanalyze,
    };
}
