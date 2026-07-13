'use client';

import { isFallbackAnalysis } from '@/entities/chat-message';
import { usePublishSymbolChat } from '@/features/symbol-chat';
import { cn } from '@/shared/lib/cn';
import { PWA_TRIGGER_EVENT } from '@/shared/lib/pwaEvents';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';
import { AnalysisPanel } from '@/widgets/analysis';
import { ChartSkeleton, useChartSync } from '@/widgets/chart';
import {
    type AnalysisResponse,
    type TierInfoDepth,
    type Timeframe,
} from '@y0ngha/siglens-core';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import React, {
    Suspense,
    useEffect,
    useEffectEvent,
    useMemo,
    useRef,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { SNAP_PEEK } from './constants/mobileSheet';
import { FearGreedCardMounted } from './FearGreedCardMounted';
import { useActionPricesVisibility } from './hooks/useActionPricesVisibility';
import { useAnalysis } from './hooks/useAnalysis';
import { useAnalysisDerivedData } from './hooks/useAnalysisDerivedData';
import { useAnalysisDisplay } from './hooks/useAnalysisDisplay';
import { useAnalysisProgress } from '@/widgets/analysis/hooks/useAnalysisProgress';
import { useBars } from '@/entities/bars/hooks/useBars';
import {
    PANEL_MAX_WIDTH,
    PANEL_MIN_WIDTH,
    usePanelResize,
} from './hooks/usePanelResize';
import { useSymbolModel } from '@/features/symbol-model';
import {
    useAnonAnalysisNudge,
    AnalysisSignupNudgeModal,
} from '@/features/analysis-nudge';
import { useSymbolPageContext } from './SymbolPageContext';
import { TechnicalFactsSummary } from './TechnicalFactsSummary';
import type { AnalysisStatus } from './utils/analysisStatus';
import { getAnalysisStatus } from './utils/analysisStatus';
import { buildChatState } from './utils/buildChatState';
import { useRegisterShareable, deriveChartStatus } from '@/features/share';

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
    initialLockedInfoDepth?: readonly TierInfoDepth[];
    /** 서버에서 초기 AI 분석이 실패했는지 여부. true이면 마운트 시 자동으로 재분석을 실행한다. */
    initialAnalysisFailed: boolean;
    /** 모바일 바텀시트에 렌더링할 콘텐츠가 변경될 때 호출된다. Suspense 경계 밖에서 시트를 유지하기 위해 상위로 끌어올린다. */
    onMobileSheetContent: (content: ReactNode) => void;
    fmpSymbol?: string;
    /**
     * Market profile id (resolved from AssetInfo via marketProfileOf upstream).
     * Threads per-asset price precision into the chart series, overlay legend,
     * and technical-facts price. Defaults to 'us-equity'.
     */
    marketProfile?: MarketProfileId;
}

