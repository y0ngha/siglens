import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import { getMarketFearGreedKrStatic } from '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache';
import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { SITE_NAME } from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { FEAR_GREED_COPY } from '../copy';
import { FearGreedRouteBody } from '../FearGreedRouteBody';

// 1h — 미국 라우트와 동일. `getMarketFearGreedKrStatic`이 이미 1h로 판독값을 캐싱하므로
// 이 값은 페이지 셸의 백그라운드 재생성 주기만 정한다(추가 staleness 없음).
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const COPY = FEAR_GREED_COPY.kr;
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
    // 외부 I/O(Redis/yahoo) 오류는 graceful 처리 — null이면 degraded 경로로 폴백.
    // `getMarketFearGreedKrStatic`은 React.cache + unstable_cache 이중 래핑이라
    // 본문에서 다시 호출해도 fetch는 한 번만 실행된다.
    const view = await getMarketFearGreedKrStatic().catch((e: unknown) => {
        console.error(
            '[FearGreedKrRoute] getMarketFearGreedKrStatic failed (metadata):',
            e
        );
        return null;
    });
    const degraded = view === null || view.snapshot === null;

    return {
        title: COPY.title,
        description: COPY.description,
        keywords: [...COPY.keywords],
        // degraded 시 canonical을 비우고 noindex — 표본 부족 상태(설명문만 남는 화면)를
        // 색인시키지 않는다. follow는 유지해 내부 링크로 주스가 계속 흐르게 한다.
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

export default async function FearGreedKrRoutePage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    // 미국 라우트와 동일 규약: 빈 ISR 캐시 동결을 막기 위해 throw 대신 빈 스냅샷으로
    // 폴백한다. `notFound()`는 절대 쓰지 않는다 — Suspense 안 notFound가 soft-404를
    // 만든 이력이 있다.
    const view: MarketFearGreedView = await getMarketFearGreedKrStatic().catch(
        (e: unknown) => {
            console.error(
                '[FearGreedKrRoute] getMarketFearGreedKrStatic failed:',
                e
            );
            return { snapshot: null, comparisons: [] };
        }
    );

    return <FearGreedRouteBody market="kr" view={view} />;
}
