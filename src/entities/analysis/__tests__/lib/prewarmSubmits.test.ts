import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { MOCK_CRYPTO_SESSION, MOCK_EQUITY_SESSION } = vi.hoisted(() => ({
    MOCK_CRYPTO_SESSION: { type: 'crypto' } as never,
    MOCK_EQUITY_SESSION: { type: 'equity' } as never,
}));

vi.mock('@y0ngha/siglens-core', () => ({
    submitAnalysis: vi.fn(),
}));

vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn((profile: string) =>
        profile === 'crypto' ? MOCK_CRYPTO_SESSION : MOCK_EQUITY_SESSION
    ),
}));

vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn(() => mockProvider),
}));

vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us-equity'),
}));

import {
    submitAnalysis,
    type SubmitAnalysisGatedResult,
} from '@y0ngha/siglens-core';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { prewarmTechnical } from '../../lib/prewarmSubmits';

const mockProvider = {
    getQuote: vi.fn(),
} as unknown as import('@y0ngha/siglens-core').MarketDataProvider;

const mockSubmitAnalysis = vi.mocked(submitAnalysis);
const mockGetCachedMarketDataProvider = vi.mocked(getCachedMarketDataProvider);
const mockResolveMarketProfile = vi.mocked(resolveMarketProfile);

const cachedResult: SubmitAnalysisGatedResult = {
    status: 'cached',
    result: { summary: 'cached' } as never,
    lockedInfoDepth: [],
};

describe('prewarmTechnical', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitAnalysis.mockResolvedValue(cachedResult);
        mockResolveMarketProfile.mockResolvedValue('us-equity');
        mockGetCachedMarketDataProvider.mockReturnValue(mockProvider);
    });

    it('calls submitAnalysis with the anonymous-free branch shape (skipEnqueueIfMiss:false, tier:free, reasoning:false, no bucket)', async () => {
        await prewarmTechnical('AAPL', 'Apple Inc.', undefined, false);

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            '1Day',
            false,
            undefined,
            {
                skipEnqueueIfMiss: false,
                marketDataProvider: mockProvider,
                assetClass: 'equity',
                tierContext: { userId: null, tier: 'free' },
                reasoning: false,
                positionBucket: undefined,
            }
        );
    });

    it('threads force=true as the 4th positional arg', async () => {
        await prewarmTechnical('AAPL', 'Apple Inc.', undefined, true);

        const lastCall = mockSubmitAnalysis.mock.calls.at(-1);
        expect(lastCall).toBeDefined();
        expect(lastCall![3]).toBe(true);
    });

    it('forwards fmpSymbol through to submitAnalysis', async () => {
        await prewarmTechnical('BTCUSD', 'Bitcoin', '^BTCUSD', false);

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'BTCUSD',
            'Bitcoin',
            '1Day',
            false,
            '^BTCUSD',
            expect.objectContaining({ marketDataProvider: mockProvider })
        );
    });

    it('static guard: the seam source contains no request-context calls', () => {
        const src = readFileSync(
            fileURLToPath(
                new URL('../../lib/prewarmSubmits.ts', import.meta.url)
            ),
            'utf8'
        );
        expect(src).not.toMatch(/next\/headers|getCurrentUser|isBot|cookies/);
    });
});
