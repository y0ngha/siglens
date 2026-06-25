import type { MockedFunction } from 'vitest';

vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
}));

const { MOCK_CRYPTO_SESSION, MOCK_EQUITY_SESSION } = vi.hoisted(() => ({
    MOCK_CRYPTO_SESSION: { type: 'crypto' } as never,
    MOCK_EQUITY_SESSION: { type: 'equity' } as never,
}));

vi.mock('@y0ngha/siglens-core', () => ({
    submitAnalysis: vi.fn(),
    CRYPTO_SESSION: MOCK_CRYPTO_SESSION,
    US_EQUITY_SESSION: MOCK_EQUITY_SESSION,
}));

vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn((profile: string) =>
        profile === 'crypto' ? MOCK_CRYPTO_SESSION : MOCK_EQUITY_SESSION
    ),
}));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: vi.fn(),
    buildGateError: vi.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn(() => mockProvider),
}));

vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us-equity'),
}));

import { headers } from 'next/headers';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import type { AnalysisGateError } from '@/shared/lib/types';
import { submitAnalysisAction } from '../actions/submitAnalysisAction';
import {
    submitAnalysis,
    CRYPTO_SESSION,
    US_EQUITY_SESSION,
    type ModelId,
    type SubmitAnalysisGatedResult,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';

const mockProvider = {} as import('@y0ngha/siglens-core').MarketDataProvider;

const mockHeaders = headers as MockedFunction<typeof headers>;

const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;
const mockSubmitAnalysis = submitAnalysis as MockedFunction<
    typeof submitAnalysis
>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockGetCachedMarketDataProvider =
    getCachedMarketDataProvider as MockedFunction<
        typeof getCachedMarketDataProvider
    >;
const mockResolveMarketProfile = resolveMarketProfile as MockedFunction<
    typeof resolveMarketProfile
>;

const cachedResult: SubmitAnalysisGatedResult = {
    status: 'cached',
    result: { summary: 'cached' } as never,
};

const FREE_MODEL = 'gemini-2.5-flash-lite' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

describe('submitAnalysisAction tier + BYOK gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitAnalysis.mockResolvedValue(cachedResult);
        mockGetCurrentUser.mockResolvedValue(null);
    });

    it('returns blocked result when gate.kind === "blocked"', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'blocked',
            error: gateError,
        });

        const result = await submitAnalysisAction(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            PREMIUM_MODEL
        );

        expect(result).toEqual({ status: 'error', error: gateError });
        expect(mockSubmitAnalysis).not.toHaveBeenCalled();
    });

    it('forwards tierContext to siglens-core when modelId is set', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await submitAnalysisAction(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            FREE_MODEL
        );

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            expect.objectContaining({
                tierContext: { userId: 'u1', tier: 'member' },
                marketDataProvider: mockProvider,
            })
        );
    });

    it('forwards userApiKey when present in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
            userApiKey: 'usr-key',
        });

        await submitAnalysisAction(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            PREMIUM_MODEL
        );

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            expect.objectContaining({ userApiKey: 'usr-key' })
        );
    });

    it('omits userApiKey when not in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'pro' as never,
            // no userApiKey
        });

        await submitAnalysisAction(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            PREMIUM_MODEL
        );

        const lastCall = mockSubmitAnalysis.mock.calls.at(-1);
        expect(lastCall).toBeDefined();
        const opts = lastCall![5] as Record<string, unknown>;
        expect(opts).not.toHaveProperty('userApiKey');
    });

    it('bypasses gate and uses default model when modelId is undefined', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        await submitAnalysisAction('AAPL', 'Apple', '1Day', true, '^AAPL');

        expect(mockResolveTierAndByok).not.toHaveBeenCalled();
        expect(mockSubmitAnalysis).toHaveBeenCalledTimes(1);
        const lastCall = mockSubmitAnalysis.mock.calls.at(-1);
        const opts = lastCall![5] as Record<string, unknown>;
        expect(opts).not.toHaveProperty('tierContext');
        expect(opts).not.toHaveProperty('userApiKey');
        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            '1Day',
            true,
            '^AAPL',
            expect.objectContaining({ marketDataProvider: mockProvider })
        );
    });

    it('passes null userId when getCurrentUser returns null', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });

        await submitAnalysisAction(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            FREE_MODEL
        );

        expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, FREE_MODEL);
        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            expect.objectContaining({
                tierContext: { userId: null, tier: 'free' },
            })
        );
    });

    it('passes skipEnqueueIfMiss: true to siglens-core when request UA is a bot', async () => {
        mockHeaders.mockResolvedValueOnce(
            new Headers({
                'user-agent':
                    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            })
        );
        mockGetCurrentUser.mockResolvedValue(null);

        await submitAnalysisAction('AAPL', 'Apple', '1Day', false, '^AAPL');

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it('passes skipEnqueueIfMiss: false to siglens-core when request UA is not a bot', async () => {
        // default mock returns an empty Headers → isBot resolves to false.
        mockGetCurrentUser.mockResolvedValue(null);

        await submitAnalysisAction('AAPL', 'Apple', '1Day', false, '^AAPL');

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    it('returns unexpected_error result when an unexpected error is thrown', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockRejectedValue(
            new Error('db connection failed')
        );

        const result = await submitAnalysisAction(
            'AAPL',
            'Apple',
            '1Day',
            false,
            '^AAPL',
            FREE_MODEL
        );

        expect(result).toMatchObject({
            status: 'error',
            error: expect.objectContaining({ code: 'unexpected_error' }),
        });
    });

    describe('crypto symbol — session spec routing', () => {
        it('resolveMarketProfile가 "crypto"이면 getCachedMarketDataProvider를 CRYPTO_SESSION으로 호출한다', async () => {
            mockResolveMarketProfile.mockResolvedValueOnce('crypto');
            mockSubmitAnalysis.mockResolvedValueOnce(cachedResult);

            await submitAnalysisAction('BTCUSD', 'Bitcoin', '1Day', false);

            expect(mockGetCachedMarketDataProvider).toHaveBeenCalledWith(
                CRYPTO_SESSION
            );
        });

        it('resolveMarketProfile가 "us-equity"이면 getCachedMarketDataProvider를 US_EQUITY_SESSION으로 호출한다', async () => {
            mockResolveMarketProfile.mockResolvedValueOnce('us-equity');
            mockSubmitAnalysis.mockResolvedValueOnce(cachedResult);

            await submitAnalysisAction('AAPL', 'Apple', '1Day', false);

            expect(mockGetCachedMarketDataProvider).toHaveBeenCalledWith(
                US_EQUITY_SESSION
            );
        });
    });

    describe('assetClass forwarding', () => {
        it('resolveMarketProfile가 "crypto"이면 submitAnalysis를 assetClass: "crypto"로 호출한다', async () => {
            mockResolveMarketProfile.mockResolvedValueOnce('crypto');
            mockSubmitAnalysis.mockResolvedValueOnce(cachedResult);

            await submitAnalysisAction('BTCUSD', 'Bitcoin', '1Day', false);

            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'BTCUSD',
                'Bitcoin',
                '1Day',
                false,
                undefined,
                expect.objectContaining({ assetClass: 'crypto' })
            );
        });

        it('resolveMarketProfile가 "us-equity"이면 submitAnalysis를 assetClass: "equity"로 호출한다', async () => {
            mockResolveMarketProfile.mockResolvedValueOnce('us-equity');
            mockSubmitAnalysis.mockResolvedValueOnce(cachedResult);

            await submitAnalysisAction('AAPL', 'Apple', '1Day', false);

            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                undefined,
                expect.objectContaining({ assetClass: 'equity' })
            );
        });
    });
});
