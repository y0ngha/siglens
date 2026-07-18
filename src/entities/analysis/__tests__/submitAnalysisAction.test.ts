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

// Faithful in-line reimplementation of the real gate (real impl is bypassed —
// this test file mocks the whole module) so tests can assert realistic
// bucket derivations (e.g. a 10% gain → 'profit') without importing core.
function fakeBucketize(avgPrice: number, currentPrice: number): string | null {
    if (
        !Number.isFinite(avgPrice) ||
        !Number.isFinite(currentPrice) ||
        avgPrice <= 0 ||
        currentPrice <= 0
    ) {
        return null;
    }
    const r = (currentPrice - avgPrice) / avgPrice;
    if (r >= 0.2) return 'deep-profit';
    if (r >= 0.05) return 'profit';
    if (r > -0.05) return 'near-breakeven';
    if (r > -0.2) return 'loss';
    return 'deep-loss';
}

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: vi.fn(),
    resolveTierOnly: vi.fn(),
    resolveReasoning: vi.fn(
        (tier: string, clientReasoning?: boolean) =>
            tier !== 'free' && clientReasoning === true
    ),
    resolvePositionBucket: vi.fn(
        (
            tier: string,
            avgPrice: number | null,
            currentPrice: number | null
        ) => {
            if (tier === 'free' || avgPrice === null || currentPrice === null) {
                return undefined;
            }
            return fakeBucketize(avgPrice, currentPrice) ?? undefined;
        }
    ),
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

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

const { mockFindByUserAndSymbol } = vi.hoisted(() => ({
    mockFindByUserAndSymbol: vi.fn(),
}));

vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return { findByUserAndSymbol: mockFindByUserAndSymbol };
    }),
}));

import { headers } from 'next/headers';
import { resolveTierAndByok, resolveTierOnly } from '@/shared/lib/byokGate';
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

const mockGetQuote = vi.fn();
const mockProvider = {
    getQuote: mockGetQuote,
} as unknown as import('@y0ngha/siglens-core').MarketDataProvider;

const mockHeaders = headers as MockedFunction<typeof headers>;

