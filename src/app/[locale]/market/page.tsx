import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import { US_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { SITE_NAME } from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { marketCopyFor } from './copy';
import { loadMarketSignals } from './loadMarketSignals';
import { MarketRouteBody } from './MarketRouteBody';

// 1h — ISR. 단일 페이지라 재생성 비용이 작아, 장중 섹터 신호 신선도를 위해 짧게 유지한다
// (종목 페이지는 6~24h로 길게 — 거긴 종목 수가 많고 클라 refetch가 신선도를 책임짐).
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const SCOPE = US_DASHBOARD_SCOPE;

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale } = await params;
    const resolvedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const t = await getTranslations({
        locale: resolvedLocale,
        namespace: 'shared.seo',
    });
    const COPY = marketCopyFor(SCOPE.id, t);
    const MARKET_FULL_TITLE = `${COPY.title} | ${SITE_NAME}`;
    const ogLocale = localeOpenGraph(resolvedLocale);
    // og:url도 로케일별이어야 한다 — 소셜 언퍼널이 ko URL로 되돌린다.
    const localizedUrl = localeCanonical(resolvedLocale, COPY.path);
    // metadata·본문·구조화데이터가 **같은 술어**를 본다 — `loadMarketSignals` JSDoc 참조.
    const { degraded } = await loadMarketSignals(SCOPE);

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
    return (
        <MarketRouteBody
            scope={SCOPE}
            locale={isLocale(locale) ? locale : DEFAULT_LOCALE}
        />
    );
}
