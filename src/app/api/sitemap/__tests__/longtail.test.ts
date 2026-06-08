vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});

vi.mock('@/entities/sitemap-entry', () => ({
    LONGTAIL_TICKERS_PER_PAGE: 3,
    SITEMAP_MAX_URLS_PER_FILE: 3,
    buildLongTailEntries: vi.fn(),
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));
vi.mock('@/entities/sitemap-entry/server', () => ({
    loadLongTailTickerPage: vi.fn(),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01'),
    SITE_URL: 'https://siglens.io',
}));

import { GET } from '@/app/api/sitemap/longtail/[page]/route';
import {
    buildLongTailEntries,
    LONGTAIL_TICKERS_PER_PAGE,
    SITEMAP_MAX_URLS_PER_FILE,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import { loadLongTailTickerPage } from '@/entities/sitemap-entry/server';
import { SITE_BUILD_DATE } from '@/shared/lib/seo';
import type { MockedFunction } from 'vitest';

const mockLoadLongTailTickerPage = loadLongTailTickerPage as MockedFunction<
    typeof loadLongTailTickerPage
>;
const mockBuildLongTailEntries = buildLongTailEntries as MockedFunction<
    typeof buildLongTailEntries
>;
const mockToUrlSetXml = toUrlSetXml as MockedFunction<typeof toUrlSetXml>;

const ALL_TICKERS = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'] as const;

function callGET(page: string): Promise<Response> {
    return GET(new Request(`http://localhost/api/sitemap/longtail/${page}`), {
        params: Promise.resolve({ page }),
    });
}

describe('GET /api/sitemap/longtail/[page]', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        mockLoadLongTailTickerPage.mockImplementation(async pageNum => {
            const start = (pageNum - 1) * LONGTAIL_TICKERS_PER_PAGE;
            return ALL_TICKERS.slice(start, start + LONGTAIL_TICKERS_PER_PAGE);
        });

        mockBuildLongTailEntries.mockImplementation(chunk =>
            chunk.map(ticker => ({
                url: `https://siglens.io/${ticker}`,
                lastModified: SITE_BUILD_DATE,
                changeFrequency: 'weekly' as const,
                priority: 0.5,
            }))
        );
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('returns 404 for invalid page strings and nonpositive values', async () => {
        await expect(callGET('abc')).resolves.toHaveProperty('status', 404);
        await expect(callGET('1.2')).resolves.toHaveProperty('status', 404);
        await expect(callGET('0')).resolves.toHaveProperty('status', 404);
        await expect(callGET('-1')).resolves.toHaveProperty('status', 404);
    });

    it('returns 404 when the page is empty', async () => {
        const res = await callGET('3');

        expect(res.status).toBe(404);
        expect(mockLoadLongTailTickerPage).toHaveBeenCalledWith(3);
        expect(mockBuildLongTailEntries).not.toHaveBeenCalled();
        expect(mockToUrlSetXml).not.toHaveBeenCalled();
    });

    it('returns XML for page 1 with the first chunk', async () => {
        const res = await callGET('1');

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
        expect(res.headers.get('Cache-Control')).toBe(
            'public, max-age=3600, stale-while-revalidate=3600'
        );
        expect(mockLoadLongTailTickerPage).toHaveBeenCalledWith(1);
        expect(mockBuildLongTailEntries).toHaveBeenCalledWith(
            ['AAA', 'BBB', 'CCC'],
            SITE_BUILD_DATE
        );
        expect(mockToUrlSetXml).toHaveBeenCalled();
    });

    it('returns XML for page 2 with the remaining chunk', async () => {
        const res = await callGET('2');

        expect(res.status).toBe(200);
        expect(mockLoadLongTailTickerPage).toHaveBeenCalledWith(2);
        expect(mockBuildLongTailEntries).toHaveBeenCalledWith(
            ['DDD', 'EEE'],
            SITE_BUILD_DATE
        );
        expect(mockToUrlSetXml).toHaveBeenCalled();
    });

    it('returns 503 with Retry-After 300 when the loader fails', async () => {
        mockLoadLongTailTickerPage.mockRejectedValueOnce(new Error('db down'));

        const res = await callGET('1');

        expect(res.status).toBe(503);
        expect(res.headers.get('Retry-After')).toBe('300');
        await expect(res.text()).resolves.toBe(
            'Sitemap data temporarily unavailable'
        );
        expect(mockBuildLongTailEntries).not.toHaveBeenCalled();
        expect(mockToUrlSetXml).not.toHaveBeenCalled();
    });

    it('returns 500 when entry generation exceeds the URL cap', async () => {
        mockBuildLongTailEntries.mockReturnValueOnce(
            Array.from(
                { length: SITEMAP_MAX_URLS_PER_FILE + 1 },
                (_, index) => ({
                    url: `https://siglens.io/overflow-${index}`,
                    lastModified: SITE_BUILD_DATE,
                    changeFrequency: 'weekly' as const,
                    priority: 0.5,
                })
            )
        );

        const res = await callGET('1');

        expect(res.status).toBe(500);
        expect(mockToUrlSetXml).not.toHaveBeenCalled();
    });
});
