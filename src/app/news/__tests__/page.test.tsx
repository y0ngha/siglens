import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// staticSymbolCache: return a few headlines per category so CategoryCards render previews.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn().mockResolvedValue([
        {
            id: 'r1',
            symbol: '__NEWS_GENERAL__',
            source: 'Reuters',
            url: 'https://example.com/news1',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'Markets rally on Fed comments',
            titleKo: '연준 발언에 시장 랠리',
            bodyEn: null,
            bodyKo: null,
            summaryKo: null,
            sentiment: null,
            category: null,
            priceImpact: null,
            tickers: [],
            analyzedAt: null,
        },
    ]),
}));

vi.mock('@/entities/market-news/api', () => ({
    getMarketNewsList: vi.fn().mockResolvedValue([]),
}));

import NewsHubPage, { generateMetadata } from '../page';

describe('/news hub page는', () => {
    it('5개 카테고리 딥링크를 SSR 렌더한다', async () => {
        render(await NewsHubPage());

        const allLinks = screen.getAllByRole('link');
        const hrefs = allLinks.map(l => l.getAttribute('href'));

        // Each CategoryCard renders <a href="/news/{slug}"> as a deep link
        for (const slug of [
            'general',
            'stock',
            'crypto',
            'forex',
            'articles',
        ]) {
            expect(hrefs).toContain(`/news/${slug}`);
        }
    });
});

describe('/news hub page generateMetadata는', () => {
    it('canonical = /news 를 설정한다', () => {
        const meta = generateMetadata();
        expect(meta.alternates?.canonical).toBe('/news');
    });

    it('title에 마켓 뉴스가 포함된다', () => {
        const meta = generateMetadata();
        expect(String(meta.title)).toContain('마켓 뉴스');
    });
});

describe('/news hub page JSON-LD는', () => {
    it('WebPage JSON-LD 스크립트를 렌더한다', async () => {
        const { container } = render(await NewsHubPage());
        const scripts = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        );
        const webPageScript = scripts.find(s => {
            try {
                return JSON.parse(s.textContent ?? '')['@type'] === 'WebPage';
            } catch {
                return false;
            }
        });
        expect(webPageScript).toBeDefined();
    });

    it('BreadcrumbList JSON-LD 스크립트를 렌더한다', async () => {
        const { container } = render(await NewsHubPage());
        const scripts = Array.from(
            container.querySelectorAll('script[type="application/ld+json"]')
        );
        const breadcrumbScript = scripts.find(s => {
            try {
                return (
                    JSON.parse(s.textContent ?? '')['@type'] ===
                    'BreadcrumbList'
                );
            } catch {
                return false;
            }
        });
        expect(breadcrumbScript).toBeDefined();
    });
});
