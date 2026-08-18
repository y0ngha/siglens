import { render, screen } from '@testing-library/react';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';

vi.mock('@/widgets/market-fear-greed', () => ({
    MarketFearGreedPage: () => null,
}));

vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache',
    () => ({
        getMarketFearGreedKrStatic: vi.fn(),
    })
);

import FearGreedKrRoutePage, {
    generateMetadata,
    revalidate,
} from '@/app/fear-greed/kr/page';
import { getMarketFearGreedKrStatic } from '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache';
import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { SITE_URL } from '@/shared/lib/seo';

const mockLoader = getMarketFearGreedKrStatic as MockedFunction<
    typeof getMarketFearGreedKrStatic
>;

const READY: MarketFearGreedView = {
    snapshot: {
        score: 41,
        label: 'FEAR',
        factors: [],
        confidence: 'normal',
        sampleSize: 200,
        asOf: '2026-08-14',
    },
    comparisons: [],
};

const EMPTY: MarketFearGreedView = { snapshot: null, comparisons: [] };

describe('/fear-greed/kr page', () => {
    beforeEach(() => {
        mockLoader.mockResolvedValue(EMPTY);
    });

    it('caches for an hour, matching the reading cadence', () => {
        expect(revalidate).toBe(3600);
    });

    it('self-canonicals when the reading is available', async () => {
        mockLoader.mockResolvedValue(READY);

        const meta = await generateMetadata();
        expect(meta.alternates?.canonical).toBe(`${SITE_URL}/fear-greed/kr`);
        expect(meta.robots).toBeUndefined();
    });

    it('noindexes but keeps following when the sample is insufficient', async () => {
        // 설명문만 남는 상태를 색인시키지 않는다. follow는 유지해 내부 링크로
        // 주스가 계속 흐르게 한다.
        const meta = await generateMetadata();
        expect(meta.alternates?.canonical).toBeNull();
        expect(meta.robots).toEqual({ index: false, follow: true });
    });

    it('degrades to noindex when the loader throws', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockLoader.mockRejectedValue(new Error('redis down'));

        const meta = await generateMetadata();
        expect(meta.robots).toEqual({ index: false, follow: true });
        spy.mockRestore();
    });

    it('renders a KR-specific title, never the US one', async () => {
        mockLoader.mockResolvedValue(READY);

        render(await FearGreedKrRoutePage());
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('코스피');
        expect(h1).not.toHaveTextContent('미국');
    });

    it('renders the region tab strip with 한국 as the current page', async () => {
        mockLoader.mockResolvedValue(READY);

        render(await FearGreedKrRoutePage());
        const nav = screen.getByRole('navigation', { name: '지역 선택' });
        expect(nav).toHaveTextContent('미국');
        expect(nav).toHaveTextContent('한국');
    });

    it('discloses the derived volatility input in the FAQ', async () => {
        // VKOSPI가 아니라 실현변동성이라는 사실을 감추면 화면이 거짓말을 한다.
        mockLoader.mockResolvedValue(READY);

        render(await FearGreedKrRoutePage());
        expect(screen.getAllByText(/VKOSPI/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/실현변동성/).length).toBeGreaterThan(0);
    });

    it('renders a 200 page rather than throwing when the loader fails', async () => {
        // Suspense 안 notFound()가 soft-404를 만든 이력이 있다 — 절대 쓰지 않는다.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockLoader.mockRejectedValue(new Error('yahoo down'));

        render(await FearGreedKrRoutePage());
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        spy.mockRestore();
    });
});
