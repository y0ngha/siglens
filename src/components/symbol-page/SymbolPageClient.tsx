'use client';

import type { ReactElement } from 'react';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from 'react-error-boundary';
import type { AnalysisResponse } from '@/domain/types';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { ChartErrorFallback } from '@/components/chart/ChartErrorFallback';
import { ChartContent } from '@/components/symbol-page/ChartContent';
import { SymbolPageHeader } from '@/components/symbol-page/SymbolPageHeader';
import { SymbolPageProvider } from '@/components/symbol-page/SymbolPageContext';
import { useAssetInfo } from '@/components/symbol-page/hooks/useAssetInfo';
import { useMobileSheet } from '@/components/symbol-page/hooks/useMobileSheet';
import { useTimeframeChange } from '@/components/symbol-page/hooks/useTimeframeChange';
import { useHydrated } from '@/components/hooks/useHydrated';

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
    initialAnalysis: AnalysisResponse;
    initialAnalysisFailed: boolean;
    indicatorCount: number;
}

export function SymbolPageClient({
    symbol,
    initialAnalysis,
    initialAnalysisFailed,
    indicatorCount,
}: SymbolPageClientProps): ReactElement {
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

    return (
        <SymbolPageProvider indicatorCount={indicatorCount}>
            <div className="bg-secondary-900 text-secondary-200 flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
                <SymbolPageHeader
                    symbol={symbol}
                    assetInfo={assetInfo}
                    timeframe={timeframe}
                    onTimeframeChange={handleTimeframeChange}
                />

                <div className="relative flex min-h-0 flex-1 overflow-hidden">
                    <ErrorBoundary
                        FallbackComponent={ChartErrorFallback}
                        resetKeys={[timeframe, symbol]}
                    >
                        <Suspense fallback={<ChartSkeleton />}>
                            <ChartContent
                                symbol={symbol}
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
                {isHydrated && (
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
