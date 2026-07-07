vi.mock('@/entities/sitemap-entry', () => ({
    toSitemapIndexXml: vi
        .fn()
        .mockReturnValue('<?xml version="1.0"?><sitemapindex/>'),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import { GET } from '@/app/api/sitemap/route';
import { toSitemapIndexXml } from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const mockToSitemapIndexXml = toSitemapIndexXml as MockedFunction<
    typeof toSitemapIndexXml
>;

describe('GET /api/sitemap (index)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns XML with correct content-type and cache headers', async () => {
        const res = await GET();

        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
        expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
    });

    it('passes only static, popular, and crypto sitemap entries', async () => {
        await GET();

        const entries = mockToSitemapIndexXml.mock.calls[0][0];
        expect(entries).toHaveLength(3);
        expect(entries[0].url).toBe('https://siglens.io/sitemap-static.xml');
        expect(entries[1].url).toBe('https://siglens.io/sitemap-popular.xml');
        expect(entries[2].url).toBe('https://siglens.io/sitemap-crypto.xml');
        expect(entries.map(entry => entry.url).join('\n')).not.toContain(
            'sitemap-longtail'
        );
    });
});
