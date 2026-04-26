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
import { getSectorSignalsAction } from '@/infrastructure/dashboard/getSectorSignalsAction';
import { getMarketSummaryAction } from '@/infrastructure/dashboard/getMarketSummaryAction';
import type { DashboardTimeframe } from '@/domain/types';
import {
    DASHBOARD_TIMEFRAMES,
    DEFAULT_DASHBOARD_TIMEFRAME,
    SIGNAL_SECTORS,
} from '@/domain/constants/dashboard-tickers';
import { QUERY_KEYS } from '@/lib/queryConfig';
import {
    buildBreadcrumbJsonLd,
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    ROOT_KEYWORDS,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import { JsonLd } from '@/components/ui/JsonLd';

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

interface SearchParams {
    sector?: string;
    timeframe?: string;
}

interface GenerateMetadataProps {
    searchParams: Promise<SearchParams>;
}

export async function generateMetadata({
    searchParams,
}: GenerateMetadataProps): Promise<Metadata> {
    const params = await searchParams;
    const hasQueryVariant =
        params.sector !== undefined || params.timeframe !== undefined;

    return {
        title: MARKET_TITLE,
        description: MARKET_DESCRIPTION,
        keywords: MARKET_KEYWORDS,
        alternates: { canonical: MARKET_URL },
        openGraph: {
            title: MARKET_TITLE,
            description: MARKET_DESCRIPTION,
            url: MARKET_URL,
            siteName: SITE_NAME,
            locale: 'ko_KR',
            type: 'website',
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: MARKET_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: MARKET_TITLE,
            description: MARKET_DESCRIPTION,
            images: ['/og-image.png'],
        },
        ...(hasQueryVariant && {
            robots: { index: false, follow: true },
        }),
    };
}

function isDashboardTimeframe(v: string | undefined): v is DashboardTimeframe {
    return (
        v !== undefined &&
        (DASHBOARD_TIMEFRAMES as readonly string[]).includes(v)
    );
}

interface SectorSignalSectionProps {
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
}

async function SectorSignalSection({
    initialSector,
    initialTimeframe,
}: SectorSignalSectionProps) {
    const data = await getSectorSignalsAction(initialTimeframe);
    return (
        <SectorSignalPanel
            data={data}
            initialSector={initialSector}
            initialTimeframe={initialTimeframe}
        />
    );
}

interface MarketPageProps {
    searchParams: Promise<SearchParams>;
}

export default async function MarketPage({ searchParams }: MarketPageProps) {
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
        name: MARKET_TITLE,
        description: MARKET_DESCRIPTION,
        url: MARKET_URL,
        inLanguage: 'ko',
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '시장 현황', url: MARKET_URL },
    ]);

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <h1 className="sr-only">미국 주식 기술적 신호 대시보드</h1>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <Suspense fallback={<MarketSummaryPanelSkeleton />}>
                    <MarketSummaryPanel />
                </Suspense>
            </HydrationBoundary>
            <Suspense
                key={initialTimeframe}
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
