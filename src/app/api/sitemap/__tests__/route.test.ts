vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});
vi.mock('@/entities/sitemap-entry', () => ({
    loadLongTailTickers: vi.fn(),
    LONGTAIL_TICKERS_PER_PAGE: 10000,
    toSitemapIndexXml: vi
        .fn()
        .mockReturnValue('<?xml version="1.0"?><sitemapindex/>'),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01'),
    SITE_URL: 'https://siglens.io',
}));

import { GET } from '@/app/api/sitemap/route';
import {
    loadLongTailTickers,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const mockLoadLongTailTickers = loadLongTailTickers as MockedFunction<
    typeof loadLongTailTickers
>;
const mockToSitemapIndexXml = toSitemapIndexXml as MockedFunction<
    typeof toSitemapIndexXml
>;

describe('GET /api/sitemap (index)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns XML with correct content-type and cache headers', async () => {
        mockLoadLongTailTickers.mockResolvedValue([]);

        const res = await GET();

        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
        expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
    });

    it('passes static and popular entries without long-tail pages when tickers are empty', async () => {
        mockLoadLongTailTickers.mockResolvedValue([]);

        await GET();

        const entries = mockToSitemapIndexXml.mock.calls[0][0];
        expect(entries).toHaveLength(2);
        expect(entries[0].url).toContain('sitemap-static.xml');
        expect(entries[1].url).toContain('sitemap-popular.xml');
    });

    it('generates long-tail sub-sitemap entries based on ticker count', async () => {
        // tickersPerPage = Math.floor(50000 / 5) = 10000
        // ceil(25001 / 10000) = 3 longtail pages → 2 + 3 = 5 total entries
        const tickers = Array.from({ length: 25001 }, (_, i) => `T${i}`);
        mockLoadLongTailTickers.mockResolvedValue(tickers);

        await GET();

        const entries = mockToSitemapIndexXml.mock.calls[0][0];
        expect(entries).toHaveLength(5);
        expect(entries[2].url).toContain('sitemap-longtail-1.xml');
        expect(entries[3].url).toContain('sitemap-longtail-2.xml');
        expect(entries[4].url).toContain('sitemap-longtail-3.xml');
    });
});
