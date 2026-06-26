import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { Suspense } from 'react';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { MarketSummaryPanel } from '@/widgets/dashboard/MarketSummaryPanel';
import { MarketSummaryPanelSkeleton } from '@/widgets/dashboard/MarketSummaryPanelSkeleton';
import { SectorFactsSummary } from '@/widgets/dashboard';
import { SectorSignalPanel } from '@/widgets/dashboard/SectorSignalPanel';
import { SectorSignalPanelSkeleton } from '@/widgets/dashboard/SectorSignalPanelSkeleton';
import { SignalTypeGuide } from '@/widgets/dashboard/SignalTypeGuide';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { peekBriefingStatic } from '@/entities/market-summary/api/briefingStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import {
    DEFAULT_DASHBOARD_TIMEFRAME,
    SIGNAL_SECTORS,
} from '@/shared/config/dashboard-tickers';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import {
    buildBreadcrumbJsonLd,
    clampSeoDescription,
    ROOT_KEYWORDS,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { JsonLd } from '@/shared/ui/JsonLd';

// 1h — ISR. 단일 페이지라 재생성 비용이 작아, 장중 섹터 신호 신선도를 위해 짧게 유지한다
// (종목 페이지는 6~24h로 길게 — 거긴 종목 수가 많고 클라 refetch가 신선도를 책임짐).
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

/**
 * 'YYYY-MM-DDTHH' prefix length — used to bucket ISR renders into 1-hour date-hour keys.
 * Mirrors ISO_DATE_HOUR_PREFIX_LENGTH in @y0ngha/siglens-core (internal, not exported) — must stay in sync.
 */
const ISO_DATE_HOUR_SLICE_END = 13;

// Root layout template appends "| Siglens" — exclude brand name to prevent duplication.
const MARKET_TITLE = '오늘의 미국 주식, 섹터별 기술적 신호';
const MARKET_FULL_TITLE = `${MARKET_TITLE} | ${SITE_NAME}`;
// clampSeoDescription으로 SEO_DESCRIPTION_MAX_LENGTH(120자)를 출력단에서 강제 — 한글 SERP
// 절단 방지 + 향후 텍스트 수정 시 한도 초과 drift 차단(MISTAKES §15). 현재 100자라 no-op.
// 섹터 개수는 표기하지 않는다(11 GICS ETF + 양자 테마라 단일 숫자가 모호 → ItemList도 동일 정책).
const MARKET_DESCRIPTION = clampSeoDescription(
    '오늘 미국 주식 시장을 섹터별로 나눠 봅니다. AI 반도체·빅테크·헬스케어 등에서 골든크로스, RSI 다이버전스, 볼린저 스퀴즈 신호가 잡힌 종목을 추려 AI 분석으로 연결합니다.'
);
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
export async function MarketContent(): Promise<ReactElement> {
    // ISR date-hour key: same hour = same cached briefing peek. Avoids hashing
    // the full summary object on every ISR render.
    const dateHour = new Date().toISOString().slice(0, ISO_DATE_HOUR_SLICE_END);

    // 외부 I/O(FMP/Redis) 오류는 graceful 처리 — 빈 캐시 동결 방지를 위해 throw 대신
    // empty safe default로 폴백한다. MarketSummaryPanel / SectorSignalPanel은
    // 빈 indices/sectors/stocks 배열을 정상적으로 렌더한다(non-empty degraded view).
    const summary = await getMarketSummaryStatic().catch(e => {
        console.error('[MarketContent] getMarketSummaryStatic failed:', e);
        return { indices: [], sectors: [] };
    });
    const sectorData = await getSectorSignalsStatic(
        DEFAULT_DASHBOARD_TIMEFRAME
    ).catch(e => {
        console.error('[MarketContent] getSectorSignalsStatic failed:', e);
        return { computedAt: dateHour, stocks: [] };
    });
    // peekBriefingStatic is read-only — null on cache miss (client will trigger submit)
    const peekSeed = await peekBriefingStatic(summary, dateHour).catch(
        () => null
    );

    /**
     * SSR seed의 computedAt만 시간 단위로 quantize한다 — 5~15분 churn이 ISR write를
     * 유발하므로. 클라 refetch가 실제 computedAt을 공급해 화면 표시는 불변.
     * dateHour는 이미 'YYYY-MM-DDTHH' 형식의 string이므로 타입 호환 유지.
     *
     * ⚠️ SectorFactsSummary/SectorSignalPanel은 현재 `computedAt`을 사용자/크롤러에게
     * 직접 렌더링하지 않는다(`buildSectorFacts`도 사용 안 함). 향후 SSR 표시 경로가
     * 추가되면 truncated 'YYYY-MM-DDTHH' 13자 형식이 노출되므로 그 시점에 표시 형식
     * 변환을 함께 검토해야 한다.
     */
    const sectorDataSeed = { ...sectorData, computedAt: dateHour };

    // Seed React Query so client-side hydration skips the first network round-trip.
    // updatedAt 명시: RQ dehydrate 기본은 Date.now()라 매 ISR 재생성마다 다른 timestamp가
    // HTML에 박혀 ISR write churn 발생. dateHour 버킷의 시작 timestamp로 고정 →
    // 같은 시간 안에서는 dehydrated state 결정성 보장.
    const stableUpdatedAt = new Date(`${dateHour}:00:00.000Z`).getTime();
    const queryClient = new QueryClient();
    queryClient.setQueryData(
        QUERY_KEYS.marketSummary(),
        { summary },
        { updatedAt: stableUpdatedAt }
    );
    queryClient.setQueryData(
        QUERY_KEYS.sectorSignals(DEFAULT_DASHBOARD_TIMEFRAME),
        sectorDataSeed,
        { updatedAt: stableUpdatedAt }
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
                        <SectorFactsSummary data={sectorDataSeed} />
                        <SectorSignalPanelSkeleton />
                    </>
                }
            >
                <SectorSignalPanel
                    initialSector={SIGNAL_SECTORS[0].symbol}
                    initialTimeframe={DEFAULT_DASHBOARD_TIMEFRAME}
                    initialData={sectorDataSeed}
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

    // ItemList 항목에는 url을 두지 않는다 — 모든 항목이 동일 /market을 가리키면
    // (변형 ?sector=는 비-canonical) 구조화데이터로서 가치가 낮고 sitelink 후보에서
    // 불리하다. 섹터/심볼 식별은 ListItem name(괄호 안 sector.symbol)으로 표기하며,
    // 실제 크롤 가능 딥링크(→ /{symbol})는 MarketSummaryPanel 섹터 카드가 제공한다.
    // name도 개수를 표기하지 않는다(11 GICS ETF에 가상 테마가 추가되므로 고정 개수는 쉽게 낡는다).
    const itemListJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '미국 주식 섹터·테마별 신호 스캐너',
        itemListElement: SIGNAL_SECTORS.map((sector, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: `${sector.koreanName} (${sector.sectorName} · ${sector.symbol})`,
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
