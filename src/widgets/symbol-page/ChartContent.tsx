'use client';

import type { ReactNode } from 'react';
import React, { Suspense, useEffect, useEffectEvent, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import dynamic from 'next/dynamic';
import { type AnalysisResponse, type Timeframe } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { ChartSkeleton } from '@/widgets/chart';
import { AnalysisPanel } from '@/widgets/analysis';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';
import { useBars } from './hooks/useBars';
import { useAnalysis } from './hooks/useAnalysis';
import { useAnalysisDerivedData } from './hooks/useAnalysisDerivedData';
import { useAnalysisDisplay } from './hooks/useAnalysisDisplay';
import { useActionPricesVisibility } from './hooks/useActionPricesVisibility';
import { useSymbolModel } from './SymbolModelContext';
import {
    PANEL_MAX_WIDTH,
    PANEL_MIN_WIDTH,
    usePanelResize,
} from './hooks/usePanelResize';
import { useChartSync } from '@/widgets/chart';
import type { AnalysisStatus } from './utils/analysisStatus';
import { getAnalysisStatus } from './utils/analysisStatus';
import { SNAP_PEEK } from './constants/mobileSheet';
import { useAnalysisProgress } from './hooks/useAnalysisProgress';
import { usePublishSymbolChat } from '@/features/symbol-chat';
import { buildChatState } from './utils/buildChatState';
import { PWA_TRIGGER_EVENT } from '@/shared/lib/pwaEvents';
import { FearGreedCardMounted } from './FearGreedCardMounted';

const StockChart = dynamic(
    () => import('@/widgets/chart/StockChart').then(mod => mod.StockChart),
    { ssr: false, loading: () => <ChartSkeleton /> }
);

const VolumeChart = dynamic(
    () => import('@/widgets/chart/VolumeChart').then(mod => mod.VolumeChart),
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
    companyName: string;
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
    companyName,
    timeframe,
    timeframeChangeCount,
    initialAnalysis,
    initialAnalysisFailed,
    onMobileSheetContent,
    fmpSymbol,
}: ChartContentProps) {
    const { bars, indicators } = useBars({ symbol, timeframe, fmpSymbol });

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

    const { modelId, isHydrated: isModelHydrated } = useSymbolModel();

    const {
        analysis,
        analysisResult,
        isAnalyzing,
        analysisError,
        isBotBlocked,
        handleReanalyze,
        reanalyzeCooldownMs,
        cooldownNotice,
    } = useAnalysis({
        symbol,
        companyName,
        timeframe,
        initialAnalysis,
        initialAnalysisFailed,
        fmpSymbol,
        timeframeChangeCount,
        modelId,
        isModelHydrated,
    });

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
        () =>
            isBotBlocked ? (
                <BotBlockedNotice />
            ) : (
                <>
                    <AnalysisStatusBanner
                        status={analysisStatus}
                        className="mb-3"
                    />
                    <AnalysisPanel
                        symbol={symbol}
                        analysis={analysis}
                        keyLevels={clusteredKeyLevels}
                        timeframe={timeframe}
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
                    <ErrorBoundary fallback={null}>
                        <Suspense fallback={null}>
                            <FearGreedCardMounted
                                symbol={symbol}
                                fmpSymbol={fmpSymbol}
                            />
                        </Suspense>
                    </ErrorBoundary>
                </>
            ),
        [
            isBotBlocked,
            isAnalyzing,
            symbol,
            analysisStatus,
            analysis,
            clusteredKeyLevels,
            timeframe,
            displayAnalyzing,
            progressPhaseIndex,
            progressTipIndex,
            handleReanalyze,
            reanalyzeCooldownMs,
            cooldownNotice,
            actionPricesVisible,
            setActionPricesVisible,
            fmpSymbol,
        ]
    );

    // timeframe을 React.Fragment key로 전달 — Suspense 경계 밖에서 timeframe 변경 시 자식 트리를 강제 remount한다.
    // timeframe이 useMemo dep에 포함되어 있으므로 mobileContent는 timeframe 변경 시 어차피 재생성되지만, Suspense 재진입은 key 경유로만 트리거된다.
    const mobileContent = useMemo(
        () => (
            <React.Fragment key={timeframe}>{analysisContent}</React.Fragment>
        ),
        [analysisContent, timeframe]
    );

    const notifyMobileContent = useEffectEvent(onMobileSheetContent);

    // Publish chart state to the layout-mounted FloatingChatButton so it survives
    // navigation between the 4 symbol pages. Layout owns the button; we only feed it.
    // bot_blocked/error 시 context는 null로 보내 stale technical payload가 챗봇에
    // 흘러가지 않게 한다 — 다른 페이지(news/overall/options)의 buildChatState와 동일 규약.
    // 훅 선언 순서 예외(MISTAKES.md #17): usePublishSymbolChat은 chatState(파생 변수)를
    // 인자로 받기 때문에 useMemo 뒤에 위치해야 한다.
    const chatState = useMemo(
        () =>
            buildChatState({
                analysis,
                timeframe,
                displayAnalyzing,
                isBotBlocked,
                analysisError,
            }),
        [analysis, timeframe, displayAnalyzing, isBotBlocked, analysisError]
    );
    usePublishSymbolChat(chatState);

    useEffect(() => {
        notifyMobileContent(mobileContent);
    }, [mobileContent]);

    useEffect(() => {
        if (analysisResult) {
            window.dispatchEvent(new CustomEvent(PWA_TRIGGER_EVENT));
        }
    }, [analysisResult]);

    return (
        <div className="flex h-full w-full flex-col md:flex-row">
            {/* 차트 영역 — 바텀시트는 fixed 오버레이. pb는 SNAP_PEEK 높이만큼 확보해 Peek 시 거래량 차트가 가려지지 않도록 한다.
                 sizing: `h-full` 대신 `flex-1 min-h-0`을 사용한다. 부모 ChartContent outer가 flex-row(md+)일 때
                 h-full(= height:100%)이 부모의 stretch-결과 height를 percentage resolution용 "definite"로 못 읽고
                 자식 컨텐츠 height(24~54px)로 fallback해 차트가 30px로 그려지는 Chrome flex spec 회색-영역 이슈가 있었다.
                 flex-1은 데스크탑에서 main-axis(width) grow + cross-axis stretch로 height를 자동으로 받고,
                 모바일(flex-col)에서는 main-axis(height) grow로 부모 height를 채운다. */}
            <div
                style={{ '--snap-peek': SNAP_PEEK } as React.CSSProperties}
                className="flex min-h-0 flex-1 shrink-0 flex-col overflow-hidden pb-[calc(var(--snap-peek)*100svh)] md:pb-0"
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
                        ticker={symbol}
                    />
                </div>

                {/* Buy/Sell Volume 차트 */}
                <div className="border-secondary-700 relative flex-1 border-t">
                    <VolumeChart
                        bars={bars}
                        buySellVolume={indicators.buySellVolume}
                        onChartReady={handleVolumeChartReady}
                        onChartRemove={handleVolumeChartRemove}
                        ticker={symbol}
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

            {/* overflow-y-auto로 내부 스크롤을 유지해 긴 분석이 차트 높이를 밀어내지
                않게 하되, scrollbar-none으로 스크롤바 자체는 감춰 페이지 스크롤과
                시각적으로 겹쳐 보이지 않게 한다. */}
            <aside
                className="border-secondary-700 scrollbar-none relative hidden min-h-0 flex-none overflow-y-auto border-l p-4 md:flex md:h-full md:w-(--panel-width) md:flex-col"
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

            {/* 드래그 중 전체 화면 오버레이 — 텍스트 선택 방지 */}
            {isDragging && (
                <div className="fixed inset-0 z-50 cursor-col-resize" />
            )}
        </div>
    );
}
