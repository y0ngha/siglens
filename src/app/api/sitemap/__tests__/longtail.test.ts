vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});

/**
 * SITEMAP_MAX_URLS_PER_FILE=15, LONGTAIL_ENTRIES_PER_TICKER=5 이므로
 * TICKERS_PER_PAGE = Math.floor(15/5) = 3.
 * 티커 5개(AAA~EEE): page1=[AAA,BBB,CCC], page2=[DDD,EEE].
 */
vi.mock('@/entities/sitemap-entry', () => ({
    loadLongTailTickers: vi.fn(),
    SITEMAP_MAX_URLS_PER_FILE: 15,
    LONGTAIL_ENTRIES_PER_TICKER: 5,
    buildLongTailEntries: vi.fn(),
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01'),
    SITE_URL: 'https://siglens.io',
}));

import { GET } from '@/app/api/sitemap/longtail/[page]/route';
import {
    buildLongTailEntries,
    loadLongTailTickers,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const mockLoadLongTailTickers = loadLongTailTickers as MockedFunction<
    typeof loadLongTailTickers
>;
const mockBuildLongTailEntries = buildLongTailEntries as MockedFunction<
    typeof buildLongTailEntries
>;
const mockToUrlSetXml = toUrlSetXml as MockedFunction<typeof toUrlSetXml>;

const FAKE_ENTRIES = [
    {
        url: 'https://siglens.io/AAA',
        lastModified: new Date('2025-01-01'),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
    },
];

function callGET(page: string): Promise<Response> {
    return GET(new Request('http://localhost/api/sitemap/longtail/' + page), {
        params: Promise.resolve({ page }),
    });
}

describe('GET /api/sitemap/longtail/[page]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadLongTailTickers.mockResolvedValue([
            'AAA',
            'BBB',
            'CCC',
            'DDD',
            'EEE',
        ]);
        mockBuildLongTailEntries.mockReturnValue(FAKE_ENTRIES);
    });

    it('returns 404 for non-numeric page', async () => {
        const res = await callGET('abc');
        expect(res.status).toBe(404);
    });

    it('returns 404 for page 0', async () => {
        const res = await callGET('0');
        expect(res.status).toBe(404);
    });

    it('returns 404 for negative page', async () => {
        const res = await callGET('-1');
        expect(res.status).toBe(404);
    });

    it('returns 404 when page exceeds available chunks', async () => {
        const res = await callGET('100');
        expect(res.status).toBe(404);
    });

    it('returns XML for a valid first page', async () => {
        const res = await callGET('1');

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
    });

    it('calls buildLongTailEntries with the first 3-ticker chunk for page 1', async () => {
        await callGET('1');

        expect(mockBuildLongTailEntries).toHaveBeenCalledWith(
            ['AAA', 'BBB', 'CCC'],
            new Date('2025-01-01')
        );
    });

    it('calls buildLongTailEntries with the remaining 2-ticker chunk for page 2', async () => {
        await callGET('2');

        expect(mockBuildLongTailEntries).toHaveBeenCalledWith(
            ['DDD', 'EEE'],
            new Date('2025-01-01')
        );
    });

    it('passes buildLongTailEntries result to toUrlSetXml', async () => {
        await callGET('1');

        expect(mockToUrlSetXml).toHaveBeenCalledWith(FAKE_ENTRIES);
    });
});
