import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { MarketSummaryPanel } from '@/components/dashboard/MarketSummaryPanel';
import { MarketSummaryPanelSkeleton } from '@/components/dashboard/MarketSummaryPanelSkeleton';
import { SectorSignalPanel } from '@/components/dashboard/SectorSignalPanel';
import { SectorSignalPanelSkeleton } from '@/components/dashboard/SectorSignalPanelSkeleton';
import { SignalTypeGuide } from '@/components/dashboard/SignalTypeGuide';
import { getSectorSignals } from '@/infrastructure/dashboard/sectorSignalsApi';
import { getMarketSummaryAction } from '@/infrastructure/dashboard/getMarketSummaryAction';
import {
    DASHBOARD_TIMEFRAMES,
    SIGNAL_SECTORS,
    type DashboardTimeframe,
} from '@/domain/constants/dashboard-tickers';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { ROOT_KEYWORDS, SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
    title: `섹터별 미국 주식 신호 탐색 — 골든크로스·RSI 다이버전스 스캔 | ${SITE_NAME}`,
    description:
        '11개 섹터별 선도 종목의 기술적 신호를 한눈에. 골든크로스·데드크로스·RSI 다이버전스·볼린저 스퀴즈를 AI 없이 실시간 포착. 무료.',
    keywords: [
        ...ROOT_KEYWORDS,
        '섹터 신호',
        '골든크로스 스캐너',
        'RSI 다이버전스',
        '볼린저 스퀴즈',
    ],
    alternates: { canonical: `${SITE_URL}/market` },
    openGraph: {
        title: `섹터별 미국 주식 신호 탐색 | ${SITE_NAME}`,
        description:
            '11개 섹터별 선도 종목의 기술적 신호를 스캔. AI 없이 실시간, 무료.',
        url: `${SITE_URL}/market`,
        siteName: SITE_NAME,
        locale: 'ko_KR',
        type: 'website',
    },
};

interface SearchParams {
    sector?: string;
    timeframe?: string;
}

function isDashboardTimeframe(v: string | undefined): v is DashboardTimeframe {
    return (
        v !== undefined &&
        (DASHBOARD_TIMEFRAMES as readonly string[]).includes(v)
    );
}

async function SectorSignalSection({
    initialSector,
    initialTimeframe,
}: {
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
}) {
    const data = await getSectorSignals(initialTimeframe);
    return (
        <SectorSignalPanel
            data={data}
            initialSector={initialSector}
            initialTimeframe={initialTimeframe}
        />
    );
}

export default async function MarketPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;
    const hasQueryVariant =
        params.sector !== undefined || params.timeframe !== undefined;
    const initialTimeframe: DashboardTimeframe = isDashboardTimeframe(
        params.timeframe
    )
        ? params.timeframe
        : '1Day';
    const fallbackSector = SIGNAL_SECTORS[0].symbol;
    const initialSector =
        params.sector !== undefined &&
        SIGNAL_SECTORS.some(e => e.symbol === params.sector)
            ? params.sector
            : fallbackSector;

    const queryClient = new QueryClient();
    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.marketSummary(),
        queryFn: () => getMarketSummaryAction(),
    });

    return (
        <>
            {hasQueryVariant && (
                <meta name="robots" content="noindex, follow" />
            )}
            <h1 className="sr-only">미국 주식 기술적 신호 대시보드</h1>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <Suspense fallback={<MarketSummaryPanelSkeleton />}>
                    <MarketSummaryPanel />
                </Suspense>
            </HydrationBoundary>
            <Suspense
                key={`${initialSector}-${initialTimeframe}`}
                fallback={<SectorSignalPanelSkeleton />}
            >
                <SectorSignalSection
                    initialSector={initialSector}
                    initialTimeframe={initialTimeframe}
                />
            </Suspense>
            <SignalTypeGuide />
        </>
    );
}
