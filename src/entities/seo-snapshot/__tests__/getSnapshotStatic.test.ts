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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import {
    SNAPSHOT_MAX_AGE_MS,
    type SeoAnalysisSnapshot,
} from '@/entities/seo-snapshot/model';

// FIX D(감사) — max-age 필터는 Date.now() 기준이라 실제 wall-clock에 기대면
// 테스트가 시간 의존 flaky가 된다(docs/workflows/MISTAKES.md 사례). fake
// timers로 고정한다.
const FIXED_NOW = new Date('2026-07-25T12:00:00.000Z');

function snapshotAt(generatedAt: Date, tab = 'technical'): SeoAnalysisSnapshot {
    return {
        symbol: 'AAPL',
        tab: tab as SeoAnalysisSnapshot['tab'],
        content: { summary: 'bullish' },
        model: 'deepseek-v4-flash',
        generatedAt,
        updatedAt: generatedAt,
    };
}

const SNAPSHOTS: SeoAnalysisSnapshot[] = [
    snapshotAt(new Date('2026-07-24T00:00:00.000Z')),
];

describe('getSeoSnapshotsStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);
        mockFindBySymbol.mockResolvedValue(SNAPSHOTS);
    });

    afterEach(() => {
        vi.useRealTimers();
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

    describe('FIX D(감사) — max-age 필터', () => {
        it('cutoff보다 신선한 행은 그대로 통과한다', async () => {
            const freshRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - SNAPSHOT_MAX_AGE_MS + 1)
            );
            mockFindBySymbol.mockResolvedValue([freshRow]);

            const result = await getSeoSnapshotsStatic('AAPL', 3600);

            expect(result).toEqual([freshRow]);
        });

        it('cutoff보다 오래된 행은 필터링되어 빠진다', async () => {
            const staleRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - SNAPSHOT_MAX_AGE_MS - 1)
            );
            mockFindBySymbol.mockResolvedValue([staleRow]);

            const result = await getSeoSnapshotsStatic('AAPL', 3600);

            expect(result).toEqual([]);
        });

        it('신선/오래된 행이 섞이면 신선한 행만 반환한다', async () => {
            const freshRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - 1000),
                'technical'
            );
            const staleRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - SNAPSHOT_MAX_AGE_MS - 1),
                'overall'
            );
            mockFindBySymbol.mockResolvedValue([freshRow, staleRow]);

            const result = await getSeoSnapshotsStatic('AAPL', 3600);

            expect(result).toEqual([freshRow]);
        });

        it('행이 드롭되면 warn 로그를 남긴다(cron 정체 신호)', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const staleRow = snapshotAt(
                new Date(FIXED_NOW.getTime() - SNAPSHOT_MAX_AGE_MS - 1)
            );
            mockFindBySymbol.mockResolvedValue([staleRow]);

            await getSeoSnapshotsStatic('AAPL', 3600);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[getSeoSnapshotsStatic] AAPL: dropped 1 row(s)'
                )
            );

            warnSpy.mockRestore();
        });

        it('드롭이 없으면 warn 로그를 남기지 않는다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await getSeoSnapshotsStatic('AAPL', 3600);

            expect(warnSpy).not.toHaveBeenCalled();

            warnSpy.mockRestore();
        });
    });
});
