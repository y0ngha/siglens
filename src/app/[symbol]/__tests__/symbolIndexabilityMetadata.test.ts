// spy → vi.mock → imports order (MISTAKES.md Tests §17: hoist spies referenced by
// vi.mock factories via vi.hoisted so they aren't TDZ'd when the factory runs).
const { mockEvaluateSymbolIndexability, mockGetSeoSnapshotsStatic } =
    vi.hoisted(() => ({
        mockEvaluateSymbolIndexability: vi.fn(),
        mockGetSeoSnapshotsStatic: vi.fn(),
    }));

vi.mock('@/entities/symbol-indexability', () => ({
    evaluateSymbolIndexability: mockEvaluateSymbolIndexability,
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBlockedSymbolMetadata } from '@/app/[symbol]/symbolIndexabilityMetadata';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import type { AssetInfo } from '@/shared/lib/types';

const ASSET_INFO = { symbol: 'AAPL', name: 'Apple Inc.' } as AssetInfo;

describe('getBlockedSymbolMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not read snapshots on the non-degraded path and returns null when indexable', async () => {
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: true,
            reason: 'popular',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: false,
            revalidateSeconds: 21600,
        });

        expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: false,
            hasSnapshot: undefined,
        });
        expect(result).toBeNull();
    });

    it('does not read snapshots on the non-degraded path and returns noindex when blocked', async () => {
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'longtail-default-blocked',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'ZZZOF',
            assetInfo: ASSET_INFO,
            degraded: false,
            revalidateSeconds: 21600,
        });

        expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });

    it('reads snapshots on the degraded path and threads hasSnapshot=true when a snapshot exists', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            { symbol: 'AAPL', tab: 'technical' },
        ]);
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: true,
            reason: 'degraded-with-snapshot',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            revalidateSeconds: 21600,
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith('AAPL', 21600);
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            hasSnapshot: true,
        });
        expect(result).toBeNull();
    });

    it('reads snapshots on the degraded path and threads hasSnapshot=false when no snapshot exists', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'degraded',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            revalidateSeconds: 43200,
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith('AAPL', 43200);
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            hasSnapshot: false,
        });
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });
});
