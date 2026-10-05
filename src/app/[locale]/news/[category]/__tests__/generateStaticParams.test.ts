/**
 * `generateStaticParams`는 DB가 있는 빌드에서만 전 카테고리를 prerender한다.
 *
 * 배포 빌드(GitHub Actions 러너)에는 사설 RDS에 닿을 DB가 없다. 그 상태로 prerender하면
 * 뉴스 목록이 비어 있는 noindex degrade 페이지가 12h revalidate로 구워진다 — 그래서
 * 빈 배열을 돌려 첫 요청이 실데이터로 on-demand 렌더하게 한다.
 */
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('@/entities/market-news/api/marketNewsRepository', () => ({
    getMarketNewsCards: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/widgets/market-news/MarketNewsDigest', () => ({
    MarketNewsDigest: () => null,
}));
vi.mock('@/widgets/market-news/MarketNewsList', () => ({
    MarketNewsList: () => null,
}));

// 로더 실패(null) 렌더가 revalidate를 300초로 낮추는 헬퍼 — 실제 `unstable_cache`는 렌더 스토어가 필요하다.
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForRuntimeDegrade: vi.fn(async () => undefined),
}));

import { NEWS_CATEGORY_SLUGS } from '@/entities/market-news/lib/categoryConfig';
import { generateStaticParams } from '../page';

describe('/news/[category] generateStaticParams', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('DB가 있으면 모든 카테고리 slug를 돌려준다', () => {
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');

        expect(generateStaticParams()).toEqual(
            NEWS_CATEGORY_SLUGS.map(category => ({ category }))
        );
        expect(generateStaticParams().length).toBeGreaterThan(0);
    });

    it('DATABASE_URL이 없으면 빈 배열이다(런타임 on-demand 렌더)', () => {
        vi.stubEnv('DATABASE_URL', '');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');

        expect(generateStaticParams()).toEqual([]);
    });

    it('오프라인 빌드는 URL이 있어도 빈 배열이다(Neon이 차단된다)', () => {
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');

        expect(generateStaticParams()).toEqual([]);
    });
});
