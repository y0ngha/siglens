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
import type { DashboardTimeframe } from '@y0ngha/siglens-core';
import {
    DASHBOARD_TIMEFRAMES,
    DEFAULT_DASHBOARD_TIMEFRAME,
    SIGNAL_SECTORS,
} from '@/domain/constants/dashboard-tickers';
import { QUERY_KEYS } from '@/lib/queryConfig';
import {
    buildBreadcrumbJsonLd,
    ROOT_KEYWORDS,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/lib/og';
import { JsonLd } from '@/components/ui/JsonLd';

// Root layout template appends "| Siglens" — exclude brand name to prevent duplication.
const MARKET_TITLE = '오늘의 미국 주식, 섹터별 기술적 신호';
const MARKET_FULL_TITLE = `${MARKET_TITLE} | ${SITE_NAME}`;
const MARKET_DESCRIPTION =
    '오늘 미국 주식 시장이 어떻게 움직였는지 11개 섹터로 나눠 보여줍니다. AI 반도체, 빅테크, 헬스케어, 핀테크 같은 섹터에서 골든크로스, RSI 다이버전스, 볼린저 스퀴즈 신호가 잡힌 종목을 추리고, 누르면 해당 종목의 AI 분석으로 넘어갑니다.';
const MARKET_URL = `${SITE_URL}/market`;
const MARKET_KEYWORDS = [
    ...ROOT_KEYWORDS,
    '미국 주식 시장 개요',
    '오늘의 종목',
    '오늘 매수 종목',
    '거래량 급증',
    '장중 신호',
    '섹터 ETF 신호',
    'AI 반도체 종목',
    '빅테크 종목',
    '헬스케어 종목',
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
        // canonical은 variant 여부와 무관하게 항상 /market로 고정한다 — variant URL이
        // 자기참조 canonical을 가지면 Google이 별개 페이지로 색인하므로 일관성 깨짐.
        alternates: { canonical: MARKET_URL },
        openGraph: {
            title: MARKET_FULL_TITLE,
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
                    alt: MARKET_FULL_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: MARKET_FULL_TITLE,
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

// Awaits searchParams (dynamic) and prefetches market data — must be inside Suspense for PPR.
async function MarketContent({ searchParams }: MarketPageProps) {
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

    return (
        <>
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

export default function MarketPage({ searchParams }: MarketPageProps) {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: MARKET_FULL_TITLE,
        description: MARKET_DESCRIPTION,
        url: MARKET_URL,
        inLanguage: 'ko',
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '시장 현황', url: MARKET_URL },
    ]);

    // ItemList 항목 URL은 noindex되는 ?sector= 변형이 아니라 canonical /market 으로 통일.
    // 섹터 식별자는 ListItem 내 name 필드(괄호 안 sector.symbol)에 표기한다.
    const itemListJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '미국 주식 11개 섹터 신호 스캐너',
        itemListElement: SIGNAL_SECTORS.map((sector, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: `${sector.koreanName} (${sector.sectorName} · ${sector.symbol})`,
            url: MARKET_URL,
        })),
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={itemListJsonLd} />
            <h1 className="text-secondary-100 px-6 pt-10 text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:px-[15vw]">
                {MARKET_TITLE}
            </h1>
            <Suspense
                fallback={
                    <>
                        <MarketSummaryPanelSkeleton />
                        <SectorSignalPanelSkeleton />
                    </>
                }
            >
                <MarketContent searchParams={searchParams} />
            </Suspense>
        </>
    );
}
