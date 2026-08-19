import type { Metadata } from 'next';
import { getMarketFearGreedKrStatic } from '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache';
import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { FEAR_GREED_COPY } from '../copy';
import { FearGreedRouteBody } from '../FearGreedRouteBody';

// 1h — 미국 라우트와 동일. `getMarketFearGreedKrStatic`이 이미 1h로 판독값을 캐싱하므로
// 이 값은 페이지 셸의 백그라운드 재생성 주기만 정한다(추가 staleness 없음).
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const COPY = FEAR_GREED_COPY.kr;
const PAGE_URL = `${SITE_URL}${COPY.path}`;
const FULL_TITLE = `${COPY.title} | ${SITE_NAME}`;

export async function generateMetadata(): Promise<Metadata> {
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
        alternates: { canonical: degraded ? null : PAGE_URL },
        robots: degraded
            ? { index: false, follow: true }
            : { index: true, follow: true },
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

export default async function FearGreedKrRoutePage() {
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
