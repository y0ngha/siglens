vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

vi.mock('@/entities/sitemap-entry', () => ({
    buildCryptoPopularEntries: vi.fn().mockReturnValue([]),
    buildLongTailEntries: vi.fn().mockReturnValue([]),
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));

// vi.hoisted ensures these fns are initialised before the vi.mock factory
// runs (vi.mock calls are hoisted to the top of the file by the transformer,
// so plain const declarations would be undefined when the factory executes).
const { mockCount, mockLoadPage } = vi.hoisted(() => ({
    mockCount: vi.fn<() => Promise<number>>().mockResolvedValue(0),
    mockLoadPage: vi
        .fn<(page: number, size: number) => Promise<readonly string[]>>()
        .mockResolvedValue([]),
}));

vi.mock('@/entities/sitemap-entry/api', () => ({
    CRYPTO_LONGTAIL_CAP: 1000,
    // Must use `function` (not arrow) so `new DrizzleCryptoLongTailSource(db)`
    // does not throw "is not a constructor" in vitest's mock engine.
    DrizzleCryptoLongTailSource: vi.fn().mockImplementation(function () {
        return { count: mockCount, loadPage: mockLoadPage };
    }),
}));

vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01'),
    SITE_URL: 'https://siglens.io',
}));

import { constants } from 'node:http2';
import { GET } from '@/app/api/sitemap/crypto/route';
import {
    buildCryptoPopularEntries,
    buildLongTailEntries,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

const { HTTP_STATUS_SERVICE_UNAVAILABLE } = constants;

const mockBuildCryptoPopularEntries =
    buildCryptoPopularEntries as MockedFunction<
        typeof buildCryptoPopularEntries
    >;
const mockBuildLongTailEntries = buildLongTailEntries as MockedFunction<
    typeof buildLongTailEntries
>;
const mockToUrlSetXml = toUrlSetXml as MockedFunction<typeof toUrlSetXml>;

describe('GET /api/sitemap/crypto', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        // Re-apply defaults: vi.clearAllMocks() clears .mock.* state but not
        // implementations; however mockRejectedValue set in test 1 persists
        // unless we explicitly re-queue a resolved value here.
        mockCount.mockResolvedValue(0);
        mockLoadPage.mockResolvedValue([]);
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        consoleWarnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('returns 503 with Retry-After when DB access fails', async () => {
        mockCount.mockRejectedValue(new Error('db down'));
        mockLoadPage.mockRejectedValue(new Error('db down'));

        const res = await GET();

        expect(res.status).toBe(HTTP_STATUS_SERVICE_UNAVAILABLE);
        expect(res.headers.get('Retry-After')).toBe('300');
        await expect(res.text()).resolves.toBe(
            'Sitemap data temporarily unavailable'
        );
        expect(mockToUrlSetXml).not.toHaveBeenCalled();
    });

    it('returns 200 with XML content-type on success', async () => {
        const res = await GET();

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8'
        );
    });

    it('logs a console.warn when eligible count exceeds served entries (dropped > 0)', async () => {
        // eligible=5 from count(), but loadPage returns only 2 symbols.
        // buildLongTailEntries (mocked) returns 2 entries → served=2.
        // dropped = eligible(5) - served(2) = 3 > 0 → should warn.
        mockCount.mockResolvedValue(5);
        mockLoadPage.mockResolvedValue(['LTCUSD', 'DOGUSD']);
        mockBuildLongTailEntries.mockReturnValue([
            {
                url: 'https://siglens.io/LTCUSD',
                lastModified: new Date('2025-01-01'),
                changeFrequency: 'weekly' as const,
                priority: 0.5,
            },
            {
                url: 'https://siglens.io/DOGUSD',
                lastModified: new Date('2025-01-01'),
                changeFrequency: 'weekly' as const,
                priority: 0.5,
            },
        ]);

        await GET();

        expect(consoleWarnSpy).toHaveBeenCalledOnce();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('cap dropped')
        );
    });

    it('merges popular and longtail entries into the XML output', async () => {
        const popularEntry = {
            url: 'https://siglens.io/BTCUSD',
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.9,
        };
        const longTailEntry = {
            url: 'https://siglens.io/DOGUSD',
            lastModified: new Date('2025-01-01'),
            changeFrequency: 'weekly' as const,
            priority: 0.5,
        };

        mockBuildCryptoPopularEntries.mockReturnValue([popularEntry]);
        mockBuildLongTailEntries.mockReturnValue([longTailEntry]);
        mockCount.mockResolvedValue(1);
        mockLoadPage.mockResolvedValue(['DOGUSD']);

        await GET();

        expect(mockToUrlSetXml).toHaveBeenCalledWith([
            popularEntry,
            longTailEntry,
        ]);
    });
});
