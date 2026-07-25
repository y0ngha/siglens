// spy → vi.mock → imports 순서 (MISTAKES.md Tests §17: vi.mock을 import 사이에 끼우지
// 않고, 팩토리가 참조하는 spy는 vi.hoisted로 끌어올린다).
const {
    mockFindBySymbol,
    mockRepoCtor,
    mockStaticSymbolCache,
    mockGetDatabaseClient,
} = vi.hoisted(() => {
    const mockFindBySymbol = vi.fn();
    // Regular function (not arrow) so vi.fn()'s wrapped implementation is
    // usable with `new` — the production code does `new DrizzleSeoSnapshotRepository(db)`.
    const mockRepoCtor = vi.fn(function MockRepo() {
        return { findBySymbol: mockFindBySymbol };
    });
    // pass-through stub that ALSO records keyParts/symbol/extraTags/revalidateSeconds
    // so we can assert the exact cache key + tag contract the pre-warm cron relies on.
    const mockStaticSymbolCache = vi.fn(
        (
            _keyParts: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>,
            _extraTags?: readonly string[],
            _revalidateSeconds?: number
        ) => fetcher()
    );
    const mockGetDatabaseClient = vi.fn(() => ({ db: {} }));
    return {
        mockFindBySymbol,
        mockRepoCtor,
        mockStaticSymbolCache,
        mockGetDatabaseClient,
    };
});

vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockStaticSymbolCache,
}));

vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: mockRepoCtor,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import type { SeoAnalysisSnapshot } from '@/entities/seo-snapshot/model';

const SNAPSHOTS: SeoAnalysisSnapshot[] = [
    {
        symbol: 'AAPL',
        tab: 'technical',
        content: { summary: 'bullish' },
        model: 'deepseek-v4-flash',
        generatedAt: new Date('2026-07-24T00:00:00.000Z'),
        updatedAt: new Date('2026-07-24T00:00:01.000Z'),
    },
];

describe('getSeoSnapshotsStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindBySymbol.mockResolvedValue(SNAPSHOTS);
    });

    it('staticSymbolCache를 정확한 keyParts/symbol/extraTags/revalidateSeconds로 호출한다(소문자 입력 → 대문자 정규화)', async () => {
        await getSeoSnapshotsStatic('aapl', 3600);

        expect(mockStaticSymbolCache).toHaveBeenCalledTimes(1);
        const [keyParts, symbol, , extraTags, revalidateSeconds] =
            mockStaticSymbolCache.mock.calls[0];
        expect(keyParts).toEqual(['seo-snapshots', 'AAPL']);
        expect(symbol).toBe('AAPL');
        expect(extraTags).toEqual(['seo-snapshot:AAPL']);
        expect(revalidateSeconds).toBe(3600);
    });

    it('성공 시 findBySymbol(대문자 심볼) 결과를 반환한다', async () => {
        const result = await getSeoSnapshotsStatic('AAPL', 3600);

        expect(mockRepoCtor).toHaveBeenCalledWith({});
        expect(mockFindBySymbol).toHaveBeenCalledWith('AAPL');
        expect(result).toEqual(SNAPSHOTS);
    });

    it('성공 시 행 수를 info 로그로 남긴다 (audit fix FIX 7 — 전 렌더러 null-render 시 유일한 관측 신호)', async () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        await getSeoSnapshotsStatic('AAPL', 3600);

        expect(infoSpy).toHaveBeenCalledWith(
            '[getSeoSnapshotsStatic] AAPL: 1 snapshot row(s)'
        );

        infoSpy.mockRestore();
    });

    it('findBySymbol이 reject해도 throw하지 않고 []로 fail-open degrade한다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockFindBySymbol.mockRejectedValue(new Error('DB unavailable'));

        const result = await getSeoSnapshotsStatic('AAPL', 3600);

        expect(result).toEqual([]);
        expect(errorSpy).toHaveBeenCalledWith(
            '[getSeoSnapshotsStatic] read failed, degrading:',
            expect.objectContaining({ message: 'DB unavailable' })
        );

        errorSpy.mockRestore();
    });
});
