import type { MockedFunction } from 'vitest';
vi.mock('@vercel/functions', () => ({
    waitUntil: vi.fn(),
}));

vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
    cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined) })),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    submitFinancialsAnalysis: vi.fn(),
}));

vi.mock('@/shared/api/fmp/getFinancialStatementsProvider', () => ({
    getFinancialStatementsProvider: vi.fn(() => ({})),
}));

vi.mock('@/shared/api/e2eAnalysisStub', () => ({
    e2eCachedFinancials: vi.fn(() => ({ status: 'cached', result: {} })),
    e2eForcedFinancialsError: vi.fn(() => ({
        status: 'error',
        code: 'fetch_failed',
        error: 'E2E forced error',
    })),
    E2E_FORCE_FINANCIALS_ERROR_COOKIE: 'e2e_force_financials_error',
}));

vi.mock('@/entities/session/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: vi.fn(),
    buildGateError: vi.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

import { headers } from 'next/headers';
import {
    submitFinancialsAnalysis,
    type ModelId,
    type SubmitFinancialsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import type { AnalysisGateError } from '@/shared/lib/types';
import { submitFinancialsAnalysisAction } from '../actions/submitFinancialsAnalysisAction';

const mockHeaders = headers as MockedFunction<typeof headers>;
const mockSubmitFinancialsAnalysis = submitFinancialsAnalysis as MockedFunction<
    typeof submitFinancialsAnalysis
>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;
const mockGetFinancialStatementsProvider =
    getFinancialStatementsProvider as MockedFunction<
        typeof getFinancialStatementsProvider
    >;

const CACHED_RESULT: SubmitFinancialsAnalysisResult = {
    status: 'cached',
    result: { axisAssessments: [] } as never,
};

const SUBMITTED_RESULT: SubmitFinancialsAnalysisResult = {
    status: 'submitted',
    jobId: 'job-financials-001',
};

const MODEL_ID = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

describe('submitFinancialsAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockSubmitFinancialsAnalysis.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();
        mockGetFinancialStatementsProvider.mockReset();
        mockGetFinancialStatementsProvider.mockReturnValue({} as never);

        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
        mockSubmitFinancialsAnalysis.mockResolvedValue(SUBMITTED_RESULT);
    });

    it('siglens-core submitFinancialsAnalysis에 symbol과 modelId를 전달한다', async () => {
        mockSubmitFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await submitFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockSubmitFinancialsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                modelId: MODEL_ID,
            })
        );
    });

    it('getFinancialStatementsProvider 인스턴스를 dataProvider로 전달한다', async () => {
        mockSubmitFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await submitFinancialsAnalysisAction('TSLA', MODEL_ID);

        const call = mockSubmitFinancialsAnalysis.mock.calls[0]?.[0];
        expect(call?.dataProvider).toBeDefined();
        expect(mockGetFinancialStatementsProvider).toHaveBeenCalled();
    });

    it('underlying 함수의 cached 결과를 그대로 반환한다', async () => {
        mockSubmitFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        const result = await submitFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(result).toBe(CACHED_RESULT);
    });

    it('underlying 함수의 submitted 결과를 그대로 반환한다', async () => {
        mockSubmitFinancialsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        const result = await submitFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(result).toBe(SUBMITTED_RESULT);
    });

    it('returns blocked result when gate.kind === "blocked"', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'blocked',
            error: gateError,
        });

        const result = await submitFinancialsAnalysisAction(
            'AAPL',
            PREMIUM_MODEL
        );

        expect(result).toEqual({ status: 'error', error: gateError });
        // Gate fires before expensive provider fetch
        expect(mockSubmitFinancialsAnalysis).not.toHaveBeenCalled();
    });

    it('forwards tier="member" to siglens-core when gate allowed', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await submitFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockSubmitFinancialsAnalysis).toHaveBeenCalledWith(
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

        await submitFinancialsAnalysisAction('AAPL', PREMIUM_MODEL);

        expect(mockSubmitFinancialsAnalysis).toHaveBeenCalledWith(
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

        await submitFinancialsAnalysisAction('AAPL', PREMIUM_MODEL);

        const callArg = mockSubmitFinancialsAnalysis.mock.calls[0]?.[0];
        expect(callArg).toBeDefined();
        expect(callArg).not.toHaveProperty('userApiKey');
    });

    it('passes null userId when getCurrentUser returns null', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });

        await submitFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
    });

    it('returns unexpected_error result when an unexpected error is thrown', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockRejectedValue(
            new Error('db connection failed')
        );

        const result = await submitFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(result).toMatchObject({
            status: 'error',
            error: expect.objectContaining({ code: 'unexpected_error' }),
        });
    });

    it('passes skipEnqueueIfMiss: true to siglens-core when request UA is a bot', async () => {
        mockHeaders.mockResolvedValueOnce(
            new Headers({
                'user-agent':
                    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            })
        );
        mockSubmitFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await submitFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockSubmitFinancialsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it('passes skipEnqueueIfMiss: false to siglens-core when request UA is not a bot', async () => {
        mockSubmitFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await submitFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockSubmitFinancialsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    it('E2E 모드에서 e2eCachedFinancials를 반환하고 provider를 호출하지 않는다', async () => {
        const originalE2E = process.env.E2E_TEST;
        process.env.E2E_TEST = '1';
        try {
            const { e2eCachedFinancials } =
                await import('@/shared/api/e2eAnalysisStub');
            const mockE2ECached = e2eCachedFinancials as MockedFunction<
                typeof e2eCachedFinancials
            >;
            const e2eFixture = {
                status: 'cached' as const,
                result: {} as never,
            };
            mockE2ECached.mockReturnValueOnce(e2eFixture);

            const result = await submitFinancialsAnalysisAction(
                'AAPL',
                MODEL_ID
            );

            expect(result).toEqual(e2eFixture);
            expect(mockSubmitFinancialsAnalysis).not.toHaveBeenCalled();
            expect(mockGetFinancialStatementsProvider).not.toHaveBeenCalled();
        } finally {
            if (originalE2E === undefined) {
                delete process.env.E2E_TEST;
            } else {
                process.env.E2E_TEST = originalE2E;
            }
        }
    });
});
