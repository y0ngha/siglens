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
            <span className="text-secondary-400 text-sm">AI 분석 중…</span>
        </div>
    );
}

interface ErrorBannerProps {
    message: string;
}

function ErrorBanner({ message }: ErrorBannerProps) {
    return (
        <div className="bg-secondary-700/40 mb-3 rounded px-3 py-2">
            <span className="text-chart-bearish text-sm">{message}</span>
        </div>
    );
}

const ANALYSIS_STATUS_BANNER: Record<
    AnalysisStatus['type'],
    (status: AnalysisStatus) => ReactNode
> = {
    idle: () => null,
    analyzing: () => <AnalyzingBanner />,
    error: s => {
        const err = s as Extract<AnalysisStatus, { type: 'error' }>;
        return <ErrorBanner message={err.message} />;
    },
};

function AnalysisStatusBanner({ status }: AnalysisStatusBannerProps) {
    return ANALYSIS_STATUS_BANNER[status.type](status);
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
            <div className="flex h-[60vh] flex-col overflow-hidden md:h-auto md:flex-1">
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
            <aside
                className="border-secondary-700 overflow-y-auto border-t p-4 md:w-80 md:shrink-0 md:border-t-0 md:border-l"
                aria-live="polite"
            >
                <AnalysisStatusBanner status={analysisStatus} />
                <AnalysisPanel
                    analysis={analysis}
                    isAnalyzing={isAnalyzing}
                    onReanalyze={handleReanalyze}
                />
            </aside>
        </>
    );
}
