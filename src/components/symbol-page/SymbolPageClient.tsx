'use client';

import { Suspense, startTransition, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ErrorBoundary } from 'react-error-boundary';
import type { AnalysisResponse } from '@/domain/types';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { ChartErrorFallback } from '@/components/chart/ChartErrorFallback';
import { ChartContent } from '@/components/symbol-page/ChartContent';
import {
    SNAP_HALF,
    type SnapPoint,
} from '@/components/symbol-page/MobileAnalysisSheet';
import { SymbolPageProvider } from '@/components/symbol-page/SymbolPageContext';
import { useTimeframeChange } from '@/components/symbol-page/hooks/useTimeframeChange';
import { useAssetInfo } from '@/components/symbol-page/hooks/useAssetInfo';

// vaul은 내부 Radix DismissableLayer로 Drawer 외부 형제 요소에 aria-hidden을 주입한다.
// 이 DOM 조작이 hydration 사이클과 겹치면 React가 mismatch를 감지하므로,
// ssr: false로 모듈 로딩 경계까지 분리하여 hydration 완료 이후 비동기로 마운트한다.
// 타입과 상수(SNAP_HALF, SnapPoint)는 정적 참조라 일반 import를 유지한다.
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
}: SymbolPageClientProps) {
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
    // hydration 완료 후에만 MobileAnalysisSheet를 마운트한다.
    // vaul의 aria-hidden 주입이 React hydration과 겹치지 않도록 보장한다.
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { startTransition(() => setIsMounted(true)); }, []);

    const ticker = symbol.toUpperCase();
    const hasCompanyName = !!assetInfo && assetInfo.name !== ticker;

    return (
        <SymbolPageProvider indicatorCount={indicatorCount}>
            <div className="bg-secondary-900 text-secondary-200 flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
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
                                fmpSymbol={assetInfo?.fmpSymbol}
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
