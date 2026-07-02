const { mockCreate, mockRateLimit, mockGetClientIp } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockRateLimit: vi.fn(),
    mockGetClientIp: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/entities/shared-analysis/api', () => {
    return {
        DrizzleSharedAnalysisRepository: function () {
            return { create: mockCreate };
        },
    };
});
vi.mock('@/entities/shared-analysis/server/rateLimit', () => ({
    checkShareRateLimit: mockRateLimit,
}));
vi.mock('@/entities/chat-message/api/getClientIp', () => ({
    getClientIp: mockGetClientIp,
}));
vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig()),
    hashUsageIp: vi.fn(() => 'ipHashX'),
}));

import { createShareSnapshotAction } from '../actions/createShareSnapshotAction';

const validInput = {
    kind: 'chart',
    symbol: 'AAPL',
    context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' },
    result: { trend: 'bullish', summary: 'x' },
    sharerTier: 'free',
};

describe('createShareSnapshotAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRateLimit.mockResolvedValue(true);
        mockGetClientIp.mockResolvedValue('1.2.3.4');
        mockCreate.mockResolvedValue('id123');
    });

    it('returns ok with id on success', async () => {
        const res = await createShareSnapshotAction(validInput);
        expect(res).toEqual({ ok: true, id: 'id123' });
    });

    it('rejects invalid input', async () => {
        const res = await createShareSnapshotAction({ kind: 'bogus' });
        expect(res).toEqual({ ok: false, code: 'invalid_input' });
    });

    it('blocks when rate limited', async () => {
        mockRateLimit.mockResolvedValue(false);
        const res = await createShareSnapshotAction(validInput);
        expect(res).toEqual({ ok: false, code: 'rate_limited' });
    });

    it('returns persist_failed when repo throws', async () => {
        mockCreate.mockRejectedValue(new Error('db down'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await createShareSnapshotAction(validInput);
        expect(res).toEqual({ ok: false, code: 'persist_failed' });
        spy.mockRestore();
    });

    // addendum C-3(a): non-chart kind (news) also succeeds (kind routing)
    it('succeeds with a non-chart kind (news)', async () => {
        const newsInput = {
            kind: 'news',
            symbol: 'TSLA',
            context: {
                symbol: 'TSLA',
                displayName: 'Tesla',
                assetClass: 'us_equity',
            },
            result: {
                overallSentiment: 'bullish',
                currentDriverKo: '실적 호조',
            },
            sharerTier: 'free',
        };
        const res = await createShareSnapshotAction(newsInput);
        expect(res).toEqual({ ok: true, id: 'id123' });
    });

    // addendum C-3(b): dedupe — repo.create returns an existing id, action forwards it
    it('forwards existing id when repo returns dedupe id', async () => {
        mockCreate.mockResolvedValue('existingId456');
        const res = await createShareSnapshotAction(validInput);
        expect(res).toEqual({ ok: true, id: 'existingId456' });
    });
});
