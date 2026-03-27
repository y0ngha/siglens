'use client';

import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import type { AnalysisResponse, Bar, IndicatorResult } from '@/domain/types';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { ChartErrorFallback } from '@/components/chart/ChartErrorFallback';
import { ChartContent } from '@/components/symbol-page/ChartContent';
import { useTimeframeChange } from '@/components/symbol-page/hooks/useTimeframeChange';

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
    const { timeframe, handleTimeframeChange } = useTimeframeChange(symbol);

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
            <div className="relative flex flex-1 overflow-hidden">
                <ErrorBoundary FallbackComponent={ChartErrorFallback}>
                    <Suspense fallback={<ChartSkeleton />}>
                        <ChartContent
                            symbol={symbol}
                            timeframe={timeframe}
                            initialBars={initialBars}
                            initialIndicators={initialIndicators}
                            initialAnalysis={initialAnalysis}
                        />
                    </Suspense>
                </ErrorBoundary>
            </div>
        </div>
    );
}
