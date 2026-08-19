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
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
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
            tab: 'technical',
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
            tab: 'technical',
        });

        expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });

    it('reads snapshots on the degraded path and threads hasSnapshot=true when a same-tab snapshot exists', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            // content must be RENDERABLE (FIX 1), not merely present — a
            // valid `summary` passes narrowTechnicalContent/hasTechnicalProse.
            {
                symbol: 'AAPL',
                tab: 'technical',
                content: { summary: '유효한 기술적 분석 요약 텍스트입니다.' },
            },
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
            tab: 'technical',
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
            tab: 'technical',
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

    // Regression guard for FIX 2 (audit): a degraded+whitelisted symbol with a
    // snapshot row for a DIFFERENT tab must NOT be flipped indexable. Before
    // this fix, hasSnapshot was `(await getSeoSnapshotsStatic(...)).length > 0`
    // — true for ANY tab's row — so e.g. a degraded `/congress` with only a
    // `technical` row was marked indexable while its body renders the thin
    // degraded shell.
    it('a snapshot row for a DIFFERENT tab does NOT flip hasSnapshot to true (regression guard)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            { symbol: 'AAPL', tab: 'technical' },
        ]);
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'degraded',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            revalidateSeconds: 86400,
            tab: 'congress',
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith('AAPL', 86400);
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            hasSnapshot: false,
        });
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });

    // FIX 1 (audit): a same-tab row whose `content` is malformed (fails the
    // renderer's narrowing) must NOT flip hasSnapshot to true. Before this
    // fix, `hasSnapshot` was `.some(s => s.tab === tab)` — TRUE for any
    // same-tab row regardless of whether its content renders — so a
    // degraded+whitelisted symbol with a malformed `technical` row was marked
    // indexable while `TechnicalSnapshotProse` null-renders the thin
    // degraded shell for that same content.
    it('a same-tab row whose content is malformed does NOT flip hasSnapshot to true (FIX 1 regression guard)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            // missing `summary` (and no other narrowable field) — fails
            // narrowTechnicalContent, so hasTechnicalProse(content) === false.
            { symbol: 'AAPL', tab: 'technical', content: { foo: 'bar' } },
        ]);
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'degraded',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            revalidateSeconds: 21600,
            tab: 'technical',
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith('AAPL', 21600);
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            hasSnapshot: false,
        });
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });

    // fear-greed/position pass no `tab` — the DB read must be skipped entirely
    // and hasSnapshot must stay undefined so the existing degraded→noindex
    // behavior is preserved (never flipped indexable by another tab's row).
    it('skips the DB read entirely and keeps hasSnapshot=undefined when no tab is given (fear-greed/position)', async () => {
        mockEvaluateSymbolIndexability.mockReturnValue({
            indexable: false,
            reason: 'degraded',
        });

        const result = await getBlockedSymbolMetadata({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            revalidateSeconds: 86400,
        });

        expect(mockGetSeoSnapshotsStatic).not.toHaveBeenCalled();
        expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
            symbol: 'AAPL',
            assetInfo: ASSET_INFO,
            degraded: true,
            hasSnapshot: undefined,
        });
        expect(result).toEqual(NOINDEX_SYMBOL_METADATA);
    });
});
