vi.mock('@/entities/sitemap-entry', () => ({
    LONGTAIL_TICKERS_PER_PAGE: 2_000,
    toSitemapIndexXml: vi
        .fn()
        .mockReturnValue('<?xml version="1.0"?><sitemapindex/>'),
}));
vi.mock('@/entities/sitemap-entry/server', () => ({
    countLongTailTickers: vi.fn(),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01'),
    SITE_URL: 'https://siglens.io',
}));

import { GET } from '@/app/api/sitemap/route';
import { toSitemapIndexXml } from '@/entities/sitemap-entry';
import { countLongTailTickers } from '@/entities/sitemap-entry/server';
import type { MockedFunction } from 'vitest';

const mockCountLongTailTickers = countLongTailTickers as MockedFunction<
    typeof countLongTailTickers
>;
const mockToSitemapIndexXml = toSitemapIndexXml as MockedFunction<
    typeof toSitemapIndexXml
>;

describe('GET /api/sitemap (index)', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('returns XML with correct content-type and cache headers', async () => {
        mockCountLongTailTickers.mockResolvedValue(0);

        const res = await GET();

        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
        expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
    });

    it('passes static and popular entries without long-tail pages when tickers are empty', async () => {
        mockCountLongTailTickers.mockResolvedValue(0);

        await GET();

        const entries = mockToSitemapIndexXml.mock.calls[0][0];
        expect(entries).toHaveLength(2);
        expect(entries[0].url).toContain('sitemap-static.xml');
        expect(entries[1].url).toContain('sitemap-popular.xml');
    });

    it('generates long-tail sub-sitemap entries based on ticker count', async () => {
        mockCountLongTailTickers.mockResolvedValue(4_001);

        await GET();

        const entries = mockToSitemapIndexXml.mock.calls[0][0];
        expect(entries).toHaveLength(5);
        expect(entries[2].url).toContain('sitemap-longtail-1.xml');
        expect(entries[3].url).toContain('sitemap-longtail-2.xml');
        expect(entries[4].url).toContain('sitemap-longtail-3.xml');
        expect(entries[2].lastModified).toEqual(new Date('2025-01-01'));
        expect(mockCountLongTailTickers).toHaveBeenCalledOnce();
    });

    it('returns temporary unavailable response when ticker count fails', async () => {
        mockCountLongTailTickers.mockRejectedValue(new Error('db failed'));

        const res = await GET();

        expect(res.status).toBe(503);
        await expect(res.text()).resolves.toBe(
            'Sitemap data temporarily unavailable'
        );
        expect(res.headers.get('Retry-After')).toBe('300');
        expect(mockToSitemapIndexXml).not.toHaveBeenCalled();
    });
});
