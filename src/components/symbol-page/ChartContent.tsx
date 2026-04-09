'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import type React from 'react';
import type { AnalysisResponse, Timeframe } from '@/domain/types';
import { validateKeyLevels } from '@/domain/analysis/keyLevels';
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
import { useChartSync } from '@/components/chart/hooks/useChartSync';
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
    initialAnalysis: AnalysisResponse;
    /** 서버에서 초기 AI 분석이 실패했는지 여부. true이면 마운트 시 자동으로 재분석을 실행한다. */
    initialAnalysisFailed: boolean;
}

export function ChartContent({
    symbol,
    timeframe,
    timeframeChangeCount,
    initialAnalysis,
    initialAnalysisFailed,
}: ChartContentProps) {
    const { bars, indicators } = useBars({ symbol, timeframe });

    const {
        analysis,
        isAnalyzing,
        analysisError,
        handleReanalyze,
        reanalyzeCooldownMs,
        cooldownNotice,
    } = useAnalysis({
        symbol,
        timeframe,
        initialAnalysis,
        initialAnalysisFailed,
        timeframeChangeCount,
        bars,
        indicators,
    });

    const { panelWidth, isDragging, handleDragStart, handleKeyDown } =
        usePanelResize();

    const {
        handleStockChartReady,
        handleStockChartRemove,
        handleVolumeChartReady,
        handleVolumeChartRemove,
    } = useChartSync();

    const [chartVisiblePatterns, setChartVisiblePatterns] = useState<
        Set<string>
    >(new Set());
    const togglePatternRef = useRef<(patternName: string) => void>(
        () => undefined
    );
    const [keyLevelsVisible, setKeyLevelsVisible] = useState(false);
    const [trendlinesVisible, setTrendlinesVisible] = useState(false);

    // 마무리 애니메이션이 모두 끝난 뒤에야 본문/배너가 사라지도록, isAnalyzing보다
    // 늦게 false로 떨어지는 displayAnalyzing 상태를 둔다. AnalysisPanel(본문)과
    // AnalysisStatusBanner(상단 배너)가 동일한 타이밍을 공유한다.
    const [displayAnalyzing, setDisplayAnalyzing] = useState(isAnalyzing);
    const [prevIsAnalyzing, setPrevIsAnalyzing] = useState(isAnalyzing);
    if (prevIsAnalyzing !== isAnalyzing) {
        setPrevIsAnalyzing(isAnalyzing);
        if (isAnalyzing) setDisplayAnalyzing(true);
    }
    const handleProgressFinished = useCallback(() => {
        setDisplayAnalyzing(false);
    }, []);

    const analysisStatus = getAnalysisStatus(displayAnalyzing, analysisError);

    const validatedKeyLevels = useMemo(
        () => validateKeyLevels(analysis.keyLevels),
        [analysis.keyLevels]
    );

    const handlePatternOverlayChange = useCallback(
        (
            visiblePatterns: Set<string>,
            toggle: (patternName: string) => void
        ): void => {
            setChartVisiblePatterns(visiblePatterns);
            togglePatternRef.current = toggle;
        },
        []
    );

    const handleTogglePattern = useCallback((patternName: string): void => {
        togglePatternRef.current(patternName);
    }, []);

    return (
        <div className="flex h-full w-full flex-col md:flex-row">
            {/* 차트 영역 */}
            <div className="flex h-[60vh] shrink-0 flex-col overflow-hidden md:h-full md:flex-1">
                {/* 캔들 차트 */}
                <div className="relative flex-3">
                    <StockChart
                        bars={bars}
                        timeframe={timeframe}
                        indicators={indicators}
                        patterns={analysis.patternSummaries}
                        trendlines={analysis.trendlines}
                        trendlinesVisible={trendlinesVisible}
                        keyLevels={validatedKeyLevels}
                        keyLevelsVisible={keyLevelsVisible}
                        onPatternOverlayChange={handlePatternOverlayChange}
                        onChartReady={handleStockChartReady}
                        onChartRemove={handleStockChartRemove}
                    />
                </div>

                {/* 거래량 차트 */}
                <div className="border-secondary-700 flex-1 border-t">
                    <VolumeChart
                        bars={bars}
                        onChartReady={handleVolumeChartReady}
                        onChartRemove={handleVolumeChartRemove}
                    />
                </div>
            </div>

            {/* 드래그 핸들 — flex 형제로 배치 */}
            <div
                role="separator"
                tabIndex={0}
                aria-orientation="vertical"
                aria-label="패널 너비 조절"
                aria-valuenow={panelWidth}
                aria-valuemin={PANEL_MIN_WIDTH}
                aria-valuemax={PANEL_MAX_WIDTH}
                className={cn(
                    'border-secondary-700 hover:border-primary-600 focus-visible:border-primary-600 hidden w-1 cursor-col-resize border-l transition-colors outline-none md:block',
                    isDragging && 'border-primary-500'
                )}
                onMouseDown={handleDragStart}
                onKeyDown={handleKeyDown}
            />

            {/* AI 분석 패널 */}
            <aside
                className="border-secondary-700 relative min-h-0 flex-1 overflow-y-auto border-t p-4 md:h-full md:w-(--panel-width) md:flex-none md:border-t-0 md:border-l"
                style={
                    {
                        // panelWidth는 드래그 상태에서 런타임에 결정되므로 정적 Tailwind 클래스로 표현 불가
                        '--panel-width': `${panelWidth}px`,
                    } as React.CSSProperties
                }
                aria-live="polite"
            >
                <AnalysisStatusBanner
                    status={analysisStatus}
                    className="mb-3"
                />
                <AnalysisPanel
                    analysis={analysis}
                    keyLevels={validatedKeyLevels}
                    isAnalyzing={isAnalyzing}
                    showProgress={displayAnalyzing}
                    onProgressFinished={handleProgressFinished}
                    onReanalyze={handleReanalyze}
                    reanalyzeCooldownMs={reanalyzeCooldownMs}
                    cooldownNotice={cooldownNotice}
                    chartVisiblePatterns={chartVisiblePatterns}
                    onTogglePattern={handleTogglePattern}
                    _keyLevelsVisible={keyLevelsVisible}
                    _onKeyLevelsVisibilityChange={setKeyLevelsVisible}
                    _trendlinesVisible={trendlinesVisible}
                    _onTrendlinesVisibilityChange={setTrendlinesVisible}
                />
            </aside>

            {/* 드래그 중 전체 화면 오버레이 — 텍스트 선택 방지 */}
            {isDragging && (
                <div className="fixed inset-0 z-50 cursor-col-resize" />
            )}
        </div>
    );
}
