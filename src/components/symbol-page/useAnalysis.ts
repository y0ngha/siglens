'use client';

import { useEffect, useRef, useState } from 'react';
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
    const [analysis, setAnalysis] = useState<AnalysisResponse>(initialAnalysis);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // 타임프레임이 변경되면 이전 타임프레임 기준의 분석 결과를 무효화한다.
    useEffect(() => {
        setAnalysis(initialAnalysisRef.current);
    }, [timeframe]);

    const handleReanalyze = async (): Promise<void> => {
        setIsAnalyzing(true);

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, bars, indicators }),
            });
            if (!res.ok) return;

            const nextAnalysis: AnalysisResponse = await res.json();
            setAnalysis(nextAnalysis);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return { analysis, isAnalyzing, handleReanalyze };
}
