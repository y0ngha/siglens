// vi.mock → imports 순서 (MISTAKES.md Tests §17)
vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
    cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined) })),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    submitCongressTrend: vi.fn(),
}));

vi.mock('@/shared/api/fmp/getCongressTradesProvider', () => ({
    getCongressTradesProvider: vi.fn(() => ({})),
}));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierOnly: vi.fn(),
    resolveReasoning: vi.fn(
        (tier: string, clientReasoning?: boolean) =>
            tier !== 'free' && clientReasoning === true
    ),
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
    submitCongressTrend,
    type ModelId,
    type SubmitCongressTrendResult,
} from '@y0ngha/siglens-core';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierOnly } from '@/shared/lib/byokGate';
import { submitCongressTrendAction } from '../actions/submitCongressTrendAction';

const mockHeaders = headers as MockedFunction<typeof headers>;
const mockSubmitCongressTrend = submitCongressTrend as MockedFunction<
    typeof submitCongressTrend
>;
const mockGetCongressTradesProvider =
    getCongressTradesProvider as MockedFunction<
        typeof getCongressTradesProvider
    >;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierOnly = resolveTierOnly as MockedFunction<
    typeof resolveTierOnly
>;

const CACHED_RESULT: SubmitCongressTrendResult = {
    status: 'cached',
    result: {
        summaryKo: 'E2E 동향 요약',
        notableMembersKo: [],
        riskNoteKo: '공시 지연 유의',
        overallSentiment: 'bullish',
    },
};

const SUBMITTED_RESULT: SubmitCongressTrendResult = {
    status: 'submitted',
    jobId: 'job-congress-001',
};

const MODEL_ID = 'gemini-2.5-flash' as ModelId;

describe('submitCongressTrendAction 함수는', () => {
    beforeEach(() => {
        mockSubmitCongressTrend.mockReset();
        mockGetCongressTradesProvider.mockReset();
        mockGetCongressTradesProvider.mockReturnValue({} as never);
        mockSubmitCongressTrend.mockResolvedValue(SUBMITTED_RESULT);
        mockGetCurrentUser.mockReset();
        mockResolveTierOnly.mockReset();
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierOnly.mockResolvedValue('free');
    });

    it('siglens-core submitCongressTrend에 symbol과 modelId를 전달한다', async () => {
        mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        await submitCongressTrendAction('AAPL', MODEL_ID);

        expect(mockSubmitCongressTrend).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                modelId: MODEL_ID,
                tier: 'free',
            })
        );
    });

    it('getCongressTradesProvider 인스턴스를 dataProvider로 전달한다', async () => {
        mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        await submitCongressTrendAction('TSLA', MODEL_ID);

        const call = mockSubmitCongressTrend.mock.calls[0]?.[0];
        expect(call?.dataProvider).toBeDefined();
        expect(mockGetCongressTradesProvider).toHaveBeenCalled();
    });

    it('underlying 함수의 cached 결과를 그대로 반환한다', async () => {
        mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        const result = await submitCongressTrendAction('AAPL', MODEL_ID);

        expect(result).toBe(CACHED_RESULT);
    });

    it('underlying 함수의 submitted 결과를 그대로 반환한다', async () => {
        mockSubmitCongressTrend.mockResolvedValueOnce(SUBMITTED_RESULT);

        const result = await submitCongressTrendAction('AAPL', MODEL_ID);

        expect(result).toBe(SUBMITTED_RESULT);
    });

    it('passes skipEnqueueIfMiss: true to siglens-core when request UA is a bot', async () => {
        mockHeaders.mockResolvedValueOnce(
            new Headers({
                'user-agent':
                    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            })
        );
        mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        await submitCongressTrendAction('AAPL', MODEL_ID);

        expect(mockSubmitCongressTrend).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it('passes skipEnqueueIfMiss: false to siglens-core when request UA is not a bot', async () => {
        mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

        await submitCongressTrendAction('AAPL', MODEL_ID);

        expect(mockSubmitCongressTrend).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    describe('reasoning forwarding', () => {
        it('resolves tier via getCurrentUser + resolveTierOnly and forwards reasoning: true for member tier', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('member');
            mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await submitCongressTrendAction('AAPL', MODEL_ID, true);

            expect(mockResolveTierOnly).toHaveBeenCalledWith('u1');
            expect(mockSubmitCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: true })
            );
        });

        it('resolves tier as free (null userId) for anonymous callers', async () => {
            mockGetCurrentUser.mockResolvedValue(null);
            mockResolveTierOnly.mockResolvedValue('free');
            mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await submitCongressTrendAction('AAPL', MODEL_ID, true);

            expect(mockResolveTierOnly).toHaveBeenCalledWith(null);
            expect(mockSubmitCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });

        it('defaults reasoning to false when omitted', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierOnly.mockResolvedValue('member');
            mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await submitCongressTrendAction('AAPL', MODEL_ID);

            expect(mockSubmitCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });

        it('forwards tier when reasoning is not requested (omitted)', async () => {
            mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await submitCongressTrendAction('AAPL', MODEL_ID);

            expect(mockGetCurrentUser).toHaveBeenCalled();
            expect(mockResolveTierOnly).toHaveBeenCalledWith(null);
            expect(mockSubmitCongressTrend).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false, tier: 'free' })
            );
        });

        it('forwards tier when reasoning is explicitly false', async () => {
            mockSubmitCongressTrend.mockResolvedValueOnce(CACHED_RESULT);

            await submitCongressTrendAction('AAPL', MODEL_ID, false);

            expect(mockGetCurrentUser).toHaveBeenCalled();
            expect(mockResolveTierOnly).toHaveBeenCalledWith(null);
            expect(mockSubmitCongressTrend).toHaveBeenCalledWith(
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

            const result = await submitCongressTrendAction('AAPL', MODEL_ID);

            expect(result).toEqual(e2eFixture);
            expect(mockSubmitCongressTrend).not.toHaveBeenCalled();
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

            const result = await submitCongressTrendAction('AAPL', MODEL_ID);

            expect(result).toEqual(errorFixture);
            expect(mockSubmitCongressTrend).not.toHaveBeenCalled();
        } finally {
            if (originalE2E === undefined) {
                delete process.env.E2E_TEST;
            } else {
                process.env.E2E_TEST = originalE2E;
            }
        }
    });
});
