vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

// Mock staticSymbolCache to return a non-empty snapshot for valid categories.
// Factory is fully self-contained — cannot reference outer-scope consts because
// vi.mock factories are hoisted before variable initialization.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn().mockResolvedValue([
        {
            id: 'r1',
            symbol: '__NEWS_CRYPTO__',
            source: 'CoinWire',
            url: 'https://example.com/btc',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'BTC up',
            titleKo: '비트코인 상승',
            bodyEn: null,
            bodyKo: null,
            summaryKo: null,
            sentiment: null,
            category: null,
            priceImpact: null,
            tickers: ['BTCUSD'],
            analyzedAt: null,
        },
    ]),
}));

// Mock getMarketNewsList to avoid DB in tests
vi.mock('@/entities/market-news/api', () => ({
    getMarketNewsList: vi.fn().mockResolvedValue([]),
}));

// Mock MarketNewsDigest and MarketNewsList — they are client components with
// their own polling logic; RSC test should not drive them.
vi.mock('@/widgets/market-news', () => ({
    MarketNewsDigest: () => <div data-testid="digest-stub" />,
    MarketNewsList: () => <div data-testid="list-stub" />,
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { generateMetadata } from '../page';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import CategoryNewsPage from '../page';

describe('/news/[category] generateMetadata는', () => {
    it('유효 카테고리면 canonical /news/<slug>를 설정한다', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ category: 'crypto' }),
        });
        expect(meta.alternates?.canonical).toBe('/news/crypto');
        expect(String(meta.title)).toContain('암호화폐');
    });

    it('유효하지 않은 카테고리면 noindex 메타를 반환한다', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ category: 'bogus' }),
        });
        expect(meta.robots).toMatchObject({ index: false });
    });

    it('유효 카테고리이지만 스냅샷이 비어 있으면 noindex + canonical null을 반환한다', async () => {
        vi.mocked(staticSymbolCache).mockResolvedValueOnce([]);

        const meta = await generateMetadata({
            params: Promise.resolve({ category: 'crypto' }),
        });
        expect(meta.robots).toMatchObject({ index: false });
        expect(meta.alternates?.canonical).toBeNull();
    });
});

describe('/news/[category] CategoryNewsPage default export는', () => {
    it('유효하지 않은 카테고리 slug이면 notFound()를 호출한다', async () => {
        await expect(
            CategoryNewsPage({ params: Promise.resolve({ category: 'bogus' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('유효 카테고리이면 h1에 카테고리 라벨을 렌더한다', async () => {
        render(
            await CategoryNewsPage({
                params: Promise.resolve({ category: 'crypto' }),
            })
        );
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '미국 암호화폐 뉴스'
        );
    });

    it('유효 카테고리이면 JSON-LD ItemList 스크립트를 렌더한다', async () => {
        const { container } = render(
            await CategoryNewsPage({
                params: Promise.resolve({ category: 'crypto' }),
            })
        );
        const scripts = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        );
        const itemListScript = scripts.find(s => {
            try {
                const parsed = JSON.parse(s.textContent ?? '');
                return parsed['@type'] === 'ItemList';
            } catch {
                return false;
            }
        });
        expect(itemListScript).toBeDefined();

        // I4: Article.image should use the per-category OG URL, not the generic site OG
        const itemListData = JSON.parse(itemListScript!.textContent ?? '');
        const firstArticle = itemListData.itemListElement?.[0]?.item;
        expect(firstArticle?.image).toContain('/news/crypto/opengraph-image');

        // C-3 R2: publisher.name should be the original article source, not SITE_NAME
        expect(firstArticle?.publisher?.name).toBe('CoinWire');
    });

    it('스냅샷이 비어 있으면(빈 DB) graceful empty state를 렌더한다', async () => {
        vi.mocked(staticSymbolCache).mockResolvedValueOnce([]);

        render(
            await CategoryNewsPage({
                params: Promise.resolve({ category: 'crypto' }),
            })
        );
        // Empty state renders in MarketNewsDegraded (no news copy)
        expect(
            screen.getByText(/최근 뉴스를 불러오지 못했어요/)
        ).toBeInTheDocument();
    });

    it('스냅샷이 비어 있으면(degrade) JSON-LD 스크립트를 하나도 렌더하지 않는다', async () => {
        vi.mocked(staticSymbolCache).mockResolvedValueOnce([]);

        const { container } = render(
            await CategoryNewsPage({
                params: Promise.resolve({ category: 'crypto' }),
            })
        );
        const scripts = container.querySelectorAll(
            'script[type="application/ld+json"]'
        );
        // noindex degrade pages must not emit any JSON-LD (WebPage, BreadcrumbList, ItemList)
        expect(scripts).toHaveLength(0);
    });
});