const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;
const mockResolveTierOnly = resolveTierOnly as MockedFunction<
    typeof resolveTierOnly
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
    lockedInfoDepth: [],
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
        mockResolveTierOnly.mockResolvedValue('free');
        // Default: no holding, no quote — most tests are unrelated to
        // personalization and should see positionBucket stay undefined.
        mockFindByUserAndSymbol.mockResolvedValue(null);
        mockGetQuote.mockResolvedValue(null);
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

    it('resolves and forwards tier context when modelId is undefined', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        await submitAnalysisAction('AAPL', 'Apple', '1Day', true, '^AAPL');

        expect(mockResolveTierAndByok).not.toHaveBeenCalled();
        expect(mockResolveTierOnly).toHaveBeenCalledWith(null);
        expect(mockSubmitAnalysis).toHaveBeenCalledTimes(1);
        const lastCall = mockSubmitAnalysis.mock.calls.at(-1);
        const opts = lastCall![5] as Record<string, unknown>;
        expect(opts).toMatchObject({
            tierContext: { userId: null, tier: 'free' },
            reasoning: false,
        });
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

    describe('reasoning forwarding', () => {
        it('forwards reasoning: true for member tier when client requests it', async () => {
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
                FREE_MODEL,
                true
            );

            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL',
                expect.objectContaining({ reasoning: true })
            );
        });

        it('forces reasoning: false for free tier even when client requests true', async () => {
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
                FREE_MODEL,
                true
            );

            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL',
                expect.objectContaining({ reasoning: false })
            );
        });

        it('defaults reasoning to false for member tier when client omits it', async () => {
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
                expect.objectContaining({ reasoning: false })
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

    describe('positionBucket personalization (personalized-analysis-by-position-bucket spec, Subsystem C)', () => {
        it('member with a profitable holding → submitAnalysis called with positionBucket: "profit"', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('member');
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            mockGetQuote.mockResolvedValue({ price: 110 });

            await submitAnalysisAction('AAPL', 'Apple', '1Day', false, '^AAPL');

            expect(mockFindByUserAndSymbol).toHaveBeenCalledWith('u1', 'AAPL');
            expect(mockGetQuote).toHaveBeenCalledWith('^AAPL');
            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL',
                expect.objectContaining({ positionBucket: 'profit' })
            );
        });

        it('free tier → no bucket, and never reads the holding/quote', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('free');

            await submitAnalysisAction('AAPL', 'Apple', '1Day', false, '^AAPL');

            expect(mockFindByUserAndSymbol).not.toHaveBeenCalled();
            expect(mockGetQuote).not.toHaveBeenCalled();
            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL',
                expect.objectContaining({ positionBucket: undefined })
            );
        });

        it('no holding → no bucket, and skips the price read entirely', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('member');
            mockFindByUserAndSymbol.mockResolvedValue(null);

            await submitAnalysisAction('AAPL', 'Apple', '1Day', false, '^AAPL');

            expect(mockFindByUserAndSymbol).toHaveBeenCalledWith('u1', 'AAPL');
            expect(mockGetQuote).not.toHaveBeenCalled();
            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL',
                expect.objectContaining({ positionBucket: undefined })
            );
        });

        it('price-read failure → no bucket, and the analysis still submits', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('member');
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            mockGetQuote.mockRejectedValue(new Error('quote fetch failed'));

            const result = await submitAnalysisAction(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL'
            );

            expect(result).toEqual({ ...cachedResult, personalized: false });
            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL',
                expect.objectContaining({ positionBucket: undefined })
            );
        });

        it('holding-read failure (DB error) → no bucket, and the analysis still submits', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('member');
            mockFindByUserAndSymbol.mockRejectedValue(new Error('db down'));

            const result = await submitAnalysisAction(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL'
            );

            expect(result).toEqual({ ...cachedResult, personalized: false });
            expect(mockGetQuote).not.toHaveBeenCalled();
            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL',
                expect.objectContaining({ positionBucket: undefined })
            );
        });

        it('anonymous caller (no userId) → no bucket, and never reads the holding', async () => {
            mockGetCurrentUser.mockResolvedValue(null);
            mockResolveTierOnly.mockResolvedValue('free');

            await submitAnalysisAction('AAPL', 'Apple', '1Day', false, '^AAPL');

            expect(mockFindByUserAndSymbol).not.toHaveBeenCalled();
            expect(mockSubmitAnalysis).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL',
                expect.objectContaining({ positionBucket: undefined })
            );
        });
    });

    // The `personalized` flag threaded on the action's return (server-authoritative
    // signal for the AnalysisPanel badge, personalized-analysis-by-position-bucket
    // spec Subsystem C — badge-honesty fix). It must be `true` exactly when
    // `positionBucket !== undefined`, NOT merely when a holding exists — a holding
    // can still degrade to no-bucket (quote failure, degenerate avg, free tier).
    describe('personalized flag (badge-honesty fix)', () => {
        it('member with a derivable bucket → personalized: true', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('member');
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            mockGetQuote.mockResolvedValue({ price: 110 });

            const result = await submitAnalysisAction(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL'
            );

            expect(result).toEqual({ ...cachedResult, personalized: true });
        });

        it('free tier → personalized: false even though the shared analysis is cached', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('free');

            const result = await submitAnalysisAction(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL'
            );

            expect(result).toEqual({ ...cachedResult, personalized: false });
        });

        it('no holding → personalized: false', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('member');
            mockFindByUserAndSymbol.mockResolvedValue(null);

            const result = await submitAnalysisAction(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL'
            );

            expect(result).toEqual({ ...cachedResult, personalized: false });
        });

        it('quote-degrade path (holding exists but price read fails) → personalized: false, NOT true just because a holding exists', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('member');
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            mockGetQuote.mockRejectedValue(new Error('quote fetch failed'));

            const result = await submitAnalysisAction(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL'
            );

            expect(result).toEqual({ ...cachedResult, personalized: false });
        });

        it('gated (modelId set) branch also threads personalized: true when a bucket is derived', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            mockGetQuote.mockResolvedValue({ price: 110 });

            const result = await submitAnalysisAction(
                'AAPL',
                'Apple',
                '1Day',
                false,
                '^AAPL',
                FREE_MODEL
            );

            expect(result).toEqual({ ...cachedResult, personalized: true });
        });
    });
});
