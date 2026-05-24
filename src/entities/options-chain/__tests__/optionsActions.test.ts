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
    cancelJob: jest.fn(),
}));

jest.mock('../lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: jest.fn(),
}));

jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: jest.fn(),
}));

jest.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: jest.fn(),
    buildGateError: jest.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

import {
    submitOptionsAnalysis,
    pollOptionsAnalysis,
    cancelJob,
    type ModelId,
    type SubmitOptionsAnalysisResult,
    type OptionsSnapshot,
    type OptionsChain,
} from '@y0ngha/siglens-core';
import { fetchOptionsSnapshot } from '../lib/optionsDataCache';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import type { AnalysisGateError } from '@/domain/types';
import {
    submitOptionsAnalysisAction,
    pollOptionsAnalysisAction,
    cancelOptionsAnalysisJobAction,
} from '../actions/optionsActions';

const mockSubmitOptionsAnalysis = submitOptionsAnalysis as jest.MockedFunction<
    typeof submitOptionsAnalysis
>;
const mockPollOptionsAnalysis = pollOptionsAnalysis as jest.MockedFunction<
    typeof pollOptionsAnalysis
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
const mockCancelJob = cancelJob as jest.MockedFunction<typeof cancelJob>;

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

const SUBMITTED_RESULT: SubmitOptionsAnalysisResult = {
    status: 'submitted',
    jobId: 'job-options-001',
};

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

    it('returns unexpected_error and logs when pollOptionsAnalysis throws', async () => {
        const consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const pollError = new Error('queue down');
        mockPollOptionsAnalysis.mockRejectedValueOnce(pollError);

        const result = await pollOptionsAnalysisAction('job-err');

        expect(result).toEqual({
            status: 'error',
            error: 'unexpected_error',
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[pollOptionsAnalysisAction] poll failed:',
            'job-err',
            pollError
        );

        consoleErrorSpy.mockRestore();
    });
});

describe('cancelOptionsAnalysisJobAction', () => {
    beforeEach(() => {
        mockCancelJob.mockReset();
    });

    it('delegates to cancelJob and resolves to undefined on success', async () => {
        mockCancelJob.mockResolvedValueOnce(undefined);

        const result = await cancelOptionsAnalysisJobAction('job-cancel-001');

        expect(mockCancelJob).toHaveBeenCalledWith('job-cancel-001');
        expect(result).toBeUndefined();
    });

    it('swallows errors and logs a warning when cancelJob rejects', async () => {
        const consoleWarnSpy = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => {});
        const cancelError = new Error('worker unreachable');
        mockCancelJob.mockRejectedValueOnce(cancelError);

        await expect(
            cancelOptionsAnalysisJobAction('job-cancel-err')
        ).resolves.toBeUndefined();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            '[cancelOptionsAnalysisJobAction] 취소 신호 전송 실패:',
            'job-cancel-err',
            cancelError
        );

        consoleWarnSpy.mockRestore();
    });
});
