import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
} from '@/shared/lib/seoAlternates';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { SITE_NAME } from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { FEAR_GREED_COPY } from './copy';
import { FearGreedRouteBody } from './FearGreedRouteBody';

// 1h — mirrors /market's single-page revalidate (see docs/architecture/ISR_REVALIDATE.md).
// getMarketFearGreedStatic itself already caches the reading at 1h, so this bounds the
// page shell's own background regen without adding extra staleness.
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const COPY = FEAR_GREED_COPY.us;
const FEAR_GREED_FULL_TITLE = `${COPY.title} | ${SITE_NAME}`;

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
    // 외부 I/O(Redis/FMP) 오류는 graceful 처리 — null이면 degraded 경로로 폴백.
    // getMarketFearGreedStatic은 React.cache + unstable_cache로 이중 래핑되어
    // 있어 페이지 본문에서 다시 호출해도 fetch가 한 번만 실행된다.
    const view = await getMarketFearGreedStatic().catch((e: unknown) => {
        console.error(
            // 접두사를 페이지 본문 로그와 통일한다 — CloudWatch 메트릭 필터
            // (`siglens-fear-greed-loader-failed`)가 이 문자열 하나만 본다.
            '[FearGreedRoute] getMarketFearGreedStatic failed (metadata):',
            e
        );
        return null;
    });
    const degraded = view === null || view.snapshot === null;

    return {
        title: COPY.title,
        description: COPY.description,
        keywords: [...COPY.keywords],
        // degraded 시 canonical을 null로 비워 크롤러가 표본 부족(~600자 explainer만
        // 있는) 상태를 색인하지 않도록 한다. follow: true는 유지해 링크 주스가
        // 내부 링크로 계속 흐르게 한다.
        alternates: await localeAlternatesFrom(params, COPY.path, {
            // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별
            // 자기참조 URL을 만든다. ko 절대 URL을 넘기면 `/en/…`이 ko를
            // canonical로 가리켜 hreflang 상호참조가 깨진다.
            canonical: degraded ? null : undefined,
        }),
        robots: degraded
            ? { index: false, follow: true }
            : { index: true, follow: true },
        openGraph: {
            title: FEAR_GREED_FULL_TITLE,
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
                    alt: FEAR_GREED_FULL_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: FEAR_GREED_FULL_TITLE,
            description: COPY.description,
            images: ['/og-image.png'],
        },
    };
}

export default async function FearGreedRoutePage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    // 외부 I/O(Redis/FMP) 오류는 graceful 처리 — 빈 캐시 동결 방지를 위해 throw 대신
    // empty snapshot으로 폴백한다(/market 페이지와 동일 패턴). MarketFearGreedPage는
    // snapshot === null을 "표본 부족"으로 정상 렌더한다 — notFound()는 여기서 절대 쓰지
    // 않는다(Suspense 안 notFound가 soft-404를 만든 이력이 있다).
    const view: MarketFearGreedView = await getMarketFearGreedStatic().catch(
        (e: unknown) => {
            console.error(
                '[FearGreedRoute] getMarketFearGreedStatic failed:',
                e
            );
            return { snapshot: null, comparisons: [] };
        }
    );

    return <FearGreedRouteBody market="us" view={view} />;
}
