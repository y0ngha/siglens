vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});

vi.mock('@/entities/sitemap-entry', () => ({
    buildCryptoPopularEntries: vi.fn().mockReturnValue([]),
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));

import { GET } from '@/app/api/sitemap/crypto/route';
import {
    buildCryptoPopularEntries,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const mockBuildCryptoPopularEntries =
    buildCryptoPopularEntries as MockedFunction<
        typeof buildCryptoPopularEntries
    >;
const mockToUrlSetXml = toUrlSetXml as MockedFunction<typeof toUrlSetXml>;

describe('GET /api/sitemap/crypto', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 200 with XML content-type and sitemap cache headers', async () => {
        const res = await GET();

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
        expect(res.headers.get('Cache-Control')).toBe(
            'public, max-age=3600, stale-while-revalidate=3600'
        );
    });

    it('serializes only curated crypto popular entries', async () => {
        const popularEntry = {
            url: 'https://siglens.io/BTCUSD',
            lastModified: new Date('2026-07-08T00:00:00.000Z'),
            changeFrequency: 'daily' as const,
            priority: 0.8,
        };
        mockBuildCryptoPopularEntries.mockReturnValue([popularEntry]);

        await GET();

        expect(mockBuildCryptoPopularEntries).toHaveBeenCalledOnce();
        expect(mockToUrlSetXml).toHaveBeenCalledWith([popularEntry]);
    });
});
