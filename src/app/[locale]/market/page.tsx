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
import { US_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { SITE_NAME } from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { MARKET_COPY } from './copy';
import { MarketRouteBody } from './MarketRouteBody';

// 1h — ISR. 단일 페이지라 재생성 비용이 작아, 장중 섹터 신호 신선도를 위해 짧게 유지한다
// (종목 페이지는 6~24h로 길게 — 거긴 종목 수가 많고 클라 refetch가 신선도를 책임짐).
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const SCOPE = US_DASHBOARD_SCOPE;
const COPY = MARKET_COPY.us;
const MARKET_FULL_TITLE = `${COPY.title} | ${SITE_NAME}`;

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
    // MarketContent와 동일한 catch 패턴으로 두 loader를 독립 병렬 조회한다 — metadata의
    // degrade 판정이 실제 렌더 degrade와 어긋나지 않도록 한다(economy/fear-greed와 동일 원칙).
    const [summary, sectorData] = await Promise.all([
        getMarketSummaryStatic(SCOPE).catch(e => {
            console.error(
                '[market.generateMetadata] getMarketSummaryStatic failed:',
                e
            );
            return { indices: [], sectors: [] };
        }),
        getSectorSignalsStatic(SCOPE, DEFAULT_DASHBOARD_TIMEFRAME).catch(e => {
            console.error(
                '[market.generateMetadata] getSectorSignalsStatic failed:',
                e
            );
            return { computedAt: '', stocks: [] };
        }),
    ]);
    // 두 loader가 모두 빈 값으로 떨어진 경우만 degrade로 본다. 한쪽만 비어도 다른 쪽에
    // 콘텐츠가 있으면 페이지는 여전히 비어있지 않은 렌더다.
    const degraded =
        summary.indices.length === 0 &&
        summary.sectors.length === 0 &&
        sectorData.stocks.length === 0;

    return {
        title: COPY.title,
        description: COPY.description,
        keywords: [...COPY.keywords],
        // variant URL(?sector=, ?timeframe=)은 noindex 대신 clean canonical(/market)로
        // 색인 통합한다 — canonical과 noindex를 동시에 거는 신호 충돌을 제거.
        // 단, 두 loader가 모두 실패해 본문이 빈 렌더로 떨어지면 economy/fear-greed와
        // 동일하게 canonical을 비우고 noindex를 걸어 임시 상태를 색인하지 않는다.
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
            title: MARKET_FULL_TITLE,
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
                    alt: MARKET_FULL_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: MARKET_FULL_TITLE,
            description: COPY.description,
            images: ['/og-image.png'],
        },
    };
}

export default async function MarketPage({
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
