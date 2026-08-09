// vi.mock → imports 순서 (MISTAKES.md Tests §17)
vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
    cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined) })),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    runFinancialsAnalysis: vi.fn(),
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

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: vi.fn(),
    resolveReasoning: vi.fn(
        (tier: string, clientReasoning?: boolean) =>
            tier !== 'free' && clientReasoning === true
    ),
    buildGateError: vi.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

import type { MockedFunction } from 'vitest';
import { headers } from 'next/headers';
import {
    runFinancialsAnalysis,
    type ModelId,
    type RunFinancialsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import type { AnalysisGateError } from '@/shared/lib/types';
import { runFinancialsAnalysisAction } from '../actions/runFinancialsAnalysisAction';

const mockHeaders = headers as MockedFunction<typeof headers>;
const mockRunFinancialsAnalysis = runFinancialsAnalysis as MockedFunction<
    typeof runFinancialsAnalysis
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

const CACHED_RESULT: RunFinancialsAnalysisResult = {
    status: 'cached',
    result: { axisAssessments: [] } as never,
};

const DONE_RESULT: RunFinancialsAnalysisResult = {
    status: 'done',
    result: { axisAssessments: [] } as never,
};

const MODEL_ID = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

describe('runFinancialsAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockRunFinancialsAnalysis.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();
        mockGetFinancialStatementsProvider.mockReset();
        mockGetFinancialStatementsProvider.mockReturnValue({} as never);

        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
        mockRunFinancialsAnalysis.mockResolvedValue(DONE_RESULT);
    });

    it('siglens-core runFinancialsAnalysis에 symbol과 modelId를 전달한다', async () => {
        mockRunFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                modelId: MODEL_ID,
            })
        );
    });

    it('getFinancialStatementsProvider 인스턴스를 dataProvider로 전달한다', async () => {
        mockRunFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFinancialsAnalysisAction('TSLA', MODEL_ID);

        const call = mockRunFinancialsAnalysis.mock.calls[0]?.[0];
        expect(call?.dataProvider).toBeDefined();
        expect(mockGetFinancialStatementsProvider).toHaveBeenCalled();
    });

    it('underlying 함수의 cached 결과를 그대로 반환한다', async () => {
        mockRunFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        const result = await runFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(result).toBe(CACHED_RESULT);
    });

    it('underlying 함수의 done 결과를 그대로 반환한다', async () => {
        mockRunFinancialsAnalysis.mockResolvedValueOnce(DONE_RESULT);

        const result = await runFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(result).toBe(DONE_RESULT);
    });

    it('returns blocked result when gate.kind === "blocked"', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'blocked',
            error: gateError,
        });

        const result = await runFinancialsAnalysisAction('AAPL', PREMIUM_MODEL);

        expect(result).toEqual({ status: 'error', error: gateError });
        // Gate fires before expensive provider fetch
        expect(mockRunFinancialsAnalysis).not.toHaveBeenCalled();
    });

    it('forwards tier="member" to siglens-core when gate allowed', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await runFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith(
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

        await runFinancialsAnalysisAction('AAPL', PREMIUM_MODEL);

        expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith(
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

        await runFinancialsAnalysisAction('AAPL', PREMIUM_MODEL);

        const callArg = mockRunFinancialsAnalysis.mock.calls[0]?.[0];
        expect(callArg).toBeDefined();
        expect(callArg).not.toHaveProperty('userApiKey');
    });

    it('passes null userId when getCurrentUser returns null', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });

        await runFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
    });

    it('returns unexpected_error result when an unexpected error is thrown', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockRejectedValue(
            new Error('db connection failed')
        );

        const result = await runFinancialsAnalysisAction('AAPL', MODEL_ID);

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
        mockRunFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it('passes skipEnqueueIfMiss: false to siglens-core when request UA is not a bot', async () => {
        mockRunFinancialsAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFinancialsAnalysisAction('AAPL', MODEL_ID);

        expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    describe('reasoning forwarding', () => {
        it('forwards reasoning: true for member tier when client requests it', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });

            await runFinancialsAnalysisAction('AAPL', MODEL_ID, true);

            expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: true })
            );
        });

        it('forces reasoning: false for free tier even when client requests true', async () => {
            await runFinancialsAnalysisAction('AAPL', MODEL_ID, true);

            expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });

        it('defaults reasoning to false when omitted', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });

            await runFinancialsAnalysisAction('AAPL', MODEL_ID);

            expect(mockRunFinancialsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });
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

            const result = await runFinancialsAnalysisAction('AAPL', MODEL_ID);

            expect(result).toEqual(e2eFixture);
            expect(mockRunFinancialsAnalysis).not.toHaveBeenCalled();
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