export function ChartContent({
    symbol,
    companyName,
    timeframe,
    timeframeChangeCount,
    initialAnalysis,
    initialLockedInfoDepth = [],
    initialAnalysisFailed,
    onMobileSheetContent,
    fmpSymbol,
    marketProfile = 'us-equity',
}: ChartContentProps) {
    // 비회원 회원가입 유도(Part B) — 같은 심볼에 대한 중복 카운트 방지용.
    const notifiedSymbolRef = useRef<string | null>(null);

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

    const {
        modelId,
        isHydrated: isModelHydrated,
        reasoning,
        isReasoningHydrated,
        tier,
        isTierHydrated,
    } = useSymbolModel();

    // analysis → symbol-page 역방향 import를 제거하기 위해 여기서 context를 읽어 내려보낸다.
    const { indicatorCount } = useSymbolPageContext();

    const {
        analysis,
        analysisResult,
        lockedInfoDepth,
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
        initialLockedInfoDepth,
        initialAnalysisFailed,
        fmpSymbol,
        timeframeChangeCount,
        modelId,
        isModelHydrated,
        reasoning,
        isReasoningHydrated,
        isTierHydrated,
        tier,
    });

    const { displayAnalyzing, handleProgressFinished } =
        useAnalysisDisplay(isAnalyzing);

    // 비회원 3-심볼 회원가입 유도 모달 (member-reasoning-toggle spec Part B).
    // 회원/로그인 판별 전에는 useAnonAnalysisNudge 내부에서 자체적으로 no-op한다.
    const {
        isOpen: isNudgeOpen,
        isLoginResolved: isNudgeLoginResolved,
        onSymbolAnalyzed,
        close: closeNudge,
    } = useAnonAnalysisNudge();

    // 데스크톱·모바일 두 인스턴스 공유 — 모바일 시트 unmount/remount 시에도 상태 유지.
    const { phaseIndex: progressPhaseIndex, tipIndex: progressTipIndex } =
        useAnalysisProgress({
            isAnalyzing,
            onFinished: handleProgressFinished,
        });

    const analysisStatus = getAnalysisStatus(displayAnalyzing, analysisError);

    const { clusteredKeyLevels, validatedActionPrices, reconciledActionLines } =
        useAnalysisDerivedData(analysis, bars);

    const analysisContent = useMemo(() => {
        const hasNarrative = !isFallbackAnalysis(analysis);
        const fearGreedCard = (
            <ErrorBoundary fallback={null}>
                <Suspense fallback={null}>
                    <FearGreedCardMounted
                        symbol={symbol}
                        fmpSymbol={fmpSymbol}
                    />
                </Suspense>
            </ErrorBoundary>
        );

        // 분기 우선순위: 서사 유무를 먼저 보고, 봇 차단은 그 안에서 additive로 둔다.
        // 이전엔 `isBotBlocked`를 맨 앞에서 검사해 봇이면 BotBlockedNotice가 사실 층
        // (또는 캐시된 실제 분석)을 통째로 '교체'했다. 그 결과 JS를 렌더링하는 크롤러
        // (Googlebot WRS)는 마운트 시 자동 분석 트리거가 miss_no_trigger로 봇 판정되면
        // 종목 정보가 0인 안내문만 남은 DOM을 색인하게 돼, SSR 사실 층의 색인 의도가
        // 무력화됐다(raw HTML엔 facts가 있어도). 이제 서사가 없으면 봇이어도 사실 층을
        // 유지하고, 봇 안내는 그 아래 additive로만 덧붙인다 — 종목별 실측 텍스트가 렌더
        // DOM에도 항상 남고, 봇으로 오판된 실사용자에게도 actionable hint가 유지된다.
        return !hasNarrative ? (
            <div className="flex flex-col gap-3">
                <AnalysisStatusBanner status={analysisStatus} />
                <TechnicalFactsSummary
                    symbol={symbol}
                    bars={bars}
                    indicators={indicators}
                    marketProfile={marketProfile}
                />
                {isBotBlocked && <BotBlockedNotice />}
                {fearGreedCard}
            </div>
        ) : (
            <div className="flex flex-col gap-3">
                <AnalysisStatusBanner status={analysisStatus} />
                <TechnicalFactsSummary
                    symbol={symbol}
                    bars={bars}
                    indicators={indicators}
                    marketProfile={marketProfile}
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
                    indicatorCount={indicatorCount}
                    lockedInfoDepth={lockedInfoDepth}
                    showLockedSignup={tier === 'free' && isTierHydrated}
                />
                {/* 서사가 있어도(캐시된 분석을 표시 중) 봇 판정이면 안내를 additive로
                    덧붙인다 — 자동 트리거/수동 재분석이 봇으로 오판돼 차단된 사실을
                    stale 분석만 보던 실사용자가 인지하도록(PR #530 리뷰 반영). 두 분기가
                    동일하게 `isBotBlocked`일 때만 안내를 노출해 일관된다. */}
                {isBotBlocked && <BotBlockedNotice className="mt-3" />}
                {fearGreedCard}
            </div>
        );
    }, [
        isBotBlocked,
        bars,
        indicators,
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
        marketProfile,
        indicatorCount,
        lockedInfoDepth,
        tier,
        isTierHydrated,
    ]);

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
                lockedInfoDepth,
            }),
        [
            analysis,
            timeframe,
            displayAnalyzing,
            isBotBlocked,
            analysisError,
            lockedInfoDepth,
        ]
    );
    usePublishSymbolChat(chatState);
    useRegisterShareable({
        kind: 'chart',
        status: deriveChartStatus({
            isAnalyzing,
            analysisError: analysisError !== null,
            isBotBlocked,
            // Gate on a REAL analysis — the seeded `initialAnalysis` is always
            // non-null (a fallback/no-narrative AnalysisResponse), so checking
            // `(analysisResult ?? analysis) != null` would report 'success' even
            // before the user has triggered an analysis. Instead, require an actual
            // analysisResult or a non-fallback initialAnalysis so an unanalyzed
            // chart yields 'idle' (→ ShareTriggerDialog) rather than snapshotting
            // a fallback shell.
            hasResult:
                analysisResult != null ||
                (analysis != null && !isFallbackAnalysis(analysis)),
        }),
        result: analysisResult ?? analysis ?? null,
        context: {
            symbol,
            displayName: companyName,
            analyzedAt: (analysisResult ?? analysis)?.analyzedAt,
        },
        trigger: handleReanalyze,
        // Thread snapshot-time bars into the registration so ShareButton can
        // embed them in the chart share snapshot. bars is captured via a ref
        // in useRegisterShareable — no re-registration on every render.
        chartBars: bars,
    });

    useEffect(() => {
        notifyMobileContent(mobileContent);
    }, [mobileContent]);

    useEffect(() => {
        if (analysisResult) {
            window.dispatchEvent(new CustomEvent(PWA_TRIGGER_EVENT));
        }
    }, [analysisResult]);

    // 비회원 3-심볼 회원가입 유도(Part B) — 실제 서사가 렌더된 시점("완료/렌더")에
    // 카운트한다. 캐시 HIT으로 즉시 나타나든 새로 생성됐든 동일하게 "봤으면" 카운트한다
    // (spec §1). notifiedSymbolRef는 같은 심볼에 대해 중복 카운트(불필요한 localStorage
    // read/write)를 막는다 — 다운스트림 recordAnonSymbolAnalysis도 심볼 기준 dedup하므로
    // 정확성을 위해 필수는 아니지만, 매 재렌더마다 카운트를 재시도하지 않도록 한다.
    //
    // isNudgeLoginResolved 게이팅이 필수인 이유: useCurrentUser는 마운트 시
    // data === undefined(로그인 판별 전)이고, 이때 onSymbolAnalyzed는 no-op이다.
    // 캐시 HIT으로 initialAnalysis가 마운트 즉시 non-fallback인 케이스에서, 판별 전에
    // notifiedSymbolRef를 먼저 세팅해버리면 로그인 판별이 끝나 onSymbolAnalyzed가
    // "진짜" 함수로 바뀌어도(식별성 변경 → effect 재실행) ref가 이미 symbol로 채워져
    // 있어 조기 return — 그 심볼은 영원히 기록되지 않는다. 판별 완료(isNudgeLoginResolved)
    // 전까지는 ref를 세팅하지도, onSymbolAnalyzed를 호출하지도 않고, 판별이 true로
    // 바뀌는 순간 effect가 재실행되도록 deps에 포함시켜 그때 정확히 한 번 기록한다.
    useEffect(() => {
        if (!isNudgeLoginResolved) return;
        if (isFallbackAnalysis(analysis)) return;
        if (notifiedSymbolRef.current === symbol) return;
        notifiedSymbolRef.current = symbol;
        onSymbolAnalyzed(symbol);
    }, [symbol, analysis, isNudgeLoginResolved, onSymbolAnalyzed]);

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
                        marketProfile={marketProfile}
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
                    {/*
                     * Pre-market/After-market 안내는 미국 주식(equity)에만 해당한다.
                     * 암호화폐는 24/7 거래라 장전·장후 세션 구분 자체가 없으므로
                     * crypto 마켓 프로파일에서는 이 문구를 표시하지 않는다.
                     */}
                    {marketProfile !== 'crypto' &&
                        '차트는 Pre-market, After-market 주가를 반영하지 않습니다. | '}
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
                className="border-secondary-700 relative hidden min-h-0 flex-none scrollbar-none overflow-y-auto border-l p-4 md:flex md:h-full md:w-(--panel-width) md:flex-col"
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

            {/* 비회원 3-심볼 회원가입 유도 모달(Part B) — 소프트 넙지, 분석은 절대 차단하지 않는다. */}
            {isNudgeOpen && <AnalysisSignupNudgeModal onClose={closeNudge} />}
        </div>
    );
}
