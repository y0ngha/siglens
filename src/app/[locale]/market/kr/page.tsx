import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import { KR_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { SITE_NAME } from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { MARKET_COPY } from '../copy';
import { MarketRouteBody } from '../MarketRouteBody';

// 1h — 미국 라우트와 동일. 장중 섹터 신호 신선도를 위해 짧게 유지한다.
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const SCOPE = KR_DASHBOARD_SCOPE;
const COPY = MARKET_COPY.kr;
const FULL_TITLE = `${COPY.title} | ${SITE_NAME}`;

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale } = await params;
    const resolvedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const ogLocale = localeOpenGraph(resolvedLocale);
    // og:url도 로케일별이어야 한다 — 소셜 언퍼널이 ko URL로 되돌린다.
    const localizedUrl = localeCanonical(resolvedLocale, COPY.path);
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
        alternates: await localeAlternatesFrom(params, COPY.path, {
            // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별
            // 자기참조 URL을 만든다. ko 절대 URL을 넘기면 `/en/…`이 ko를
            // canonical로 가리켜 hreflang 상호참조가 깨진다.
            canonical: degraded ? null : undefined,
        }),
        robots: degraded
            ? { index: false, follow: true }
            : localeRobots(resolvedLocale),
        openGraph: {
            title: FULL_TITLE,
            description: COPY.description,
            url: localizedUrl,
            siteName: SITE_NAME,
            ...ogLocale,
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

export default async function MarketKrPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    return <MarketRouteBody scope={SCOPE} />;
}
