// vi.mock → imports 순서 (MISTAKES.md Tests §17)
vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
    cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined) })),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    runCongressTrend: vi.fn(),
}));

vi.mock('@/shared/api/fmp/getCongressTradesProvider', () => ({
    getCongressTradesProvider: vi.fn(() => ({})),
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

vi.mock('@/shared/api/e2eAnalysisStub', () => ({
    e2eCachedCongressTrend: vi.fn(() => ({ status: 'cached', result: {} })),
    e2eForcedCongressError: vi.fn(() => ({
        status: 'error',
        code: 'fetch_failed',
        error: 'E2E forced congress error',
    })),
    E2E_FORCE_CONGRESS_ERROR_COOKIE: 'e2e_force_congress_error',
}));

import type { MockedFunction } from 'vitest';
import { headers } from 'next/headers';
import {
    runCongressTrend,
    type ModelId,
    type RunCongressTrendResult,
} from '@y0ngha/siglens-core';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import type { AnalysisGateError } from '@/shared/lib/types';
import { runCongressTrendAction } from '../actions/runCongressTrendAction';

const mockHeaders = headers as MockedFunction<typeof headers>;
const mockRunCongressTrend = runCongressTrend as MockedFunction<
    typeof runCongressTrend
>;
const mockGetCongressTradesProvider =
    getCongressTradesProvider as MockedFunction<
        typeof getCongressTradesProvider
    >;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;

const CACHED_RESULT: RunCongressTrendResult = {
    status: 'cached',
    result: {
        summaryKo: 'E2E 동향 요약',
        notableMembersKo: [],
        riskNoteKo: '공시 지연 유의',
        overallSentiment: 'bullish',
    },
};

const DONE_RESULT: RunCongressTrendResult = {
    status: 'done',
    result: {
        summaryKo: '의회 매수세 우위',
        notableMembersKo: [],
        riskNoteKo: '공시 지연 위험',
        overallSentiment: 'bullish',
    },
};

const MODEL_ID = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

describe('runCongressTrendAction 함수는', () => {
    beforeEach(() => {
        mockRunCongressTrend.mockReset();
        mockGetCongressTradesProvider.mockReset();
        mockGetCongressTradesProvider.mockReturnValue({} as never);
        mockRunCongressTrend.mockResolvedValue(DONE_RESULT);
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
    });

    it('siglens-core runCongressTrend에 symbol과 modelId를 전달한다', async () => {
        mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        await runCongressTrendAction('AAPL', MODEL_ID);

        expect(mockRunCongressTrend).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                modelId: MODEL_ID,
                tier: 'free',
            })
        );
    });

    it('getCongressTradesProvider 인스턴스를 dataProvider로 전달한다', async () => {
        mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        await runCongressTrendAction('TSLA', MODEL_ID);

        const call = mockRunCongressTrend.mock.calls[0]?.[0];
        expect(call?.dataProvider).toBeDefined();
        expect(mockGetCongressTradesProvider).toHaveBeenCalled();
    });

    it('underlying 함수의 cached 결과를 그대로 반환한다', async () => {
        mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        const result = await runCongressTrendAction('AAPL', MODEL_ID);

        expect(result).toBe(CACHED_RESULT);
    });

    it('underlying 함수의 done 결과를 그대로 반환한다', async () => {
        mockRunCongressTrend.mockResolvedValueOnce(DONE_RESULT);

        const result = await runCongressTrendAction('AAPL', MODEL_ID);

        expect(result).toBe(DONE_RESULT);
    });

    it('underlying 함수의 error(fetch_failed) 결과를 그대로 반환한다', async () => {
        const FETCH_FAILED_RESULT: RunCongressTrendResult = {
            status: 'error',
            code: 'fetch_failed',
            error: 'FMP congress trades fetch failed',
        };
        mockRunCongressTrend.mockResolvedValueOnce(FETCH_FAILED_RESULT);

        const result = await runCongressTrendAction('AAPL', MODEL_ID);

        expect(result).toBe(FETCH_FAILED_RESULT);
    });

    it('passes skipEnqueueIfMiss: true to siglens-core when request UA is a bot', async () => {
        mockHeaders.mockResolvedValueOnce(
            new Headers({
                'user-agent':
                    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            })
        );
        mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        await runCongressTrendAction('AAPL', MODEL_ID);

        expect(mockRunCongressTrend).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it('passes skipEnqueueIfMiss: false to siglens-core when request UA is not a bot', async () => {
        mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        await runCongressTrendAction('AAPL', MODEL_ID);

        expect(mockRunCongressTrend).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    describe('BYOK 게이트', () => {
        it('returns blocked result when gate.kind === "blocked" (free/anonymous + premium model)', async () => {
            mockGetCurrentUser.mockResolvedValue(null);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'blocked',
                error: gateError,
            });

            const result = await runCongressTrendAction('AAPL', PREMIUM_MODEL);

            expect(result).toEqual({ status: 'error', error: gateError });
            // Gate fires before the (expensive) core submit call.
            expect(mockRunCongressTrend).not.toHaveBeenCalled();
        });

        it('returns blocked result for a member with a premium model but no stored key', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'blocked',
                error: gateError,
            });

            const result = await runCongressTrendAction('AAPL', PREMIUM_MODEL);

            expect(result).toEqual({ status: 'error', error: gateError });
            expect(mockResolveTierAndByok).toHaveBeenCalledWith(
                'u1',
                PREMIUM_MODEL
            );
            expect(mockRunCongressTrend).not.toHaveBeenCalled();
        });

        it('forwards userApiKey when a member has a stored BYOK key for a premium model', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
                userApiKey: 'usr-key',
            });
            mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await runCongressTrendAction('AAPL', PREMIUM_MODEL);

            expect(mockRunCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({
                    userApiKey: 'usr-key',
                    tier: 'member',
                })
            );
        });

        it('omits userApiKey when not present in the gate result', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'pro' as never,
                // no userApiKey
            });
            mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await runCongressTrendAction('AAPL', PREMIUM_MODEL);

            const callArg = mockRunCongressTrend.mock.calls[0]?.[0];
            expect(callArg).toBeDefined();
            expect(callArg).not.toHaveProperty('userApiKey');
        });

        it('pro tier is allowed without a stored key even for a premium model', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'pro' as never,
            });
            mockRunCongressTrend.mockResolvedValueOnce(DONE_RESULT);

            const result = await runCongressTrendAction('AAPL', PREMIUM_MODEL);

            expect(result).toBe(DONE_RESULT);
            expect(mockRunCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ tier: 'pro' })
            );
        });

        it('a free model is unaffected by the BYOK gate for free/anonymous callers', async () => {
            mockGetCurrentUser.mockResolvedValue(null);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'free' as never,
            });
            mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            const result = await runCongressTrendAction('AAPL', MODEL_ID);

            expect(result).toBe(CACHED_RESULT);
            expect(mockRunCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ tier: 'free', modelId: MODEL_ID })
            );
            expect(mockRunCongressTrend.mock.calls[0]?.[0]).not.toHaveProperty(
                'userApiKey'
            );
        });

        it('passes null userId when getCurrentUser returns null', async () => {
            mockGetCurrentUser.mockResolvedValue(null);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'free' as never,
            });
            mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await runCongressTrendAction('AAPL', MODEL_ID);

            expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
        });

        it('returns unexpected_error result when an unexpected error is thrown', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockRejectedValue(
                new Error('db connection failed')
            );

            const result = await runCongressTrendAction('AAPL', MODEL_ID);

            expect(result).toMatchObject({
                status: 'error',
                error: expect.objectContaining({ code: 'unexpected_error' }),
            });
        });
    });

    describe('reasoning forwarding', () => {
        it('resolves tier via getCurrentUser + resolveTierAndByok and forwards reasoning: true for member tier', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });
            mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await runCongressTrendAction('AAPL', MODEL_ID, true);

            expect(mockResolveTierAndByok).toHaveBeenCalledWith('u1', MODEL_ID);
            expect(mockRunCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: true })
            );
        });

        it('resolves tier as free (null userId) for anonymous callers', async () => {
            mockGetCurrentUser.mockResolvedValue(null);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'free' as never,
            });
            mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await runCongressTrendAction('AAPL', MODEL_ID, true);

            expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
            expect(mockRunCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });

        it('defaults reasoning to false when omitted', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });
            mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await runCongressTrendAction('AAPL', MODEL_ID);

            expect(mockRunCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });

        it('forwards tier when reasoning is not requested (omitted)', async () => {
            mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await runCongressTrendAction('AAPL', MODEL_ID);

            expect(mockGetCurrentUser).toHaveBeenCalled();
            expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
            expect(mockRunCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false, tier: 'free' })
            );
        });

        it('forwards tier when reasoning is explicitly false', async () => {
            mockRunCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await runCongressTrendAction('AAPL', MODEL_ID, false);

            expect(mockGetCurrentUser).toHaveBeenCalled();
            expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
            expect(mockRunCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false, tier: 'free' })
            );
        });
    });

    it('E2E 모드에서 e2eCachedCongressTrend를 반환하고 provider를 호출하지 않는다', async () => {
        const originalE2E = process.env.E2E_TEST;
        process.env.E2E_TEST = '1';
        try {
            const { e2eCachedCongressTrend } =
                await import('@/shared/api/e2eAnalysisStub');
            const mockE2ECached = e2eCachedCongressTrend as MockedFunction<
                typeof e2eCachedCongressTrend
            >;
            const e2eFixture = {
                status: 'cached' as const,
                result: {} as never,
            };
            mockE2ECached.mockReturnValueOnce(e2eFixture);

            const result = await runCongressTrendAction('AAPL', MODEL_ID);

            expect(result).toEqual(e2eFixture);
            expect(mockRunCongressTrend).not.toHaveBeenCalled();
            expect(mockGetCongressTradesProvider).not.toHaveBeenCalled();
        } finally {
            if (originalE2E === undefined) {
                delete process.env.E2E_TEST;
            } else {
                process.env.E2E_TEST = originalE2E;
            }
        }
    });

    it('E2E 모드에서 force-error 쿠키가 있으면 e2eForcedCongressError를 반환한다', async () => {
        const { cookies } = await import('next/headers');
        const mockCookies = cookies as MockedFunction<typeof cookies>;
        mockCookies.mockResolvedValueOnce({
            get: vi.fn(() => ({
                name: 'e2e_force_congress_error',
                value: '1',
            })),
        } as never);

        const originalE2E = process.env.E2E_TEST;
        process.env.E2E_TEST = '1';
        try {
            const { e2eForcedCongressError } =
                await import('@/shared/api/e2eAnalysisStub');
            const mockE2EError = e2eForcedCongressError as MockedFunction<
                typeof e2eForcedCongressError
            >;
            const errorFixture = {
                status: 'error' as const,
                code: 'fetch_failed' as const,
                error: 'E2E forced congress error',
            };
            mockE2EError.mockReturnValueOnce(errorFixture);

            const result = await runCongressTrendAction('AAPL', MODEL_ID);

            expect(result).toEqual(errorFixture);
            expect(mockRunCongressTrend).not.toHaveBeenCalled();
        } finally {
            if (originalE2E === undefined) {
                delete process.env.E2E_TEST;
            } else {
                process.env.E2E_TEST = originalE2E;
            }
        }
    });
});
