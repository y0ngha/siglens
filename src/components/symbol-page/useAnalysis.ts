'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    AnalysisResponse,
    Bar,
    IndicatorResult,
    Timeframe,
} from '@/domain/types';

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
    handleReanalyze: () => Promise<void>;
}

export function useAnalysis({
    symbol,
    initialAnalysis,
    timeframe,
    bars,
    indicators,
}: UseAnalysisOptions): UseAnalysisResult {
    const initialAnalysisRef = useRef(initialAnalysis);
    const isMountedRef = useRef(false);
    const [analysis, setAnalysis] = useState<AnalysisResponse>(initialAnalysis);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // 타임프레임이 변경되면 이전 타임프레임 기준의 분석 결과를 무효화한다.
    // initialAnalysisRef는 항상 최초 SSR 분석 결과를 가리키며, 이후 변경되지 않는다.
    // 따라서 타임프레임 전환 시 SSR 분석으로 초기화함으로써 오래된 분석이 표시되는 것을 방지한다.
    // isMountedRef로 마운트 시 최초 실행은 건너뛰고, 실제 타임프레임 변경 시에만 무효화한다.
    useEffect(() => {
        if (!isMountedRef.current) {
            isMountedRef.current = true;
            return;
        }
        setAnalysis(initialAnalysisRef.current);
        setAnalysisError(null);
    }, [timeframe]);

    const handleReanalyze = useCallback(async (): Promise<void> => {
        setIsAnalyzing(true);
        setAnalysisError(null);

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, bars, indicators }),
            });
            if (!res.ok) {
                setAnalysisError(`분석 요청에 실패했습니다 (${res.status})`);
                return;
            }

            const nextAnalysis: AnalysisResponse = await res.json();
            setAnalysis(nextAnalysis);
        } catch (_err) {
            setAnalysisError('분석 요청에 실패했습니다');
        } finally {
            setIsAnalyzing(false);
        }
    }, [symbol, bars, indicators]);

    return { analysis, isAnalyzing, analysisError, handleReanalyze };
}
