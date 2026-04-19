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
import type { DashboardTimeframe } from '@/domain/types';
import {
    DASHBOARD_TIMEFRAMES,
    DEFAULT_DASHBOARD_TIMEFRAME,
    SIGNAL_SECTORS,
} from '@/domain/constants/dashboard-tickers';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { ROOT_KEYWORDS, SITE_NAME, SITE_URL } from '@/lib/seo';

const MARKET_TITLE = `오늘의 미국 주식, 섹터별 기술적 신호 | ${SITE_NAME}`;
const MARKET_DESCRIPTION =
    '오늘 움직임이 큰 미국 주식을 섹터별로 확인하세요. 11개 섹터 선도 종목에서 골든크로스, RSI 다이버전스, 볼린저 스퀴즈가 포착된 티커를 보여주고, 클릭 한 번으로 AI 분석으로 이동합니다.';
const MARKET_URL = `${SITE_URL}/market`;
const MARKET_KEYWORDS = [
    ...ROOT_KEYWORDS,
    '미국 주식 시장 개요',
    '미국 시장 동향',
    '섹터별 종목',
    '골든크로스 스캐너',
    'RSI 다이버전스',
    '볼린저 스퀴즈',
];

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
    const params = await searchParams;
    const hasQueryVariant =
        params.sector !== undefined || params.timeframe !== undefined;

    return {
        title: MARKET_TITLE,
        description: MARKET_DESCRIPTION,
        keywords: MARKET_KEYWORDS,
        alternates: { canonical: MARKET_URL },
        openGraph: {
            title: `오늘의 미국 주식 시장 | ${SITE_NAME}`,
            description: MARKET_DESCRIPTION,
            url: MARKET_URL,
            siteName: SITE_NAME,
            locale: 'ko_KR',
            type: 'website',
        },
        ...(hasQueryVariant && {
            robots: { index: false, follow: true },
        }),
    };
}

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
    const initialTimeframe: DashboardTimeframe = isDashboardTimeframe(
        params.timeframe
    )
        ? params.timeframe
        : DEFAULT_DASHBOARD_TIMEFRAME;
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

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `오늘의 미국 주식 시장, 섹터별 기술적 신호 | ${SITE_NAME}`,
        description: MARKET_DESCRIPTION,
        url: MARKET_URL,
        inLanguage: 'ko',
    };

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: SITE_NAME,
                item: SITE_URL,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: '시장 현황',
                item: MARKET_URL,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(breadcrumbJsonLd).replace(
                        /</g,
                        '\\u003c'
                    ),
                }}
            />
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
