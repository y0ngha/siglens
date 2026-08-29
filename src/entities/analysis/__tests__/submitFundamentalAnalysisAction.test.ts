import type { MockedFunction } from 'vitest';

vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    runFundamentalAnalysis: vi.fn(),
}));

vi.mock('@/shared/api/fmp/fundamentalClient', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/fmp/fundamentalClient')
    >()),
    FmpFundamentalClient: vi.fn().mockImplementation(function () {
        return {};
    }),
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

import { headers } from 'next/headers';
import {
    runFundamentalAnalysis,
    type ModelId,
    type RunFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/shared/api/fmp/fundamentalClient';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import type { AnalysisGateError } from '@/shared/lib/types';
import { runFundamentalAnalysisAction } from '../actions/runFundamentalAnalysisAction';

const mockHeaders = headers as MockedFunction<typeof headers>;
const mockRunFundamentalAnalysis = runFundamentalAnalysis as MockedFunction<
    typeof runFundamentalAnalysis
>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;

const CACHED_RESULT: RunFundamentalAnalysisResult = {
    status: 'cached',
    result: { categories: [] } as never,
};

const DONE_RESULT: RunFundamentalAnalysisResult = {
    status: 'done',
    result: { categories: [] } as never,
};

const MODEL_ID = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

describe('runFundamentalAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockRunFundamentalAnalysis.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();

        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
        mockRunFundamentalAnalysis.mockResolvedValue(DONE_RESULT);
    });

    it('siglens-core runFundamentalAnalysis에 symbol과 modelId를 전달한다', async () => {
        mockRunFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');

        expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                modelId: MODEL_ID,
            })
        );
    });

    it('FmpFundamentalClient 인스턴스를 dataProvider로 전달한다', async () => {
        mockRunFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFundamentalAnalysisAction('TSLA', MODEL_ID, 'ko');

        const call = mockRunFundamentalAnalysis.mock.calls[0]?.[0];
        expect(call?.dataProvider).toBeDefined();
        expect(FmpFundamentalClient).toHaveBeenCalled();
    });

    it('underlying 함수의 cached 결과를 그대로 반환한다', async () => {
        mockRunFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        const result = await runFundamentalAnalysisAction(
            'AAPL',
            MODEL_ID,
            'ko'
        );

        expect(result).toBe(CACHED_RESULT);
    });

    it('underlying 함수의 done 결과를 그대로 반환한다', async () => {
        mockRunFundamentalAnalysis.mockResolvedValueOnce(DONE_RESULT);

        const result = await runFundamentalAnalysisAction(
            'AAPL',
            MODEL_ID,
            'ko'
        );

        expect(result).toBe(DONE_RESULT);
    });

    it('returns blocked result when gate.kind === "blocked"', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'blocked',
            error: gateError,
        });

        const result = await runFundamentalAnalysisAction(
            'AAPL',
            PREMIUM_MODEL,
            'ko'
        );

        expect(result).toEqual({ status: 'error', error: gateError });
        // Gate fires before expensive provider fetch
        expect(mockRunFundamentalAnalysis).not.toHaveBeenCalled();
    });

    it('forwards tier="member" to siglens-core when gate allowed', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');

        expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
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

        await runFundamentalAnalysisAction('AAPL', PREMIUM_MODEL, 'ko');

        expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
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

        await runFundamentalAnalysisAction('AAPL', PREMIUM_MODEL, 'ko');

        const callArg = mockRunFundamentalAnalysis.mock.calls[0]?.[0];
        expect(callArg).toBeDefined();
        expect(callArg).not.toHaveProperty('userApiKey');
    });

    it('passes null userId when getCurrentUser returns null', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });

        await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');

        expect(mockResolveTierAndByok).toHaveBeenCalledWith(
            null,
            MODEL_ID,
            'ko'
        );
    });

    it('returns unexpected_error result when an unexpected error is thrown', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockRejectedValue(
            new Error('db connection failed')
        );

        const result = await runFundamentalAnalysisAction(
            'AAPL',
            MODEL_ID,
            'ko'
        );

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
        mockRunFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');

        expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    describe('reasoning forwarding', () => {
        it('forwards reasoning: true for member tier when client requests it', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });

            await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko', true);

            expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: true })
            );
        });

        it('forces reasoning: false for free tier even when client requests true', async () => {
            await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko', true);

            expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });

        it('defaults reasoning to false when omitted', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });

            await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');

            expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });
    });

    it('passes skipEnqueueIfMiss: false to siglens-core when request UA is not a bot', async () => {
        mockRunFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');

        expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });
});
