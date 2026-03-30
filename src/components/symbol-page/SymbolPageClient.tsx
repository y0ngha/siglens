'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
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
    initialAnalysisFailed: boolean;
}

export function SymbolPageClient({
    symbol,
    initialBars,
    initialIndicators,
    initialAnalysis,
    initialAnalysisFailed,
}: SymbolPageClientProps) {
    const { timeframe, handleTimeframeChange } = useTimeframeChange(symbol);
    // Suspense로 인해 ChartContent가 remount될 때 타임프레임 변경 여부를 전달한다.
    // timeframe 변경 횟수를 카운트하여 ChartContent가 타임프레임 변경으로 인해
    // mount된 것인지 초기 mount인지를 구분한다.
    const [timeframeChangeCount, setTimeframeChangeCount] = useState(0);
    const [prevTimeframe, setPrevTimeframe] = useState(timeframe);
    if (prevTimeframe !== timeframe) {
        setTimeframeChangeCount(c => c + 1);
        setPrevTimeframe(timeframe);
    }

    return (
        <div className="bg-secondary-900 text-secondary-200 flex h-full min-h-screen flex-col">
            {/* 헤더 */}
            <header className="border-secondary-700 border-b px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link
                            href="/"
                            className="text-secondary-500 hover:text-secondary-300 font-mono text-xs tracking-[0.2em] uppercase transition-colors"
                        >
                            SIGLENS
                        </Link>
                        <span className="text-secondary-700">/</span>
                        <h1 className="text-secondary-100 text-lg font-semibold tracking-wide">
                            {symbol}
                        </h1>
                    </div>
                    <div className="hidden sm:block">
                        <TimeframeSelector
                            value={timeframe}
                            onChange={handleTimeframeChange}
                        />
                    </div>
                </div>
                <div className="mt-2 sm:hidden">
                    <TimeframeSelector
                        value={timeframe}
                        onChange={handleTimeframeChange}
                    />
                </div>
            </header>

            {/* 메인 레이아웃 */}
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
                <ErrorBoundary
                    FallbackComponent={ChartErrorFallback}
                    resetKeys={[timeframe, symbol]}
                >
                    <Suspense fallback={<ChartSkeleton />}>
                        <ChartContent
                            symbol={symbol}
                            timeframe={timeframe}
                            timeframeChangeCount={timeframeChangeCount}
                            initialBars={initialBars}
                            initialIndicators={initialIndicators}
                            initialAnalysis={initialAnalysis}
                            initialAnalysisFailed={initialAnalysisFailed}
                        />
                    </Suspense>
                </ErrorBoundary>
            </div>
        </div>
    );
}
