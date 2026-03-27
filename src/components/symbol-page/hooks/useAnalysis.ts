'use client';

import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
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
    bars: Bar[];
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
    // symbol, bars, indicators의 최신 렌더 값을 ref에 동기화하여 mutation 호출 시점에 stale closure를 방지한다.
    const latestRef = useRef<AnalyzeVariables>({ symbol, bars, indicators });

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
    // latestRef 패턴을 사용하므로 deps 없이 안정적인 함수 참조를 유지한다.
    const handleReanalyze = useCallback((): void => {
        mutate(latestRef.current);
    }, [mutate]);

    // Effects
    useEffect(() => {
        latestRef.current = { symbol, bars, indicators };
    }, [symbol, bars, indicators]);

    // 타임프레임 변경 시 이전 mutation 상태를 초기화한다.
    useEffect(() => {
        reset();
    }, [timeframe, reset]);

    return {
        analysis,
        isAnalyzing: isPending,
        analysisError,
        handleReanalyze,
    };
}
