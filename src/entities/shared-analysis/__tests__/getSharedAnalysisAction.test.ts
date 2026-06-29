const { mockFindById } = vi.hoisted(() => ({ mockFindById: vi.fn() }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/entities/shared-analysis/api', () => {
    return {
        DrizzleSharedAnalysisRepository: function () {
            return { findById: mockFindById };
        },
    };
});

import { getSharedAnalysis } from '../actions/getSharedAnalysisAction';

const snap = {
    kind: 'chart',
    symbol: 'AAPL',
    context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' },
    result: { trend: 'bullish' },
};

describe('getSharedAnalysis', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns found for a live snapshot', async () => {
        mockFindById.mockResolvedValue({
            snapshotJson: snap,
            createdAt: new Date('2026-06-29T00:00:00Z'),
            expiresAt: new Date('2999-01-01T00:00:00Z'),
        });
        const res = await getSharedAnalysis('id1');
        expect(res.status).toBe('found');
    });

    it('returns expired when past expiresAt', async () => {
        mockFindById.mockResolvedValue({
            snapshotJson: snap,
            createdAt: new Date('2020-01-01T00:00:00Z'),
            expiresAt: new Date('2020-01-08T00:00:00Z'),
        });
        const res = await getSharedAnalysis('id1');
        expect(res.status).toBe('expired');
    });

    it('returns not_found when missing', async () => {
        mockFindById.mockResolvedValue(null);
        expect((await getSharedAnalysis('id1')).status).toBe('not_found');
    });

    it('returns not_found when snapshot shape is invalid', async () => {
        mockFindById.mockResolvedValue({
            snapshotJson: { bogus: true },
            createdAt: new Date(),
            expiresAt: new Date('2999-01-01T00:00:00Z'),
        });
        expect((await getSharedAnalysis('id1')).status).toBe('not_found');
    });

    it('found result includes createdAt as ISO string', async () => {
        mockFindById.mockResolvedValue({
            snapshotJson: snap,
            createdAt: new Date('2026-06-29T12:00:00Z'),
            expiresAt: new Date('2999-01-01T00:00:00Z'),
        });
        const res = await getSharedAnalysis('id1');
        expect(res.status).toBe('found');
        if (res.status === 'found') {
            expect(res.createdAt).toBe('2026-06-29T12:00:00.000Z');
        }
    });
});
