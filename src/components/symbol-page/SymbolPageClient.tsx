'use client';

import { ChartErrorFallback } from '@/components/chart/ChartErrorFallback';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';
import { useHydrated } from '@/components/hooks/useHydrated';
import { useIsMobileViewport } from '@/components/hooks/useIsMobileViewport';
import { ChartContent } from '@/components/symbol-page/ChartContent';
import { useAssetInfo } from '@/components/symbol-page/hooks/useAssetInfo';
import { useMobileSheet } from '@/components/symbol-page/hooks/useMobileSheet';
import { useTimeframeChange } from '@/components/symbol-page/hooks/useTimeframeChange';
import { SymbolPageProvider } from '@/components/symbol-page/SymbolPageContext';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import dynamic from 'next/dynamic';
import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// vaul의 aria-hidden 주입이 hydration과 겹쳐 mismatch 발생 — ssr: false로 hydration 완료 후 마운트.
const MobileAnalysisSheet = dynamic(
    () =>
        import('@/components/symbol-page/MobileAnalysisSheet').then(m => ({
            default: m.MobileAnalysisSheet,
        })),
    { ssr: false }
);

interface SymbolPageClientProps {
    symbol: string;
    companyName: string;
    initialAnalysis: AnalysisResponse;
    initialAnalysisFailed: boolean;
    indicatorCount: number;
    // 서버 컴포넌트가 SEO용 cross-link를 주입하기 위한 슬롯 — viewport-height 차트 아래 영역에 노출.
    bottomSlot?: ReactNode;
}

export function SymbolPageClient({
    symbol,
    companyName,
    initialAnalysis,
    initialAnalysisFailed,
    indicatorCount,
    bottomSlot,
}: SymbolPageClientProps) {
    const {
        sheetSnap,
        setSheetSnap,
        mobileSheetContent,
        setMobileSheetContent,
    } = useMobileSheet();
    const { timeframe, timeframeChangeCount, handleTimeframeChange } =
        useTimeframeChange(symbol);
    const assetInfo = useAssetInfo(symbol);
    const isHydrated = useHydrated();
    const isMobileViewport = useIsMobileViewport();

    return (
        <SymbolPageProvider indicatorCount={indicatorCount}>
            {/* Chart page is the only `/[symbol]/*` route that fills the remaining
                viewport height and disables outer scrolling. The layout header sits
                above this container; combined with the site header (3.5rem) and the
                layout header's intrinsic height, the chart fills the rest via the
                `useBodyScrollLock` html/body lock applied in SymbolLayoutClient. */}
            <div className="bg-secondary-900 text-secondary-200 flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Chart-only timeframe controls live inside the scroll-locked chart
                    container so the layout header can stay free of useSearchParams
                    (which would force PPR to mark the whole route as dynamic). */}
                <div className="border-secondary-700 flex items-center justify-end border-b px-4 py-2 sm:py-1.5">
                    <TimeframeSelector
                        value={timeframe}
                        onChange={handleTimeframeChange}
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
                                initialAnalysisFailed={initialAnalysisFailed}
                                onMobileSheetContent={setMobileSheetContent}
                                fmpSymbol={assetInfo?.fmpSymbol}
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
            {bottomSlot && (
                <div className="bg-secondary-900 text-secondary-200 mx-auto w-full max-w-5xl px-4 pb-12">
                    {bottomSlot}
                </div>
            )}
        </SymbolPageProvider>
    );
}
