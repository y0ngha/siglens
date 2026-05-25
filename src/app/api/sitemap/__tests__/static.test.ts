vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});
vi.mock('@/entities/sitemap-entry', () => ({
    buildStaticEntries: vi.fn().mockReturnValue([]),
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));

import { GET } from '@/app/api/sitemap/static/route';
import { buildStaticEntries, toUrlSetXml } from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const mockBuildStaticEntries = buildStaticEntries as MockedFunction<
    typeof buildStaticEntries
>;
const mockToUrlSetXml = toUrlSetXml as MockedFunction<typeof toUrlSetXml>;

describe('GET /api/sitemap/static', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns XML with correct content-type header', async () => {
        const res = await GET();

        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
    });

    it('passes a Date to buildStaticEntries', async () => {
        await GET();

        expect(mockBuildStaticEntries).toHaveBeenCalledTimes(1);
        expect(mockBuildStaticEntries.mock.calls[0][0]).toBeInstanceOf(Date);
    });

    it('passes built entries to toUrlSetXml', async () => {
        const entries = [
            {
                url: 'https://siglens.io/',
                lastModified: new Date(),
                changeFrequency: 'daily' as const,
                priority: 1.0,
            },
        ];
        mockBuildStaticEntries.mockReturnValue(entries);

        await GET();

        expect(mockToUrlSetXml).toHaveBeenCalledWith(entries);
    });

    it('includes cache-control header', async () => {
        const res = await GET();

        expect(res.headers.get('Cache-Control')).toContain(
            'stale-while-revalidate'
        );
    });
});
