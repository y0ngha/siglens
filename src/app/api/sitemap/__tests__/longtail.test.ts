vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});
vi.mock('@/entities/sitemap-entry', () => ({
    loadLongTailTickers: vi.fn(),
    SITEMAP_MAX_URLS_PER_FILE: 3,
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01'),
    SITE_URL: 'https://siglens.io',
}));

import { GET } from '@/app/api/sitemap/longtail/[page]/route';
import { loadLongTailTickers, toUrlSetXml } from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const mockLoadLongTailTickers = loadLongTailTickers as MockedFunction<
    typeof loadLongTailTickers
>;
const mockToUrlSetXml = toUrlSetXml as MockedFunction<typeof toUrlSetXml>;

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

    it('passes correct chunk of tickers to toUrlSetXml for page 1', async () => {
        await callGET('1');

        const entries = mockToUrlSetXml.mock.calls[0][0];
        expect(entries).toHaveLength(3);
        expect(entries[0].url).toBe('https://siglens.io/AAA');
        expect(entries[1].url).toBe('https://siglens.io/BBB');
        expect(entries[2].url).toBe('https://siglens.io/CCC');
    });

    it('returns the second chunk for page 2', async () => {
        await callGET('2');

        const entries = mockToUrlSetXml.mock.calls[0][0];
        expect(entries).toHaveLength(2);
        expect(entries[0].url).toBe('https://siglens.io/DDD');
        expect(entries[1].url).toBe('https://siglens.io/EEE');
    });

    it('sets changeFrequency to weekly and priority to 0.5', async () => {
        await callGET('1');

        const entries = mockToUrlSetXml.mock.calls[0][0];
        expect(entries[0].changeFrequency).toBe('weekly');
        expect(entries[0].priority).toBe(0.5);
    });
});
