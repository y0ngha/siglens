'use client';

import type { ReactNode } from 'react';
import React, { useEffect, useEffectEvent, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { useBars } from '@/components/symbol-page/hooks/useBars';
import { useAnalysis } from '@/components/symbol-page/hooks/useAnalysis';
import { useAnalysisDerivedData } from '@/components/symbol-page/hooks/useAnalysisDerivedData';
import { useAnalysisDisplay } from '@/components/symbol-page/hooks/useAnalysisDisplay';
import { useActionPricesVisibility } from '@/components/symbol-page/hooks/useActionPricesVisibility';
import {
    PANEL_MAX_WIDTH,
    PANEL_MIN_WIDTH,
    usePanelResize,
} from '@/components/symbol-page/hooks/usePanelResize';
import { useChartSync } from '@/components/chart/hooks/useChartSync';
import type { AnalysisStatus } from '@/components/symbol-page/utils/analysisStatus';
import { getAnalysisStatus } from '@/components/symbol-page/utils/analysisStatus';
import { SNAP_PEEK } from '@/components/symbol-page/constants/mobileSheet';
import { useAnalysisProgress } from '@/components/symbol-page/hooks/useAnalysisProgress';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';

const StockChart = dynamic(
    () => import('@/components/chart/StockChart').then(mod => mod.StockChart),
    { ssr: false, loading: () => <ChartSkeleton /> }
);

const VolumeChart = dynamic(
    () => import('@/components/chart/VolumeChart').then(mod => mod.VolumeChart),
    { ssr: false, loading: () => <ChartSkeleton /> }
);

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
    /** 모바일 바텀시트에 렌더링할 콘텐츠가 변경될 때 호출된다. Suspense 경계 밖에서 시트를 유지하기 위해 상위로 끌어올린다. */
    onMobileSheetContent: (content: ReactNode) => void;
    fmpSymbol?: string;
}

export function ChartContent({
    symbol,
    timeframe,
    timeframeChangeCount,
    initialAnalysis,
    initialAnalysisFailed,
    onMobileSheetContent,
    fmpSymbol,
}: ChartContentProps) {
    const { bars, indicators } = useBars({ symbol, timeframe, fmpSymbol });

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
        fmpSymbol,
        timeframeChangeCount,
    });

    const { panelWidth, isDragging, handleDragStart, handleKeyDown } =
        usePanelResize();

    const {
        handleStockChartReady,
        handleStockChartRemove,
        handleVolumeChartReady,
        handleVolumeChartRemove,
    } = useChartSync();

    const { actionPricesVisible, setActionPricesVisible } =
        useActionPricesVisibility();

    const { displayAnalyzing, handleProgressFinished } =
        useAnalysisDisplay(isAnalyzing);

    // 데스크톱·모바일 두 인스턴스 공유 — 모바일 시트 unmount/remount 시에도 상태 유지.
    const { phaseIndex: progressPhaseIndex, tipIndex: progressTipIndex } =
        useAnalysisProgress({
            isAnalyzing,
            onFinished: handleProgressFinished,
        });

    const analysisStatus = getAnalysisStatus(displayAnalyzing, analysisError);

    const { clusteredKeyLevels, validatedActionPrices, reconciledActionLines } =
        useAnalysisDerivedData(analysis, bars);

    const analysisContent = useMemo(
        () => (
            <>
                <AnalysisStatusBanner
                    status={analysisStatus}
                    className="mb-3"
                />
                <AnalysisPanel
                    symbol={symbol}
                    analysis={analysis}
                    keyLevels={clusteredKeyLevels}
                    isAnalyzing={isAnalyzing}
                    showProgress={displayAnalyzing}
                    progressPhaseIndex={progressPhaseIndex}
                    progressTipIndex={progressTipIndex}
                    onReanalyze={handleReanalyze}
                    reanalyzeCooldownMs={reanalyzeCooldownMs}
                    cooldownNotice={cooldownNotice}
                    actionPricesVisible={actionPricesVisible}
                    onActionPricesVisibilityChange={setActionPricesVisible}
                />
            </>
        ),
        [
            symbol,
            analysisStatus,
            analysis,
            clusteredKeyLevels,
            isAnalyzing,
            displayAnalyzing,
            progressPhaseIndex,
            progressTipIndex,
            handleReanalyze,
            reanalyzeCooldownMs,
            cooldownNotice,
            actionPricesVisible,
            setActionPricesVisible,
        ]
    );

    // timeframe key로 래핑 — Suspense 경계 밖 전달 + 타임프레임 변경 시 effect 재실행 보장.
    const mobileContent = useMemo(
        () => (
            <React.Fragment key={timeframe}>{analysisContent}</React.Fragment>
        ),
        [analysisContent, timeframe]
    );

    const notifyMobileContent = useEffectEvent(onMobileSheetContent);

    useEffect(() => {
        notifyMobileContent(mobileContent);
    }, [mobileContent]);

    return (
        <div className="flex h-full w-full flex-col md:flex-row">
            {/* 차트 영역 — 바텀시트는 fixed 오버레이. pb는 SNAP_PEEK 높이만큼 확보해 Peek 시 거래량 차트가 가려지지 않도록 한다 */}
            <div
                style={{ '--snap-peek': SNAP_PEEK } as React.CSSProperties}
                className="flex h-full shrink-0 flex-col overflow-hidden pb-[calc(var(--snap-peek)*100svh)] md:flex-1 md:pb-0"
            >
                {/* 캔들 차트 */}
                <div className="relative flex-3">
                    <StockChart
                        bars={bars}
                        timeframe={timeframe}
                        indicators={indicators}
                        actionPrices={validatedActionPrices}
                        reconciledActionPrices={reconciledActionLines}
                        actionPricesVisible={actionPricesVisible}
                        onChartReady={handleStockChartReady}
                        onChartRemove={handleStockChartRemove}
                    />
                </div>

                {/* Buy/Sell Volume 차트 */}
                <div className="border-secondary-700 relative flex-1 border-t">
                    <VolumeChart
                        bars={bars}
                        buySellVolume={indicators.buySellVolume}
                        onChartReady={handleVolumeChartReady}
                        onChartRemove={handleVolumeChartRemove}
                    />
                </div>

                {/* 안내 */}
                <p className="text-secondary-500 px-2 py-1 text-right text-[10px]">
                    차트는 Pre-market, After-market 주가를 반영하지 않습니다. |
                    시세 데이터는 최대 15분 지연됩니다.
                </p>
            </div>

            {/* 드래그 핸들 — flex 형제로 배치 (데스크톱 전용) */}
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

            {/* AI 분석 패널 — 데스크톱 */}
            <aside
                className="border-secondary-700 relative hidden min-h-0 flex-none overflow-y-auto border-l p-4 md:flex md:h-full md:w-(--panel-width) md:flex-col"
                style={
                    {
                        // panelWidth는 드래그 상태에서 런타임에 결정되므로 정적 Tailwind 클래스로 표현 불가
                        '--panel-width': `${panelWidth}px`,
                    } as React.CSSProperties
                }
                aria-live="polite"
            >
                {analysisContent}
            </aside>
            <FloatingChatButton
                symbol={symbol}
                timeframe={timeframe}
                analysis={analysis}
                isAnalysisReady={!displayAnalyzing}
            />

            {/* 드래그 중 전체 화면 오버레이 — 텍스트 선택 방지 */}
            {isDragging && (
                <div className="fixed inset-0 z-50 cursor-col-resize" />
            )}
        </div>
    );
}
