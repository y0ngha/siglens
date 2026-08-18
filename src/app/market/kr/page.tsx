import type { Metadata } from 'next';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import { KR_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { MARKET_COPY } from '../copy';
import { MarketRouteBody } from '../MarketRouteBody';

// 1h — 미국 라우트와 동일. 장중 섹터 신호 신선도를 위해 짧게 유지한다.
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const SCOPE = KR_DASHBOARD_SCOPE;
const COPY = MARKET_COPY.kr;
const PAGE_URL = `${SITE_URL}${COPY.path}`;
const FULL_TITLE = `${COPY.title} | ${SITE_NAME}`;

export async function generateMetadata(): Promise<Metadata> {
    // 본문과 동일한 catch 패턴으로 두 loader를 독립 병렬 조회한다 — metadata의 degrade
    // 판정이 실제 렌더 degrade와 어긋나지 않도록.
    const [summary, sectorData] = await Promise.all([
        getMarketSummaryStatic(SCOPE).catch(e => {
            console.error(
                '[market.kr.generateMetadata] getMarketSummaryStatic failed:',
                e
            );
            return { indices: [], sectors: [] };
        }),
        getSectorSignalsStatic(SCOPE, DEFAULT_DASHBOARD_TIMEFRAME).catch(e => {
            console.error(
                '[market.kr.generateMetadata] getSectorSignalsStatic failed:',
                e
            );
            return { computedAt: '', stocks: [] };
        }),
    ]);
    const degraded =
        summary.indices.length === 0 &&
        summary.sectors.length === 0 &&
        sectorData.stocks.length === 0;

    return {
        title: COPY.title,
        description: COPY.description,
        keywords: [...COPY.keywords],
        alternates: { canonical: degraded ? null : PAGE_URL },
        robots: degraded ? { index: false, follow: true } : undefined,
        openGraph: {
            title: FULL_TITLE,
            description: COPY.description,
            url: PAGE_URL,
            siteName: SITE_NAME,
            locale: 'ko_KR',
            type: 'website',
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: FULL_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: FULL_TITLE,
            description: COPY.description,
            images: ['/og-image.png'],
        },
    };
}

export default function MarketKrPage() {
    return <MarketRouteBody scope={SCOPE} />;
}
