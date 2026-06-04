import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { MarketSummaryPanel } from '@/widgets/dashboard/MarketSummaryPanel';
import { MarketSummaryPanelSkeleton } from '@/widgets/dashboard/MarketSummaryPanelSkeleton';
import { SectorFactsSummary } from '@/widgets/dashboard/SectorFactsSummary';
import { SectorSignalPanel } from '@/widgets/dashboard/SectorSignalPanel';
import { SectorSignalPanelSkeleton } from '@/widgets/dashboard/SectorSignalPanelSkeleton';
import { SignalTypeGuide } from '@/widgets/dashboard/SignalTypeGuide';
import { getMarketSummaryStatic } from '@/entities/market-summary/lib/marketSummaryStaticCache';
import { peekBriefingStatic } from '@/entities/market-summary/lib/briefingStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/lib/sectorSignalsStaticCache';
import {
    DEFAULT_DASHBOARD_TIMEFRAME,
    SIGNAL_SECTORS,
} from '@/shared/config/dashboard-tickers';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import {
    buildBreadcrumbJsonLd,
    ROOT_KEYWORDS,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { JsonLd } from '@/shared/ui/JsonLd';

// 1h — ISR (literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md)
export const revalidate = 3600; // 1h — ISR

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

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: MARKET_TITLE,
        description: MARKET_DESCRIPTION,
        keywords: MARKET_KEYWORDS,
        // variant URL(?sector=, ?timeframe=)은 noindex 대신 clean canonical(/market)로
        // 색인 통합한다 — canonical과 noindex를 동시에 거는 신호 충돌을 제거.
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
    };
}

/**
 * ISR-safe market content. No searchParams — timeframe/sector are purely
 * client-side via useSearchParams in SectorSignalPanel (CSR).
 *
 * Static data flow:
 *   1. getMarketSummaryStatic / getSectorSignalsStatic — unstable_cache (1h)
 *   2. peekBriefingStatic — read cached briefing for SSR seed (no side effects)
 *   3. QueryClient.setQueryData — seeds React Query for instant hydration
 *   4. SectorFactsSummary — SSR crawl text (axis 2: useSearchParams bailout workaround)
 */
async function MarketContent() {
    // ISR date-hour key: same hour = same cached briefing peek. Avoids hashing
    // the full summary object on every ISR render.
    const dateHour = new Date().toISOString().slice(0, 13);

    const summary = await getMarketSummaryStatic();
    const sectorData = await getSectorSignalsStatic(
        DEFAULT_DASHBOARD_TIMEFRAME
    );
    // peekBriefingStatic is read-only — null on cache miss (client will trigger submit)
    const peekSeed = await peekBriefingStatic(summary, dateHour).catch(
        () => null
    );

    // Seed React Query so client-side hydration skips the first network round-trip
    const queryClient = new QueryClient();
    queryClient.setQueryData(QUERY_KEYS.marketSummary(), { summary });
    queryClient.setQueryData(
        QUERY_KEYS.sectorSignals(DEFAULT_DASHBOARD_TIMEFRAME),
        sectorData
    );

    return (
        <>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <Suspense fallback={<MarketSummaryPanelSkeleton />}>
                    <MarketSummaryPanel peekSeed={peekSeed} />
                </Suspense>
            </HydrationBoundary>
            <Suspense
                fallback={
                    <>
                        {/* Axis 2: SSR crawl text while SectorSignalPanel (CSR) hydrates.
                            SectorSignalPanel uses useSearchParams → CSR bailout → empty SSR HTML.
                            SectorFactsSummary renders the same data as static server-rendered text
                            so crawlers see actual signal content without JS. Not cloaking — users
                            see the same data once JS loads. */}
                        <SectorFactsSummary data={sectorData} />
                        <SectorSignalPanelSkeleton />
                    </>
                }
            >
                <SectorSignalPanel
                    initialSector={SIGNAL_SECTORS[0].symbol}
                    initialTimeframe={DEFAULT_DASHBOARD_TIMEFRAME}
                    initialData={sectorData}
                />
            </Suspense>
            <SignalTypeGuide />
        </>
    );
}

export default function MarketPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${MARKET_URL}#webpage`,
        name: MARKET_FULL_TITLE,
        description: MARKET_DESCRIPTION,
        url: MARKET_URL,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '시장 현황', url: MARKET_URL },
    ]);

    // ItemList 항목 URL은 ?sector= 변형이 아닌 canonical /market으로 통일한다.
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
            {/* main 랜드마크: 이전엔 h1 + Suspense가 fragment 아래 직접 노출돼
                의미론적 랜드마크가 빠져 있었다. backtesting/page.tsx가 같은
                패턴으로 회귀했었던 이력 — sibling 페이지(/[symbol]/*) 6개와의
                일관성을 맞춰 둔다. */}
            <main className="flex-1">
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
                    <MarketContent />
                </Suspense>
            </main>
        </>
    );
}
