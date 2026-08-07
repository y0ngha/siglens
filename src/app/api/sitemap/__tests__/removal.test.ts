vi.mock('@/entities/sitemap-entry/server', () => ({
    loadRemovalSitemapEntries: vi.fn(),
}));
vi.mock('@/entities/sitemap-entry', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@/entities/sitemap-entry')>();

    return {
        ...actual,
        toRemovalUrlSetXml: vi
            .fn()
            .mockReturnValue('<?xml version="1.0"?><urlset/>'),
    };
});

import { constants } from 'node:http2';
import { dynamic, GET } from '@/app/api/sitemap/removal/[kind]/route';
import {
    SITEMAP_CACHE_CONTROL,
    SITEMAP_RETRY_AFTER_SECONDS,
    SITEMAP_UNAVAILABLE_BODY,
} from '@/app/api/sitemap/_shared/constants';
import {
    REMOVAL_SITEMAP_KINDS,
    SITEMAP_MAX_URLS_PER_FILE,
    toRemovalUrlSetXml,
    type RemovalSitemapEntry,
} from '@/entities/sitemap-entry';
import { loadRemovalSitemapEntries } from '@/entities/sitemap-entry/server';
import type { NextResponse } from 'next/server';
import type { MockedFunction, MockInstance } from 'vitest';

const {
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
    HTTP_STATUS_NOT_FOUND,
    HTTP_STATUS_OK,
    HTTP_STATUS_SERVICE_UNAVAILABLE,
} = constants;

const mockLoadRemovalSitemapEntries =
    loadRemovalSitemapEntries as MockedFunction<
        typeof loadRemovalSitemapEntries
    >;
const mockToRemovalUrlSetXml = toRemovalUrlSetXml as MockedFunction<
    typeof toRemovalUrlSetXml
>;

const entry: RemovalSitemapEntry = {
    url: 'https://siglens.io/AAPL/chart',
    lastModified: new Date('2026-07-08T00:00:00.000Z'),
};

let errorSpy: MockInstance;

function callGET(kind: string): Promise<NextResponse> {
    return GET(new Request(`https://siglens.io/api/sitemap/removal/${kind}`), {
        params: Promise.resolve({ kind }),
    });
}

describe('GET /api/sitemap/removal/[kind]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockLoadRemovalSitemapEntries.mockResolvedValue([entry]);
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    describe('when the route module is loaded', () => {
        it('forces dynamic rendering', () => {
            expect(dynamic).toBe('force-dynamic');
        });
    });

    describe('when the removal sitemap kind is valid', () => {
        it.each(REMOVAL_SITEMAP_KINDS)(
            'returns the %s sitemap as cacheable XML',
            async kind => {
                const response = await callGET(kind);

                expect(response.status).toBe(HTTP_STATUS_OK);
                expect(response.headers.get('Content-Type')).toBe(
                    'application/xml; charset=utf-8'
                );
                expect(response.headers.get('Cache-Control')).toBe(
                    SITEMAP_CACHE_CONTROL
                );
                await expect(response.text()).resolves.toBe(
                    '<?xml version="1.0"?><urlset/>'
                );
                expect(mockLoadRemovalSitemapEntries).toHaveBeenCalledWith(
                    kind
                );
                expect(mockToRemovalUrlSetXml).toHaveBeenCalledWith([entry]);
                expect(errorSpy).not.toHaveBeenCalled();
            }
        );
    });

    describe('when the removal sitemap kind is invalid', () => {
        it('returns 404 without loading or serializing entries', async () => {
            const response = await callGET('invalid');

            expect(response.status).toBe(HTTP_STATUS_NOT_FOUND);
            expect(mockLoadRemovalSitemapEntries).not.toHaveBeenCalled();
            expect(mockToRemovalUrlSetXml).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    describe('when the removal sitemap loader rejects', () => {
        it('returns a retryable unavailable response and logs the kind only', async () => {
            mockLoadRemovalSitemapEntries.mockRejectedValue(
                new Error('database credentials')
            );

            const response = await callGET('chart');

            expect(response.status).toBe(HTTP_STATUS_SERVICE_UNAVAILABLE);
            expect(response.headers.get('Retry-After')).toBe(
                SITEMAP_RETRY_AFTER_SECONDS
            );
            await expect(response.text()).resolves.toBe(
                SITEMAP_UNAVAILABLE_BODY
            );
            expect(errorSpy).toHaveBeenCalledWith(
                '[removal-sitemap] entry loading failed',
                { kind: 'chart' }
            );
            expect(mockToRemovalUrlSetXml).not.toHaveBeenCalled();
        });
    });

    describe('when the removal sitemap exceeds the URL limit', () => {
        it('returns 500, logs kind and count, and does not serialize', async () => {
            const entries = Array.from(
                { length: SITEMAP_MAX_URLS_PER_FILE + 1 },
                () => entry
            );
            mockLoadRemovalSitemapEntries.mockResolvedValue(entries);

            const response = await callGET('chart');

            expect(response.status).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
            expect(errorSpy).toHaveBeenCalledWith(
                '[removal-sitemap] entry limit exceeded',
                { kind: 'chart', count: SITEMAP_MAX_URLS_PER_FILE + 1 }
            );
            expect(mockToRemovalUrlSetXml).not.toHaveBeenCalled();
        });
    });

    describe('when the removal sitemap is at the exact URL limit', () => {
        it('returns 200 and serializes every entry', async () => {
            const entries = Array.from(
                { length: SITEMAP_MAX_URLS_PER_FILE },
                () => entry
            );
            mockLoadRemovalSitemapEntries.mockResolvedValue(entries);

            const response = await callGET('chart');

            expect(response.status).toBe(HTTP_STATUS_OK);
            expect(mockToRemovalUrlSetXml).toHaveBeenCalledWith(entries);
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });
});
