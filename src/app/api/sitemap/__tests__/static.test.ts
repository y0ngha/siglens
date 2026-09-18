vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});
const BACKTESTING_DATA_AT = new Date('2026-03-31T00:00:00.000Z');
vi.mock('@/entities/sitemap-entry', () => ({
    buildStaticEntries: vi.fn().mockReturnValue([]),
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
    backtestingDataDate: vi.fn(() => BACKTESTING_DATA_AT),
}));

import { GET } from '@/app/api/sitemap/static/route';
import { buildStaticEntries, toUrlSetXml } from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const mockBuildStaticEntries = buildStaticEntries as MockedFunction<
    typeof buildStaticEntries
>;
const mockToUrlSetXml = toUrlSetXml as MockedFunction<typeof toUrlSetXml>;

function mainHostRequest(): Request {
    return new Request('https://siglens.io/api/sitemap/static');
}

describe('GET /api/sitemap/static', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns XML with correct content-type header', async () => {
        const res = await GET(mainHostRequest());

        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
    });

    it('passes the backtesting data date through to buildStaticEntries', async () => {
        await GET(mainHostRequest());

        expect(mockBuildStaticEntries).toHaveBeenCalledWith(
            expect.any(Date),
            expect.objectContaining({
                backtestingDataDate: BACKTESTING_DATA_AT,
            })
        );
    });

    it('passes a Date to buildStaticEntries', async () => {
        await GET(mainHostRequest());

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

        await GET(mainHostRequest());

        expect(mockToUrlSetXml).toHaveBeenCalledWith(entries);
    });

    it('includes cache-control header', async () => {
        const res = await GET(mainHostRequest());

        expect(res.headers.get('Cache-Control')).toContain(
            'stale-while-revalidate'
        );
    });
});
