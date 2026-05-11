jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

jest.mock('next/headers', () => ({
    headers: jest.fn(() => Promise.resolve(new Headers())),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    submitAnalysis: jest.fn(),
}));

jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: jest.fn(),
}));

jest.mock('@/infrastructure/market/byokGate', () => ({
    resolveTierAndByok: jest.fn(),
    buildGateError: jest.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

import { headers } from 'next/headers';
import { resolveTierAndByok } from '@/infrastructure/market/byokGate';
import type { AnalysisGateError } from '@/domain/types';
import { submitAnalysisAction } from '@/infrastructure/market/submitAnalysisAction';
import {
    submitAnalysis,
    type ModelId,
    type SubmitAnalysisGatedResult,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';

const mockHeaders = headers as jest.MockedFunction<typeof headers>;

const mockResolveTierAndByok = resolveTierAndByok as jest.MockedFunction<
    typeof resolveTierAndByok
>;
const mockSubmitAnalysis = submitAnalysis as jest.MockedFunction<
    typeof submitAnalysis
>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
    typeof getCurrentUser
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
        jest.clearAllMocks();
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
});
