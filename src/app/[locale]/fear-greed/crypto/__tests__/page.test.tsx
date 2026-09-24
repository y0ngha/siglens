import { render, screen, within } from '@testing-library/react';
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
    '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache',
    () => ({
        getMarketFearGreedCryptoStatic: vi.fn(),
    })
);

import FearGreedCryptoRoutePage, {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/fear-greed/crypto/page';
import { getMarketFearGreedCryptoStatic } from '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache';
import type { MarketFearGreedCryptoView } from '@/entities/market-fear-greed';
import { CRYPTO_FEAR_GREED_FACTOR_KEYS } from '@y0ngha/siglens-core';
import { SITE_URL } from '@/shared/lib/seo';
import { koMessage } from '@/shared/test-utils/koMessage';

const mockLoader = getMarketFearGreedCryptoStatic as MockedFunction<
    typeof getMarketFearGreedCryptoStatic
>;

const READY: MarketFearGreedCryptoView = {
    snapshot: {
        score: 28,
        label: 'FEAR',
        factors: [],
        confidence: 'normal',
        sampleSize: 900,
        asOf: '2026-09-24',
    },
    comparisons: [],
};

const EMPTY: MarketFearGreedCryptoView = { snapshot: null, comparisons: [] };

const PARAMS = { params: Promise.resolve({ locale: 'ko' }) };

async function renderPage() {
    return render(
        await FearGreedCryptoRoutePage({
            params: Promise.resolve({ locale: 'ko' }),
        })
    );
}

function jsonLdBlocks(container: HTMLElement): Record<string, unknown>[] {
    return Array.from(
        container.querySelectorAll('script[type="application/ld+json"]')
    ).map(s => JSON.parse(s.textContent ?? '{}'));
}

describe('/fear-greed/crypto page', () => {
    beforeEach(() => {
        mockLoader.mockResolvedValue(EMPTY);
    });

    it('caches for an hour (literal)', () => {
        expect(revalidate).toBe(3600);
    });

    describe('generateMetadata', () => {
        it('uses the crypto title and keywords', async () => {
            mockLoader.mockResolvedValue(READY);

            const meta = await generateMetadata(PARAMS);

            expect(meta.title).toBe(
                '코인 공포탐욕지수 - 오늘 암호화폐 시장 심리'
            );
            expect(meta.keywords).toContain('코인 공포지수');
            expect(meta.openGraph?.images).toEqual([
                expect.objectContaining({ url: '/og-image.png' }),
            ]);
        });

        it('self-canonicals when the reading is available', async () => {
            mockLoader.mockResolvedValue(READY);

            const meta = await generateMetadata(PARAMS);

            expect(meta.alternates?.canonical).toBe(
                `${SITE_URL}/fear-greed/crypto`
            );
            expect(meta.robots).toEqual({ index: true, follow: true });
        });

        it('noindexes without canonical when the sample is insufficient', async () => {
            const meta = await generateMetadata(PARAMS);

            expect(meta.alternates?.canonical).toBeNull();
            expect(meta.robots).toEqual({ index: false, follow: true });
        });

        it('degrades to noindex when the loader throws, logging the alarm prefix', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockLoader.mockRejectedValue(new Error('FMP down'));

            const meta = await generateMetadata(PARAMS);

            expect(meta.robots).toEqual({ index: false, follow: true });
            // CloudWatch 필터(`siglens-market-data-loader-failed`)가 이 문자열을 본다.
            expect(
                spy.mock.calls.some(args =>
                    String(args[0]).startsWith(
                        '[FearGreedCryptoRoute] getMarketFearGreedCryptoStatic failed'
                    )
                )
            ).toBe(true);
            spy.mockRestore();
        });
    });

    describe('body', () => {
        it('renders the crypto h1 and 암호화폐 as the current region tab', async () => {
            mockLoader.mockResolvedValue(READY);

            await renderPage();

            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                '코인 공포탐욕지수'
            );
            const nav = screen.getByRole('navigation', { name: '지역 선택' });
            expect(nav).toHaveTextContent('미국');
            expect(nav).toHaveTextContent('한국');
            expect(
                within(nav).getByText('암호화폐').closest('[aria-current]')
            ).toHaveAttribute('aria-current', 'page');
        });

        // 판독값이 없어도 "읽는 법"은 시장의 요인 목록을 그대로 보여야 한다.
        it('lists the six crypto factors with crypto labels, even when degraded', async () => {
            await renderPage();

            for (const key of CRYPTO_FEAR_GREED_FACTOR_KEYS) {
                const label = koMessage(
                    `shared.lib.fearGreedFactor.label.${key}`
                );
                const description = koMessage(
                    `shared.lib.fearGreedFactor.descriptionCrypto.${key}`
                );
                expect(
                    screen.getByText(new RegExp(`^${label} — `))
                ).toHaveTextContent(description);
            }
            // 미국·한국 전용 요인은 나오지 않는다.
            expect(screen.queryByText(/하이일드 수요/)).not.toBeInTheDocument();
            expect(screen.queryByText(/^시장 변동성/)).not.toBeInTheDocument();
        });

        it('FAQ discloses alternative.me, survivorship bias, gold weekends, UTC close and no advice', async () => {
            await renderPage();

            const faq = screen.getByRole('heading', {
                level: 2,
                name: '자주 묻는 질문',
            }).parentElement as HTMLElement;
            for (const needle of [
                /alternative\.me/,
                /생존 편향/,
                /주말/,
                /00:00 UTC/,
                /투자 조언이 아닙니다/,
            ]) {
                expect(within(faq).getAllByText(needle).length).toBeGreaterThan(
                    0
                );
            }
        });

        it('renders a 200 page rather than throwing when the loader fails', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockLoader.mockRejectedValue(new Error('FMP down'));

            await renderPage();

            expect(
                screen.getByRole('heading', { level: 1 })
            ).toBeInTheDocument();
            spy.mockRestore();
        });
    });

    describe('JSON-LD', () => {
        it('emits WebPage (dateModified = asOf), BreadcrumbList and FAQPage when ready', async () => {
            mockLoader.mockResolvedValue(READY);

            const { container } = await renderPage();
            const blocks = jsonLdBlocks(container);

            expect(blocks.map(b => b['@type'])).toEqual([
                'WebPage',
                'BreadcrumbList',
                'FAQPage',
            ]);
            const webPage = blocks.find(b => b['@type'] === 'WebPage');
            expect(webPage?.dateModified).toBe('2026-09-24');
            const faq = blocks.find(b => b['@type'] === 'FAQPage') as {
                mainEntity: unknown[];
            };
            expect(faq.mainEntity).toHaveLength(5);
        });

        it('keeps only FAQPage when degraded', async () => {
            const { container } = await renderPage();

            expect(jsonLdBlocks(container).map(b => b['@type'])).toEqual([
                'FAQPage',
            ]);
        });

        it('visible breadcrumb matches BreadcrumbList', async () => {
            mockLoader.mockResolvedValue(READY);
            const { expectVisibleBreadcrumbMatchesJsonLdDom } =
                await import('@/__tests__/utils/expectVisibleBreadcrumb');

            const { container } = await renderPage();

            expectVisibleBreadcrumbMatchesJsonLdDom(
                container,
                koMessage('shared.ui.Breadcrumb.46c31f')
            );
        });
    });
});
