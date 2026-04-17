'use client';

import { Suspense, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ErrorBoundary } from 'react-error-boundary';
import type { AnalysisResponse } from '@/domain/types';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { ChartErrorFallback } from '@/components/chart/ChartErrorFallback';
import { TickerAutocomplete } from '@/components/search/TickerAutocomplete';
import { ChartContent } from '@/components/symbol-page/ChartContent';
import {
    MobileAnalysisSheet,
    SNAP_HALF,
    type SnapPoint,
} from '@/components/symbol-page/MobileAnalysisSheet';
import { SymbolPageProvider } from '@/components/symbol-page/SymbolPageContext';
import { useTimeframeChange } from '@/components/symbol-page/hooks/useTimeframeChange';
import { useAssetInfo } from '@/components/symbol-page/hooks/useAssetInfo';

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
}: SymbolPageClientProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [sheetSnap, setSheetSnap] = useState<SnapPoint>(SNAP_HALF);
    const [mobileSheetContent, setMobileSheetContent] =
        useState<ReactNode>(null);
    // Suspense로 인해 ChartContent가 remount될 때 타임프레임 변경 여부를 전달한다.
    // timeframe 변경 횟수를 카운트하여 ChartContent가 타임프레임 변경으로 인해
    // mount된 것인지 초기 mount인지를 구분한다.
    // render 중 setState를 호출하는 패턴은 React 19 concurrent mode에서 Router 업데이트
    // 충돌을 유발할 수 있으므로, handleTimeframeChange 이벤트 핸들러 안에서 카운터를 갱신한다.
    const { timeframe, timeframeChangeCount, handleTimeframeChange } =
        useTimeframeChange(symbol);
    const assetInfo = useAssetInfo(symbol);

    const ticker = symbol.toUpperCase();
    const hasCompanyName = !!assetInfo && assetInfo.name !== ticker;

    // vaul이 클라이언트에서 aria-hidden을 DOM에 주입하므로 SSR에서는 렌더링을 생략한다.
    // 서버와 클라이언트 간 Hydration mismatch를 방지하기 위해 마운트 후에만 시트를 표시한다.
    useEffect(() => {
        setIsMounted(true);
    }, []);

    return (
        <SymbolPageProvider indicatorCount={indicatorCount}>
            <div className="bg-secondary-900 text-secondary-200 flex h-screen flex-col overflow-hidden">
                {/* 헤더 */}
                <header className="border-secondary-700 border-b px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Link
                                href="/"
                                className="text-secondary-500 hover:text-secondary-300 font-mono text-xs tracking-[0.2em] uppercase transition-colors"
                            >
                                SIGLENS
                            </Link>
                            <span className="text-secondary-700">/</span>
                            <h1 className="text-secondary-100 text-lg font-semibold tracking-wide">
                                {assetInfo?.koreanName && (
                                    <span className="text-secondary-300">
                                        {assetInfo.koreanName}
                                        {hasCompanyName ? ', ' : ' '}
                                    </span>
                                )}
                                {assetInfo && hasCompanyName && (
                                    <span className="text-secondary-200">
                                        {assetInfo.name}{' '}
                                    </span>
                                )}
                                ({ticker})
                                <span className="sr-only"> 기술적 분석</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden md:block">
                                <TickerAutocomplete size="sm" />
                            </div>
                            <div className="hidden sm:block">
                                <TimeframeSelector
                                    value={timeframe}
                                    onChange={handleTimeframeChange}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 sm:hidden">
                        <TimeframeSelector
                            value={timeframe}
                            onChange={handleTimeframeChange}
                        />
                    </div>
                </header>

                {/* 메인 레이아웃 */}
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
                            />
                        </Suspense>
                    </ErrorBoundary>
                </div>
                {/* Suspense 경계 밖에 렌더링하여 타임프레임 전환 시 바텀시트가 사라지지 않도록 한다 */}
                {isMounted && (
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
