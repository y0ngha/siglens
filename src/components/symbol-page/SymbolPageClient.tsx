'use client';

import { useState } from 'react';
import { calculateIndicators } from '@/domain/indicators';
import type {
    AnalysisResponse,
    Bar,
    IndicatorResult,
    Timeframe,
} from '@/domain/types';
import { StockChart } from '@/components/chart/StockChart';
import { VolumeChart } from '@/components/chart/VolumeChart';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import {
    DEFAULT_TIMEFRAME,
    TIMEFRAME_BARS_LIMIT,
} from '@/domain/constants/market';

interface SymbolPageClientProps {
    symbol: string;
    initialBars: Bar[];
    initialIndicators: IndicatorResult;
    initialAnalysis: AnalysisResponse;
}

export function SymbolPageClient({
    symbol,
    initialBars,
    initialIndicators,
    initialAnalysis,
}: SymbolPageClientProps) {
    const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
    const [bars, setBars] = useState<Bar[]>(initialBars);
    const [indicators, setIndicators] =
        useState<IndicatorResult>(initialIndicators);
    const [analysis, setAnalysis] = useState<AnalysisResponse>(initialAnalysis);
    const [isLoadingBars, setIsLoadingBars] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleTimeframeChange = async (nextTimeframe: Timeframe) => {
        if (nextTimeframe === timeframe) return;
        setIsLoadingBars(true);

        try {
            const limit = TIMEFRAME_BARS_LIMIT[nextTimeframe];
            const res = await fetch(
                `/api/bars?symbol=${encodeURIComponent(symbol)}&timeframe=${nextTimeframe}&limit=${limit}`
            );
            if (!res.ok) return;

            const data: { bars: Bar[] } = await res.json();
            const nextBars = data.bars;
            const nextIndicators = calculateIndicators(nextBars);

            setTimeframe(nextTimeframe);
            setBars(nextBars);
            setIndicators(nextIndicators);
        } finally {
            setIsLoadingBars(false);
        }
    };

    const handleReanalyze = async () => {
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

    return (
        <div className="bg-secondary-900 text-secondary-200 flex h-full min-h-screen flex-col">
            {/* 헤더 */}
            <header className="border-secondary-700 flex items-center justify-between border-b px-6 py-3">
                <h1 className="text-secondary-100 text-lg font-semibold tracking-wide">
                    {symbol}
                </h1>
                <TimeframeSelector
                    value={timeframe}
                    onChange={handleTimeframeChange}
                />
            </header>

            {/* 메인 레이아웃 */}
            <div className="flex flex-1 overflow-hidden">
                {/* 차트 영역 */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* 캔들 차트 */}
                    <div className="relative flex-[3]">
                        {isLoadingBars && (
                            <div className="bg-secondary-900/60 absolute inset-0 z-10 flex items-center justify-center">
                                <span className="text-secondary-400 text-sm">
                                    데이터 로딩 중...
                                </span>
                            </div>
                        )}
                        <StockChart
                            initialBars={bars}
                            indicators={indicators}
                        />
                    </div>

                    {/* 거래량 차트 */}
                    <div className="border-secondary-700 flex-1 border-t">
                        <VolumeChart bars={bars} />
                    </div>
                </div>

                {/* AI 분석 패널 */}
                <aside className="border-secondary-700 w-80 shrink-0 overflow-y-auto border-l p-4">
                    {isAnalyzing && (
                        <div className="bg-secondary-700/40 mb-3 flex items-center gap-2 rounded px-3 py-2">
                            <span className="text-secondary-400 text-sm">
                                AI 분석 중...
                            </span>
                        </div>
                    )}
                    <AnalysisPanel
                        analysis={analysis}
                        onReanalyze={handleReanalyze}
                    />
                </aside>
            </div>
        </div>
    );
}
