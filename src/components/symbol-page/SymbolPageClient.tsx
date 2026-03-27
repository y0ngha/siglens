'use client';

import { Suspense, useCallback, useState, useTransition } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useQueryClient } from '@tanstack/react-query';
import type {
    AnalysisResponse,
    Bar,
    IndicatorResult,
    Timeframe,
} from '@/domain/types';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { ChartErrorFallback } from '@/components/chart/ChartErrorFallback';
import { ChartContent } from '@/components/symbol-page/ChartContent';
import { QUERY_KEYS } from '@/lib/queryConfig';

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
    const [, startTransition] = useTransition();
    const queryClient = useQueryClient();

    const handleTimeframeChange = useCallback(
        (nextTimeframe: Timeframe): void => {
            if (nextTimeframe === timeframe) return;
            // 이전 타임프레임 쿼리 취소 — 불필요한 네트워크 요청 방지
            void queryClient.cancelQueries({
                queryKey: QUERY_KEYS.bars(symbol, timeframe),
            });
            startTransition(() => {
                setTimeframe(nextTimeframe);
            });
        },
        [timeframe, queryClient, symbol, startTransition]
    );

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
