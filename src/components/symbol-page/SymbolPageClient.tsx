'use client';

import { ChartErrorFallback } from '@/components/chart/ChartErrorFallback';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';
import { ChartContent } from '@/components/symbol-page/ChartContent';
import { useAssetInfo } from '@/components/symbol-page/hooks/useAssetInfo';
import { useMobileSheet } from '@/components/symbol-page/hooks/useMobileSheet';
import { useTimeframeChange } from '@/components/symbol-page/hooks/useTimeframeChange';
import { SymbolPageProvider } from '@/components/symbol-page/SymbolPageContext';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
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
}

export function SymbolPageClient({
    symbol,
    companyName,
    initialAnalysis,
    initialAnalysisFailed,
    indicatorCount,
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
            {/* Chart page fills the first viewport via SymbolLayout's sticky-footer
                jail: site header(3.5rem)를 viewport에서 뺀 jail 컨테이너 안에서
                SymbolLayoutHeader가 자기 자리 + page main(flex-1)이 잔여를 차지하고,
                이 outer div가 그 main 안에서 flex-1로 chart+AI 영역을 채운다. footer는
                jail 형제로 push되어 스크롤 내려야 보인다. */}
            <div className="bg-secondary-900 text-secondary-200 flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Chart-only timeframe controls live inside this overflow-hidden chart
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
        </SymbolPageProvider>
    );
}
