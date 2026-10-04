vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});
vi.mock('@/entities/sitemap-entry/lib/buildPopularEntries', () => ({
    buildPopularEntries: vi.fn().mockReturnValue([]),
}));
vi.mock('@/entities/sitemap-entry/lib/xml', () => ({
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));
const PROSE_INPUTS = {
    snapshotGeneratedAt: new Map([['AAPL:overall', new Date(0)]]),
};
vi.mock('@/entities/sitemap-entry/server', () => ({
    loadPopularSitemapInputs: vi.fn(async () => PROSE_INPUTS),
}));

import { GET } from '@/app/api/sitemap/popular/route';
import { buildPopularEntries } from '@/entities/sitemap-entry/lib/buildPopularEntries';
import { toUrlSetXml } from '@/entities/sitemap-entry/lib/xml';
import type { MockedFunction } from 'vitest';

const mockBuildPopularEntries = buildPopularEntries as MockedFunction<
    typeof buildPopularEntries
>;
const mockToUrlSetXml = toUrlSetXml as MockedFunction<typeof toUrlSetXml>;

function mainHostRequest(): Request {
    return new Request('https://siglens.io/api/sitemap/popular');
}

describe('GET /api/sitemap/popular', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns XML with correct content-type header', async () => {
        const res = await GET(mainHostRequest());

        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
    });

    it('passes a Date and the loaded prose inputs to buildPopularEntries', async () => {
        await GET(mainHostRequest());

        expect(mockBuildPopularEntries).toHaveBeenCalledTimes(1);
        expect(mockBuildPopularEntries).toHaveBeenCalledWith(
            expect.any(Date),
            PROSE_INPUTS
        );
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
        mockBuildPopularEntries.mockReturnValue(entries);

        await GET(mainHostRequest());

        expect(mockToUrlSetXml).toHaveBeenCalledWith(entries);
    });

    it('includes cache-control with stale-while-revalidate', async () => {
        const res = await GET(mainHostRequest());

        expect(res.headers.get('Cache-Control')).toContain(
            'stale-while-revalidate'
        );
    });
});
