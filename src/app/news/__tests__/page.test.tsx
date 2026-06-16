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

import NewsHubPage from '../page';

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
