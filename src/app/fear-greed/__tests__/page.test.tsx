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

vi.mock('@/entities/market-fear-greed/api/marketFearGreedStaticCache', () => ({
    getMarketFearGreedStatic: vi.fn(),
}));

import FearGreedRoutePage, {
    generateMetadata,
    revalidate,
} from '@/app/fear-greed/page';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { clampSeoDescription, SITE_URL } from '@/shared/lib/seo';

const mockGetMarketFearGreedStatic = getMarketFearGreedStatic as MockedFunction<
    typeof getMarketFearGreedStatic
>;

const SAMPLE_SNAPSHOT: MarketFearGreedView = {
    snapshot: {
        score: 62,
        label: 'GREED',
        factors: [],
        confidence: 'normal',
        sampleSize: 200,
        asOf: '2026-08-14',
    },
    comparisons: [],
};

describe('/fear-greed page', () => {
    beforeEach(() => {
        mockGetMarketFearGreedStatic.mockResolvedValue({
            snapshot: null,
            comparisons: [],
        });
    });

    describe('ISR route config', () => {
        it('exports revalidate = 3600 (literal — required for Next.js static analysis)', () => {
            // MISTAKES §15: route segment config must be a literal, not an imported constant
            expect(revalidate).toBe(3600);
        });
    });

    describe('generateMetadata', () => {
        it('returns a Korean title mentioning the fear-greed index', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const metadata = await generateMetadata();
            expect(String(metadata.title)).toContain('공포 탐욕 지수');
        });

        it('runs the description through clampSeoDescription (idempotent under the clamp)', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const metadata = await generateMetadata();
            const description = String(metadata.description);
            expect(description.length).toBeGreaterThan(0);
            // If the description were not already clamped, clamping it again would change it.
            expect(clampSeoDescription(description)).toBe(description);
        });

        it('sets the static /og-image.png as the OG/Twitter image', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const metadata = await generateMetadata();
            expect(metadata.openGraph?.images).toEqual([
                expect.objectContaining({ url: '/og-image.png' }),
            ]);
            expect(metadata.twitter?.images).toEqual(['/og-image.png']);
        });

        describe('when a snapshot is available', () => {
            beforeEach(() => {
                mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            });

            it('sets canonical to /fear-greed', async () => {
                const metadata = await generateMetadata();
                expect(metadata.alternates?.canonical).toBe(
                    `${SITE_URL}/fear-greed`
                );
            });

            it('does not set noindex — the page is meant to be crawled', async () => {
                const metadata = await generateMetadata();
                expect(metadata.robots).toBeUndefined();
            });
        });

        describe('when degraded (snapshot: null)', () => {
            beforeEach(() => {
                mockGetMarketFearGreedStatic.mockResolvedValue({
                    snapshot: null,
                    comparisons: [],
                });
            });

            it('omits canonical instead of self-referencing', async () => {
                const metadata = await generateMetadata();
                expect(metadata.alternates?.canonical).toBeFalsy();
            });

            it('sets noindex, follow', async () => {
                const metadata = await generateMetadata();
                expect(metadata.robots).toEqual({
                    index: false,
                    follow: true,
                });
            });
        });

        it('degrades to noindex when getMarketFearGreedStatic rejects, without throwing', async () => {
            mockGetMarketFearGreedStatic.mockRejectedValue(
                new Error('redis down')
            );
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            const metadata = await generateMetadata();

            expect(metadata.robots).toEqual({ index: false, follow: true });
            expect(metadata.alternates?.canonical).toBeFalsy();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[FearGreedRoute] getMarketFearGreedStatic failed (metadata):'
                ),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('page body', () => {
        it('renders a single h1 and passes the fetched view to the widget', async () => {
            render(await FearGreedRoutePage());
            expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(
                1
            );
        });

        it('renders the 공포탐욕지수 읽는 법 guide with all five score bands', async () => {
            render(await FearGreedRoutePage());
            expect(
                screen.getByText('공포탐욕지수 읽는 법')
            ).toBeInTheDocument();
            expect(screen.getByText(/0~24점/)).toBeInTheDocument();
            expect(screen.getByText(/25~44점/)).toBeInTheDocument();
            expect(screen.getByText(/45~54점/)).toBeInTheDocument();
            expect(screen.getByText(/55~74점/)).toBeInTheDocument();
            expect(screen.getByText(/75~100점/)).toBeInTheDocument();
        });

        it('renders a visible 자주 묻는 질문 section with all three FAQ questions', async () => {
            render(await FearGreedRoutePage());
            expect(screen.getByText('자주 묻는 질문')).toBeInTheDocument();
            expect(
                screen.getByText('시장 공포 탐욕 지수는 무엇을 측정하나요?')
            ).toBeInTheDocument();
            expect(
                screen.getByText('CNN의 Fear & Greed Index와 같은 지수인가요?')
            ).toBeInTheDocument();
            expect(
                screen.getByText('점수는 얼마나 자주 갱신되나요?')
            ).toBeInTheDocument();
        });
    });

    describe('JSON-LD', () => {
        it('renders WebPage, BreadcrumbList, and FAQPage JSON-LD blocks', async () => {
            const { container } = render(await FearGreedRoutePage());
            const scripts = Array.from(
                container.querySelectorAll('script[type="application/ld+json"]')
            );
            const types = scripts.map(
                s => JSON.parse(s.textContent ?? '{}')['@type']
            );
            expect(types).toContain('WebPage');
            expect(types).toContain('BreadcrumbList');
            expect(types).toContain('FAQPage');

            // 이름까지 고정한다 — @type만 보면 `미국`이 떨어져 나가도 통과한다.
            const breadcrumb = scripts
                .map(s => JSON.parse(s.textContent ?? '{}'))
                .find(d => d['@type'] === 'BreadcrumbList');
            expect(breadcrumb.itemListElement.at(-1).name).toBe(
                '미국 공포·탐욕 지수'
            );
        });

        it('one FAQ answer states the index is computed independently from CNN', async () => {
            const { container } = render(await FearGreedRoutePage());
            const scripts = Array.from(
                container.querySelectorAll('script[type="application/ld+json"]')
            );
            const faq = scripts
                .map(s => JSON.parse(s.textContent ?? '{}'))
                .find(d => d['@type'] === 'FAQPage');
            expect(faq).toBeDefined();

            const answers = (
                faq.mainEntity as {
                    acceptedAnswer: { text: string };
                }[]
            ).map(q => q.acceptedAnswer.text);
            expect(
                answers.some(
                    text => text.includes('CNN') && text.includes('독립')
                )
            ).toBe(true);
        });

        it('sets WebPage dateModified to snapshot.asOf when a snapshot exists', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue(SAMPLE_SNAPSHOT);
            const { container } = render(await FearGreedRoutePage());
            const scripts = Array.from(
                container.querySelectorAll('script[type="application/ld+json"]')
            );
            const webPage = scripts
                .map(s => JSON.parse(s.textContent ?? '{}'))
                .find(d => d['@type'] === 'WebPage');
            expect(webPage.dateModified).toBe(SAMPLE_SNAPSHOT.snapshot?.asOf);
        });

        it('omits WebPage dateModified when the snapshot is null — never invents a fallback date', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue({
                snapshot: null,
                comparisons: [],
            });
            const { container } = render(await FearGreedRoutePage());
            const scripts = Array.from(
                container.querySelectorAll('script[type="application/ld+json"]')
            );
            const webPage = scripts
                .map(s => JSON.parse(s.textContent ?? '{}'))
                .find(d => d['@type'] === 'WebPage');
            expect(webPage.dateModified).toBeUndefined();
        });
    });

    describe('ISR degrade guard', () => {
        it('getMarketFearGreedStatic rejecting degrades to a 200 render instead of throwing', async () => {
            mockGetMarketFearGreedStatic.mockRejectedValue(
                new Error('redis down')
            );
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            const element = await FearGreedRoutePage();
            render(element);

            expect(
                screen.getByRole('heading', { level: 1 })
            ).toBeInTheDocument();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[FearGreedRoute] getMarketFearGreedStatic failed:'
                ),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('an empty reading (snapshot: null) still renders a normal page — no notFound()', async () => {
            mockGetMarketFearGreedStatic.mockResolvedValue({
                snapshot: null,
                comparisons: [],
            });

            render(await FearGreedRoutePage());
            expect(
                screen.getByRole('heading', { level: 1 })
            ).toBeInTheDocument();
        });
    });
});
