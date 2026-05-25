vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});
vi.mock('@/entities/sitemap-entry', () => ({
    buildPopularEntries: vi.fn().mockResolvedValue([]),
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));

import { GET } from '@/app/api/sitemap/popular/route';
import { buildPopularEntries, toUrlSetXml } from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const mockBuildPopularEntries = buildPopularEntries as MockedFunction<
    typeof buildPopularEntries
>;
const mockToUrlSetXml = toUrlSetXml as MockedFunction<typeof toUrlSetXml>;

describe('GET /api/sitemap/popular', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns XML with correct content-type header', async () => {
        const res = await GET();

        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
    });

    it('passes a Date to buildPopularEntries', async () => {
        await GET();

        expect(mockBuildPopularEntries).toHaveBeenCalledTimes(1);
        expect(mockBuildPopularEntries.mock.calls[0][0]).toBeInstanceOf(Date);
    });

    it('passes built entries to toUrlSetXml', async () => {
        const entries = [
            {
                url: 'https://siglens.io/AAPL',
                lastModified: new Date(),
                changeFrequency: 'daily' as const,
                priority: 0.8,
            },
        ];
        mockBuildPopularEntries.mockResolvedValue(entries);

        await GET();

        expect(mockToUrlSetXml).toHaveBeenCalledWith(entries);
    });

    it('includes cache-control with stale-while-revalidate', async () => {
        const res = await GET();

        expect(res.headers.get('Cache-Control')).toContain(
            'stale-while-revalidate'
        );
    });
});
