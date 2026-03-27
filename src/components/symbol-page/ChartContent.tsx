'use client';

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

function AnalysisStatusBanner({ status }: AnalysisStatusBannerProps) {
    if (status.type === 'analyzing') {
        return (
            <div className="bg-secondary-700/40 mb-3 flex items-center gap-2 rounded px-3 py-2">
                <span className="text-secondary-400 text-sm">
                    AI 분석 중...
                </span>
            </div>
        );
    }

    if (status.type === 'error') {
        return (
            <div className="bg-secondary-700/40 mb-3 rounded px-3 py-2">
                <span className="text-sm text-red-400">{status.message}</span>
            </div>
        );
    }

    return null;
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
