jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

jest.mock('next/headers', () => ({
    headers: jest.fn(() => Promise.resolve(new Headers())),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitOptionsAnalysis: jest.fn(),
    pollOptionsAnalysis: jest.fn(),
    summarizeChainForLlm: jest.fn(),
    cancelJob: jest.fn(),
}));

jest.mock('@/infrastructure/options/optionsDataCache', () => ({
    fetchOptionsSnapshot: jest.fn(),
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

import {
    submitOptionsAnalysis,
    pollOptionsAnalysis,
    summarizeChainForLlm,
    type ModelId,
    type SubmitOptionsAnalysisResult,
    type OptionsSnapshot,
    type OptionsChain,
    type OptionsExpirationMetrics,
} from '@y0ngha/siglens-core';
import { fetchOptionsSnapshot } from '@/infrastructure/options/optionsDataCache';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { resolveTierAndByok } from '@/infrastructure/market/byokGate';
import type { AnalysisGateError } from '@/domain/types';
import {
    submitOptionsAnalysisAction,
    pollOptionsAnalysisAction,
    getOptionsSignalsAction,
} from '@/infrastructure/options/optionsActions';

const mockSubmitOptionsAnalysis = submitOptionsAnalysis as jest.MockedFunction<
    typeof submitOptionsAnalysis
>;
const mockPollOptionsAnalysis = pollOptionsAnalysis as jest.MockedFunction<
    typeof pollOptionsAnalysis
>;
const mockSummarizeChainForLlm = summarizeChainForLlm as jest.MockedFunction<
    typeof summarizeChainForLlm
>;
const mockFetchOptionsSnapshot = fetchOptionsSnapshot as jest.MockedFunction<
    typeof fetchOptionsSnapshot
>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as jest.MockedFunction<
    typeof resolveTierAndByok
>;

const MODEL_ID = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

const MOCK_CHAIN: OptionsChain = {
    expirationDate: '2026-06-20',
    daysToExpiration: 37,
    calls: [],
    puts: [],
};

const MOCK_SNAPSHOT: OptionsSnapshot = {
    symbol: 'AAPL',
    underlyingPrice: 192.5,
    capturedAt: '2026-05-14T00:00:00Z',
    chains: [MOCK_CHAIN],
};

const MOCK_METRICS: OptionsExpirationMetrics = {
    expirationDate: '2026-06-20',
    maxPain: 190,
    putCallRatio: 0.85,
    atmImpliedVolatility: 0.32,
    topOpenInterestStrikes: [],
    impliedMovePercent: null,
};

const SUBMITTED_RESULT: SubmitOptionsAnalysisResult = {
    status: 'submitted',
    jobId: 'job-options-001',
};

describe('getOptionsSignalsAction', () => {
    it('returns signals for the nearest expiration', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(MOCK_SNAPSHOT);
        mockSummarizeChainForLlm.mockReturnValueOnce(MOCK_METRICS);

        const result = await getOptionsSignalsAction('AAPL');

        expect(result).toEqual({
            atmIv: 0.32,
            putCallRatio: 0.85,
            maxPain: 190,
            expirationDate: '2026-06-20',
        });
    });

    it('returns null when snapshot is null', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(null);
        const result = await getOptionsSignalsAction('AAPL');
        expect(result).toBeNull();
    });

    it('returns null when snapshot has no chains', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce({
            ...MOCK_SNAPSHOT,
            chains: [],
        });
        const result = await getOptionsSignalsAction('AAPL');
        expect(result).toBeNull();
    });

    it('passes through null maxPain/putCallRatio from siglens-core R12', async () => {
        // siglens-core R12 (commit 40ad290) widened both to `number | null`.
        // Verify the action forwards null without coercing to NaN.
        mockFetchOptionsSnapshot.mockResolvedValueOnce(MOCK_SNAPSHOT);
        mockSummarizeChainForLlm.mockReturnValueOnce({
            ...MOCK_METRICS,
            maxPain: null,
            putCallRatio: null,
        });

        const result = await getOptionsSignalsAction('AAPL');

        expect(result).toEqual({
            atmIv: 0.32,
            putCallRatio: null,
            maxPain: null,
            expirationDate: '2026-06-20',
        });
    });
});

describe('submitOptionsAnalysisAction', () => {
    beforeEach(() => {
        mockSubmitOptionsAnalysis.mockReset();
        mockFetchOptionsSnapshot.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();

        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
        mockFetchOptionsSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
        mockSubmitOptionsAnalysis.mockResolvedValue(SUBMITTED_RESULT);
    });

    it('forwards symbol, companyName, expirationDate, and modelId to siglens-core', async () => {
        await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        expect(mockSubmitOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                expirationDate: 'all',
                modelId: MODEL_ID,
                snapshot: MOCK_SNAPSHOT,
            })
        );
    });

    it('returns no_options_chains error when snapshot is null', async () => {
        mockFetchOptionsSnapshot.mockResolvedValueOnce(null);

        const result = await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        expect(result).toMatchObject({
            status: 'no_chains_error',
            code: 'no_options_chains',
        });
        expect(mockSubmitOptionsAnalysis).not.toHaveBeenCalled();
    });

    it('returns blocked result when gate.kind === "blocked"', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'blocked',
            error: gateError,
        });

        const result = await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            PREMIUM_MODEL
        );

        expect(result).toEqual({ status: 'error', error: gateError });
        expect(mockSubmitOptionsAnalysis).not.toHaveBeenCalled();
    });

    it('forwards tier to siglens-core when gate allowed', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            '2026-06-20',
            MODEL_ID
        );

        expect(mockSubmitOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ tier: 'member' })
        );
    });

    it('forwards userApiKey when present in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
            userApiKey: 'usr-key',
        });

        await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            PREMIUM_MODEL
        );

        expect(mockSubmitOptionsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ userApiKey: 'usr-key' })
        );
    });

    it('omits userApiKey when not in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'pro' as never,
        });

        await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        const callArg = mockSubmitOptionsAnalysis.mock.calls[0]?.[0];
        expect(callArg).toBeDefined();
        expect(callArg).not.toHaveProperty('userApiKey');
    });

    it('returns unexpected_error result when an unexpected error is thrown', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockRejectedValue(
            new Error('db connection failed')
        );

        const result = await submitOptionsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            'all',
            MODEL_ID
        );

        expect(result).toMatchObject({
            status: 'error',
            error: expect.objectContaining({ code: 'unexpected_error' }),
        });
    });
});

describe('pollOptionsAnalysisAction', () => {
    it('delegates to pollOptionsAnalysis and returns result', async () => {
        const polledResult = { status: 'processing' as const };
        mockPollOptionsAnalysis.mockResolvedValueOnce(polledResult);

        const result = await pollOptionsAnalysisAction('job-001');

        expect(mockPollOptionsAnalysis).toHaveBeenCalledWith('job-001');
        expect(result).toBe(polledResult);
    });
});
