'use client';

import type React from 'react';
import type {
    AnalysisResponse,
    Bar,
    IndicatorResult,
    Timeframe,
} from '@/domain/types';
import { cn } from '@/lib/cn';
import { StockChart } from '@/components/chart/StockChart';
import { VolumeChart } from '@/components/chart/VolumeChart';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { useBars } from '@/components/symbol-page/hooks/useBars';
import { useAnalysis } from '@/components/symbol-page/hooks/useAnalysis';
import {
    usePanelResize,
    PANEL_MIN_WIDTH,
    PANEL_MAX_WIDTH,
} from '@/components/symbol-page/hooks/usePanelResize';
import type { AnalysisStatus } from '@/components/symbol-page/utils/analysisStatus';
import { getAnalysisStatus } from '@/components/symbol-page/utils/analysisStatus';

function AnalyzingBanner() {
    return (
        <div className="bg-secondary-700/40 flex items-center gap-2 rounded px-3 py-2">
            <span className="text-secondary-400 text-sm">AI 분석 중…</span>
        </div>
    );
}

interface ErrorBannerProps {
    message: string;
}

function ErrorBanner({ message }: ErrorBannerProps) {
    return (
        <div className="bg-secondary-700/40 rounded px-3 py-2">
            <span className="text-chart-bearish text-sm">{message}</span>
        </div>
    );
}

interface AnalysisStatusBannerProps {
    status: AnalysisStatus;
    className?: string;
}

function AnalysisStatusBanner({
    status,
    className,
}: AnalysisStatusBannerProps) {
    if (status.type === 'analyzing')
        return (
            <div className={className}>
                <AnalyzingBanner />
            </div>
        );
    if (status.type === 'error')
        return (
            <div className={className}>
                <ErrorBanner message={status.message} />
            </div>
        );
    return null;
}

interface ChartContentProps {
    symbol: string;
    timeframe: Timeframe;
    /** 타임프레임이 변경된 누적 횟수. Suspense remount 시 초기 마운트와 타임프레임 변경을 구분한다. */
    timeframeChangeCount: number;
    initialBars: Bar[];
    initialIndicators: IndicatorResult;
    initialAnalysis: AnalysisResponse;
    /** 서버에서 초기 AI 분석이 실패했는지 여부. true이면 마운트 시 자동으로 재분석을 실행한다. */
    initialAnalysisFailed: boolean;
}

export function ChartContent({
    symbol,
    timeframe,
    timeframeChangeCount,
    initialBars,
    initialIndicators,
    initialAnalysis,
    initialAnalysisFailed,
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
            initialAnalysisFailed,
            timeframeChangeCount,
            bars,
            indicators,
        });

    const { panelWidth, isDragging, handleDragStart, handleKeyDown } =
        usePanelResize();
    const analysisStatus = getAnalysisStatus(isAnalyzing, analysisError);

    return (
        <div className="flex h-full w-full flex-col md:flex-row">
            {/* 차트 영역 */}
            <div className="flex h-[60vh] min-h-0 flex-col overflow-hidden md:h-auto md:flex-1">
                {/* 캔들 차트 */}
                <div className="relative flex-3">
                    <StockChart
                        bars={bars}
                        indicators={indicators}
                        patterns={analysis.patternSummaries}
                    />
                </div>

                {/* 거래량 차트 */}
                <div className="border-secondary-700 flex-1 border-t">
                    <VolumeChart bars={bars} />
                </div>
            </div>

            {/* AI 분석 패널 */}
            <aside
                className="border-secondary-700 relative min-h-0 flex-1 overflow-y-auto border-t p-4 md:w-[var(--panel-width)] md:flex-none md:border-t-0 md:border-l"
                style={
                    {
                        // panelWidth는 드래그 상태에서 런타임에 결정되므로 정적 Tailwind 클래스로 표현 불가
                        '--panel-width': `${panelWidth}px`,
                    } as React.CSSProperties
                }
                aria-live="polite"
            >
                {/* 드래그 핸들 */}
                <div
                    role="separator"
                    tabIndex={0}
                    aria-orientation="vertical"
                    aria-label="패널 너비 조절"
                    aria-valuenow={panelWidth}
                    aria-valuemin={PANEL_MIN_WIDTH}
                    aria-valuemax={PANEL_MAX_WIDTH}
                    className={cn(
                        'border-secondary-700 hover:border-primary-600 focus-visible:border-primary-600 absolute top-0 bottom-0 left-0 hidden w-1 cursor-col-resize border-l transition-colors outline-none md:block',
                        isDragging && 'border-primary-500'
                    )}
                    onMouseDown={handleDragStart}
                    onKeyDown={handleKeyDown}
                />
                <AnalysisStatusBanner
                    status={analysisStatus}
                    className="mb-3"
                />
                <AnalysisPanel
                    analysis={analysis}
                    isAnalyzing={isAnalyzing}
                    onReanalyze={handleReanalyze}
                />
            </aside>

            {/* 드래그 중 전체 화면 오버레이 — 텍스트 선택 방지 */}
            {isDragging && (
                <div className="fixed inset-0 z-50 cursor-col-resize" />
            )}
        </div>
    );
}
