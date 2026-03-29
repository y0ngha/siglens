'use client';

import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type {
    AnalysisResponse,
    AnalyzeVariables,
    Bar,
    IndicatorResult,
    Timeframe,
} from '@/domain/types';
import { postAnalyze } from '@/infrastructure/market/analysisApi';

interface UseAnalysisOptions {
    symbol: string;
    initialAnalysis: AnalysisResponse;
    timeframe: Timeframe;
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
    timeframe,
    bars,
    indicators,
}: UseAnalysisOptions): UseAnalysisResult {
    // Refs
    const latestRef = useRef<AnalyzeVariables>({ symbol, bars, indicators });
    const isInitialMount = useRef(true);

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
    // useLayoutEffect가 먼저 실행되어 latestRef.current에 최신 bars·indicators가 담겨 있으므로
    // mutate(latestRef.current)는 새 타임프레임 데이터를 기반으로 분석을 실행한다.
    // 초기 마운트 시에는 initialAnalysis가 이미 있으므로 API를 중복 호출하지 않도록 건너뛴다.
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        reset();
        mutate(latestRef.current);
    }, [timeframe, reset, mutate]);

    return {
        analysis,
        isAnalyzing: isPending,
        analysisError,
        handleReanalyze,
    };
}
