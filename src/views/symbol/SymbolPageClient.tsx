'use client';

import {
    ChartErrorFallback,
    ChartSkeleton,
    TimeframeSelector,
} from '@/widgets/chart';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';
import { ChartContent } from './ChartContent';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { useMobileSheet } from './hooks/useMobileSheet';
import { SNAP_FULL } from './constants/mobileSheet';
import { useTimeframeChange } from './hooks/useTimeframeChange';
import { SymbolPageProvider } from './SymbolPageContext';
import { buildChartPageHeading } from './utils/chartPageHeading';
import { useSymbolModel } from '@/features/symbol-model';
import type { AnalysisResponse, TierInfoDepth } from '@y0ngha/siglens-core';
import {
    marketProfileOf,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// vaul의 aria-hidden 주입이 hydration과 겹쳐 mismatch 발생 — ssr: false로 hydration 완료 후 마운트.
const MobileAnalysisSheet = dynamic(
    () =>
        import('./MobileAnalysisSheet').then(m => ({
            default: m.MobileAnalysisSheet,
        })),
    { ssr: false }
);

interface SymbolPageClientProps {
    symbol: string;
    companyName: string;
    /** 한국어명 + 영문사명을 합친 표시 문자열 (예: "애플, Apple Inc. (AAPL)"). */
    displayName: string;
    initialAnalysis: AnalysisResponse;
    initialLockedInfoDepth?: readonly TierInfoDepth[];
    initialAnalysisFailed: boolean;
    indicatorCount: number;
    skillCount: number;
    /**
     * Market profile resolved server-side from AssetInfo — passed down to avoid
     * recomputing marketProfileOf(assetInfo) on the client for ChartContent.
     * Defaults to 'us-equity' when omitted (backward compat).
     */
    marketProfile?: MarketProfileId;
}

export function SymbolPageClient({
    symbol,
    companyName,
    displayName,
    initialAnalysis,
    initialLockedInfoDepth = [],
    initialAnalysisFailed,
    indicatorCount,
    skillCount,
    marketProfile,
}: SymbolPageClientProps) {
    const { tier, isTierHydrated } = useSymbolModel();
    const {
        sheetSnap,
        setSheetSnap,
        mobileSheetContent,
        setMobileSheetContent,
    } = useMobileSheet();
    // isFreeTier는 useTimeframeChange의 인자로 필요해 훅 선언 순서 예외
    // (MISTAKES.md #17)로 그 호출 직전에 둔다. 그 외 훅은 모두 이 파생 변수보다
    // 앞선다.
    const isFreeTier = isTierHydrated && tier === 'free';
    const { timeframe, timeframeChangeCount, handleTimeframeChange } =
        useTimeframeChange(symbol, isFreeTier, isTierHydrated);
    const assetInfo = useAssetInfo(symbol);
    const isHydrated = useHydrated();
    const isMobileViewport = useIsMobileViewport();

    return (
        <SymbolPageProvider
            indicatorCount={indicatorCount}
            skillCount={skillCount}
        >
            {/* Chart page fills the first viewport via SymbolLayout's sticky-footer
                jail: site header(3.5rem)를 viewport에서 뺀 jail 컨테이너 안에서
                SymbolLayoutHeader가 자기 자리 + page main(flex-1)이 잔여를 차지하고,
                이 outer div가 그 main 안에서 flex-1로 chart+AI 영역을 채운다. footer는
                jail 형제로 push되어 스크롤 내려야 보인다. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-secondary-900 text-secondary-200">
                {/* Chart-only timeframe controls live inside this overflow-hidden chart
                    container so the layout header can stay free of useSearchParams
                    (which would force PPR to mark the whole route as dynamic). */}
                <div className="flex flex-col gap-2 border-b border-secondary-700 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-1.5">
                    {/* 차트 페이지 가시 h1: jail(first-viewport 고정 + overflow-hidden)이라
                        본문에 별도 블록을 얹으면 chart 가시 영역이 침범된다. 그래서
                        timeframe bar 행에 짧은 한 줄로 둔다(truncate로 좁은 화면에서
                        TimeframeSelector와 한 줄 공존). 단 이 컴포넌트는 useSearchParams로
                        CSR-bailout되므로 이 가시 h1은 SSR HTML엔 박히지 않는다 — JS 미실행
                        크롤러용 h1은 page.tsx의 Suspense fallback에 동일 텍스트 sr-only h1으로
                        제공하고, hydration 후 이 가시 h1이 fallback을 대체한다. */}
                    <div className="flex min-w-0 items-center gap-2">
                        <h1 className="line-clamp-2 min-w-0 text-sm font-semibold text-secondary-100 sm:line-clamp-none sm:truncate sm:text-base">
                            {buildChartPageHeading(displayName)}
                        </h1>
                        {/*
                         * 분석 시트를 여는 명시적 버튼(모바일 전용).
                         *
                         * 이게 없으면 시트를 여는 유일한 방법이 PEEK 띠를 잡고 드래그하는
                         * 것뿐이다. 그런데 띠 높이는 `snap − 0.03`이고, 시트는 `97svh`
                         * 고정인 반면 vaul은 오프셋을 `window.innerHeight`로 잡는다 —
                         * 모바일 툴바가 접혀 innerHeight가 svh보다 커지면 띠가 얇아지고,
                         * 극단적으로는 0에 수렴해 **잡을 것이 사라진다**. 그 상태에서는
                         * 제품의 핵심인 AI 분석 패널에 재로드 전까지 접근할 수 없다.
                         * 이 버튼은 시트 밖(항상 보이는 타임프레임 바)에 있으므로 띠
                         * 높이와 무관하게 살아 있다.
                         *
                         * 세로 공간을 새로 쓰지 않도록 h1과 같은 행의 남는 폭에 둔다 —
                         * 이 영역은 first-viewport jail이라 한 줄이 늘면 차트가 그만큼 줄어든다.
                         */}
                        <button
                            type="button"
                            onClick={() => setSheetSnap(SNAP_FULL)}
                            className="shrink-0 touch-manipulation rounded-lg border border-secondary-700 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-secondary-300 transition-colors hover:border-secondary-600 hover:bg-secondary-700/30 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none md:hidden"
                        >
                            AI 분석 보기
                        </button>
                    </div>
                    <TimeframeSelector
                        value={timeframe}
                        onChange={handleTimeframeChange}
                        isFreeTier={isFreeTier}
                        isTierHydrated={isTierHydrated}
                    />
                </div>
                <div className="relative flex min-h-0 flex-1 overflow-hidden">
                    <ErrorBoundary
                        FallbackComponent={ChartErrorFallback}
                        resetKeys={[timeframe, symbol]}
                    >
                        <Suspense fallback={<ChartSkeleton />}>
                            <ChartContent
                                symbol={symbol}
                                companyName={companyName}
                                timeframe={timeframe}
                                timeframeChangeCount={timeframeChangeCount}
                                initialAnalysis={initialAnalysis}
                                initialLockedInfoDepth={initialLockedInfoDepth}
                                initialAnalysisFailed={initialAnalysisFailed}
                                onMobileSheetContent={setMobileSheetContent}
                                fmpSymbol={assetInfo?.fmpSymbol}
                                marketProfile={
                                    marketProfile ??
                                    (assetInfo
                                        ? marketProfileOf(assetInfo)
                                        : undefined)
                                }
                            />
                        </Suspense>
                    </ErrorBoundary>
                </div>
                {/* Suspense 경계 밖에서 렌더링하여 타임프레임 전환 시 바텀시트가 사라지지 않도록 한다 */}
                {isHydrated && isMobileViewport && (
                    <MobileAnalysisSheet
                        activeSnap={sheetSnap}
                        onActiveSnapChange={setSheetSnap}
                    >
                        {mobileSheetContent}
                    </MobileAnalysisSheet>
                )}
            </div>
        </SymbolPageProvider>
    );
}
