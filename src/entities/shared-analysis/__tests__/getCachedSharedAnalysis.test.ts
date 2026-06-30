/**
 * R4-2: getCachedSharedAnalysis deduplicates calls within the same
 * React request scope using React.cache. These tests verify that the
 * wrapper correctly delegates to getSharedAnalysisAction and that the
 * underlying action is invoked with the right arguments.
 */

const { mockGetSharedAnalysisAction } = vi.hoisted(() => ({
    mockGetSharedAnalysisAction: vi.fn(),
}));

vi.mock('@/entities/shared-analysis/actions/getSharedAnalysisAction', () => ({
    getSharedAnalysisAction: mockGetSharedAnalysisAction,
}));

// React.cache is a pass-through in test environments (no RSC request scope),
// so we validate delegation behaviour — not the dedup mechanics themselves.
vi.mock('react', async importOriginal => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        // Expose identity so the cached wrapper delegates straight through.
        cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
    };
});

import { getCachedSharedAnalysis } from '../lib/getCachedSharedAnalysis';

const foundResult = {
    status: 'found' as const,
    snapshot: {
        kind: 'chart' as const,
        symbol: 'AAPL',
        context: {
            symbol: 'AAPL',
            displayName: 'Apple',
            assetClass: 'us_equity' as const,
        },
        result: { trend: 'bullish' },
    },
    createdAt: '2026-06-29T00:00:00.000Z',
};

describe('getCachedSharedAnalysis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('delegates to getSharedAnalysisAction with the given id', async () => {
        mockGetSharedAnalysisAction.mockResolvedValue(foundResult);
        const result = await getCachedSharedAnalysis('abc123');
        expect(mockGetSharedAnalysisAction).toHaveBeenCalledOnce();
        expect(mockGetSharedAnalysisAction).toHaveBeenCalledWith('abc123');
        expect(result).toStrictEqual(foundResult);
    });

    it('propagates not_found from the underlying action', async () => {
        mockGetSharedAnalysisAction.mockResolvedValue({ status: 'not_found' });
        const result = await getCachedSharedAnalysis('missing');
        expect(result.status).toBe('not_found');
    });

    it('propagates expired from the underlying action', async () => {
        mockGetSharedAnalysisAction.mockResolvedValue({ status: 'expired' });
        const result = await getCachedSharedAnalysis('stale');
        expect(result.status).toBe('expired');
    });
});
