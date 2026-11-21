const {
    mockClient,
    mockAssetInfo,
    mockProviderFor,
    mockFetchBars,
    mockRepoCtor,
} = vi.hoisted(() => ({
    mockClient: vi.fn(),
    mockAssetInfo: vi.fn(),
    mockProviderFor: vi.fn(),
    mockFetchBars: vi.fn(),
    mockRepoCtor: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));
vi.mock('@/entities/ticker/server/getAssetInfoResilient', () => ({
    getAssetInfoResilient: mockAssetInfo,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: mockProviderFor,
}));
vi.mock('@/entities/analysis-outcome/api/analysisOutcomeRepository', () => ({
    DrizzleAnalysisOutcomeRepository: class {
        constructor(db: unknown) {
            mockRepoCtor(db);
        }
    },
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<typeof import('@y0ngha/siglens-core')>()),
    fetchBarsWithIndicators: mockFetchBars,
}));

import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { createAnalysisOutcomesDeps } from '../createDeps';

const PROVIDER = { tag: 'provider' };
const BARS = [{ time: 1, open: 1, high: 2, low: 1, close: 1.5, volume: 1 }];

describe('createAnalysisOutcomesDeps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.mockReturnValue({ db: { tag: 'db' } });
        mockProviderFor.mockReturnValue(PROVIDER);
        mockFetchBars.mockResolvedValue({ bars: BARS, indicators: {} });
    });

    it('throws when the database is unavailable', () => {
        mockClient.mockReturnValue(null);
        expect(() => createAnalysisOutcomesDeps(() => false)).toThrow(
            '[analysis-outcomes] database unavailable'
        );
    });

    it('builds the repository on the database handle and passes the deadline probe through', () => {
        const probe = () => false;
        const deps = createAnalysisOutcomesDeps(probe);
        expect(mockRepoCtor).toHaveBeenCalledWith({ tag: 'db' });
        expect(deps.isDeadlineReached).toBe(probe);
    });

    it('loads US bars the way the analysis does: cached provider of the US session, fmpSymbol, no extra argument', async () => {
        mockAssetInfo.mockResolvedValue({
            assetInfo: { symbol: 'SPX', name: 'S&P', fmpSymbol: '^GSPC' },
            degraded: false,
        });
        const deps = createAnalysisOutcomesDeps(() => false);

        const loaded = await deps.loadGroupBars('SPX', '1Day');

        expect(mockProviderFor).toHaveBeenCalledWith(US_EQUITY_SESSION);
        expect(mockFetchBars).toHaveBeenCalledWith(
            PROVIDER,
            'SPX',
            '1Day',
            '^GSPC'
        );
        expect(loaded).toEqual({ bars: BARS, session: US_EQUITY_SESSION });
    });

    it('a Korean symbol gets the KRX session and provider', async () => {
        mockAssetInfo.mockResolvedValue({
            assetInfo: { symbol: '005930.KS', name: 'Samsung' },
            degraded: false,
        });
        const deps = createAnalysisOutcomesDeps(() => false);

        const loaded = await deps.loadGroupBars('005930.KS', '1Day');

        expect(mockProviderFor).toHaveBeenCalledWith(KR_EQUITY_SESSION);
        expect(loaded.session).toBe(KR_EQUITY_SESSION);
    });

    it('a crypto asset gets the 24/7 session', async () => {
        mockAssetInfo.mockResolvedValue({
            assetInfo: {
                symbol: 'BTCUSD',
                name: 'Bitcoin',
                marketProfile: 'crypto',
            },
            degraded: false,
        });
        const deps = createAnalysisOutcomesDeps(() => false);

        const loaded = await deps.loadGroupBars('BTCUSD', '1Day');

        expect(loaded.session).toBe(CRYPTO_SESSION);
    });

    it.each([
        [
            'degraded asset lookup',
            { assetInfo: { symbol: 'X', name: 'X' }, degraded: true },
        ],
        ['unknown symbol', { assetInfo: null, degraded: false }],
    ])(
        '%s throws instead of guessing a market, and fetches no bars',
        async (_label, resolved) => {
            mockAssetInfo.mockResolvedValue(resolved);
            const deps = createAnalysisOutcomesDeps(() => false);

            await expect(deps.loadGroupBars('X', '1Day')).rejects.toThrow(
                'asset info unavailable for X'
            );
            expect(mockFetchBars).not.toHaveBeenCalled();
        }
    );

    it('a provider failure propagates so the labeller records a group failure', async () => {
        mockAssetInfo.mockResolvedValue({
            assetInfo: { symbol: 'AAPL', name: 'Apple' },
            degraded: false,
        });
        mockFetchBars.mockRejectedValue(new Error('429'));
        const deps = createAnalysisOutcomesDeps(() => false);

        await expect(deps.loadGroupBars('AAPL', '1Day')).rejects.toThrow('429');
    });
});
