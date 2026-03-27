'use client';

import type { ReactNode } from 'react';
import type {
    AnalysisResponse,
    Bar,
    IndicatorResult,
    Timeframe,
} from '@/domain/types';
import { StockChart } from '@/components/chart/StockChart';
import { VolumeChart } from '@/components/chart/VolumeChart';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { useBars } from '@/components/symbol-page/hooks/useBars';
import { useAnalysis } from '@/components/symbol-page/hooks/useAnalysis';

type AnalysisStatus =
    | { type: 'idle' }
    | { type: 'analyzing' }
    | { type: 'error'; message: string };

interface AnalysisStatusBannerProps {
    status: AnalysisStatus;
}

function AnalyzingBanner() {
    return (
        <div className="bg-secondary-700/40 mb-3 flex items-center gap-2 rounded px-3 py-2">
            <span className="text-secondary-400 text-sm">AI 분석 중...</span>
        </div>
    );
}

interface ErrorBannerProps {
    message: string;
}

function ErrorBanner({ message }: ErrorBannerProps) {
    return (
        <div className="bg-secondary-700/40 mb-3 rounded px-3 py-2">
            <span className="text-sm text-red-400">{message}</span>
        </div>
    );
}

const ANALYSIS_STATUS_BANNER: {
    [K in AnalysisStatus['type']]: (
        status: Extract<AnalysisStatus, { type: K }>
    ) => ReactNode;
} = {
    idle: () => null,
    analyzing: () => <AnalyzingBanner />,
    error: status => <ErrorBanner message={status.message} />,
};

function AnalysisStatusBanner({ status }: AnalysisStatusBannerProps) {
    // `status as never` is required because TypeScript cannot narrow the mapped-type
    // lookup: ANALYSIS_STATUS_BANNER[status.type] expects
    // Extract<AnalysisStatus, { type: typeof status.type }>, but after indexing with
    // the union key the inferred parameter type widens to the full union. Casting to
    // `never` satisfies the per-key function signature without losing type safety
    // elsewhere, since the map itself is exhaustively typed above.
    return ANALYSIS_STATUS_BANNER[status.type](status as never);
}

function getAnalysisStatus(
    isAnalyzing: boolean,
    analysisError: string | null
): AnalysisStatus {
    if (isAnalyzing) return { type: 'analyzing' };
    if (analysisError !== null)
        return { type: 'error', message: analysisError };
    return { type: 'idle' };
}

interface ChartContentProps {
    symbol: string;
    timeframe: Timeframe;
    initialBars: Bar[];
    initialIndicators: IndicatorResult;
    initialAnalysis: AnalysisResponse;
}

export function ChartContent({
    symbol,
    timeframe,
    initialBars,
    initialIndicators,
    initialAnalysis,
}: ChartContentProps) {
    const { bars, indicators } = useBars({
        symbol,
        timeframe,
        initialBars,
        initialIndicators,
    });

    const { analysis, isAnalyzing, analysisError, handleReanalyze } =
        useAnalysis({
            symbol,
            initialAnalysis,
            timeframe,
            bars,
            indicators,
        });

    const analysisStatus = getAnalysisStatus(isAnalyzing, analysisError);

    return (
        <>
            {/* 차트 영역 */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* 캔들 차트 */}
                <div className="relative flex-3">
                    <StockChart bars={bars} indicators={indicators} />
                </div>

                {/* 거래량 차트 */}
                <div className="border-secondary-700 flex-1 border-t">
                    <VolumeChart bars={bars} />
                </div>
            </div>

            {/* AI 분석 패널 */}
            <aside className="border-secondary-700 w-80 shrink-0 overflow-y-auto border-l p-4">
                <AnalysisStatusBanner status={analysisStatus} />
                <AnalysisPanel
                    analysis={analysis}
                    onReanalyze={handleReanalyze}
                />
            </aside>
        </>
    );
}
