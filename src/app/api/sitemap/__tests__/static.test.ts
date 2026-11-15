vi.mock('next/server', async () => {
    const actual =
        await vi.importActual<typeof import('next/server')>('next/server');
    return { ...actual };
});
vi.mock('@/entities/guide/api', () => ({
    loadGuideCatalog: vi.fn().mockResolvedValue(null),
}));
// 신호 이력 집계는 DB를 읽는다 — 목 없이 두면 테스트가 실제 DB 클라이언트로 간다.
const signalHubCounts = vi.hoisted(() => ({
    value: [] as {
        signalType: string;
        symbols: number;
        latestSession: string;
    }[],
}));
vi.mock('@/entities/signal-history/api', () => ({
    loadSignalHubCounts: vi.fn(async () => signalHubCounts.value),
}));
const BACKTESTING_DATA_AT = new Date('2026-03-31T00:00:00.000Z');
vi.mock('@/entities/sitemap-entry/lib/buildStaticEntries', () => ({
    buildStaticEntries: vi.fn().mockReturnValue([]),
}));
vi.mock('@/entities/sitemap-entry/lib/xml', () => ({
    toUrlSetXml: vi.fn().mockReturnValue('<?xml version="1.0"?><urlset/>'),
}));
vi.mock('@/entities/sitemap-entry/lib/backtestingDataDate', () => ({
    backtestingDataDate: vi.fn(() => BACKTESTING_DATA_AT),
}));

import { GET } from '@/app/api/sitemap/static/route';
import { buildStaticEntries } from '@/entities/sitemap-entry/lib/buildStaticEntries';
import { toUrlSetXml } from '@/entities/sitemap-entry/lib/xml';
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
        signalHubCounts.value = [];
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

    it('색인 기준을 채운 신호 페이지만 정적 엔트리 뒤에 싣는다', async () => {
        mockBuildStaticEntries.mockReturnValue([]);
        signalHubCounts.value = [
            {
                signalType: 'golden_cross',
                symbols: 5,
                latestSession: '2026-11-13',
            },
            {
                signalType: 'death_cross',
                symbols: 4,
                latestSession: '2026-11-13',
            },
        ];

        await GET(mainHostRequest());

        const entries = mockToUrlSetXml.mock.calls.find(Boolean)?.[0] ?? [];
        const urls = entries.map(entry => entry.url);
        expect(urls).toContain(
            'https://siglens.io/market/signals/golden-cross'
        );
        expect(urls).not.toContain(
            'https://siglens.io/market/signals/death-cross'
        );
    });

    it('includes cache-control header', async () => {
        const res = await GET(mainHostRequest());

        expect(res.headers.get('Cache-Control')).toContain(
            'stale-while-revalidate'
        );
    });
});
