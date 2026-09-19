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

const { getAssetInfo, resolveMarketProfile, getQuote } = vi.hoisted(() => ({
    getAssetInfo: vi.fn(),
    resolveMarketProfile: vi.fn(),
    getQuote: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({ getAssetInfo }));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(),
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

const MODEL_ID = 'gemini-3.6-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-5' as ModelId;

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

        getAssetInfo.mockReset().mockResolvedValue(null);
        resolveMarketProfile.mockReset().mockResolvedValue('us-equity');
        getQuote.mockReset().mockResolvedValue({ price: 150 });
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

    it('forwards currency: "USD" for a US symbol', async () => {
        mockRunFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');

        expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ currency: 'USD' })
        );
    });

    it('forwards currency: "KRW" for a KR symbol', async () => {
        mockRunFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await runFundamentalAnalysisAction('005930.KS', MODEL_ID, 'ko');

        expect(mockRunFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ currency: 'KRW' })
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

    it('returns ai_server_unstable when the AI provider fails (retry exhausted)', async () => {
        mockRunFundamentalAnalysis.mockRejectedValueOnce(
            new Error('AI_SERVER_UNSTABLE')
        );

        const result = await runFundamentalAnalysisAction(
            'AAPL',
            MODEL_ID,
            'ko'
        );

        expect(result).toMatchObject({
            status: 'error',
            error: expect.objectContaining({ code: 'ai_server_unstable' }),
        });
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

    describe('currentPrice (lazy getter, core only calls it on a cache miss)', () => {
        /** `currentPrice` is now `number | null | (() => Promise<number | null>)` — narrow to the function variant this action always passes. */
        function currentPriceGetter(
            callArg: unknown
        ): () => Promise<number | null> {
            const cp = (callArg as { currentPrice?: unknown })?.currentPrice;
            if (typeof cp !== 'function')
                throw new Error(
                    'expected currentPrice to be a lazy getter function'
                );
            return cp as () => Promise<number | null>;
        }

        it('currentPrice는 사전 조회된 값이 아니라 함수로 전달된다 — 액션 호출 자체는 시세를 조회하지 않는다', async () => {
            getQuote.mockResolvedValue({ price: 234.5 });

            await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');

            const callArg = mockRunFundamentalAnalysis.mock.calls[0]?.[0];
            expect(
                typeof (callArg as { currentPrice?: unknown })?.currentPrice
            ).toBe('function');
            // The action never awaits/calls the getter itself — only core
            // does, and only on a cache miss. Calling the ACTION must not
            // have triggered a quote fetch on its own.
            expect(getQuote).not.toHaveBeenCalled();
        });

        it('getter를 호출하면(=core의 cache-miss 경로) 유효한 시세를 반환한다', async () => {
            getQuote.mockResolvedValue({ price: 234.5 });
            await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');
            const callArg = mockRunFundamentalAnalysis.mock.calls[0]?.[0];
            await expect(currentPriceGetter(callArg)()).resolves.toBe(234.5);
        });

        it('fmpSymbol이 있으면(get_quote/get_fundamentals와 같은 경로) getter 호출 시에만 그 값으로 시세를 조회한다', async () => {
            getAssetInfo.mockResolvedValue({
                symbol: '^SPX',
                fmpSymbol: '^GSPC',
            });
            getQuote.mockResolvedValue({ price: 100 });

            await runFundamentalAnalysisAction('^SPX', MODEL_ID, 'ko');
            const callArg = mockRunFundamentalAnalysis.mock.calls[0]?.[0];
            expect(getQuote).not.toHaveBeenCalled();

            await currentPriceGetter(callArg)();
            expect(getQuote).toHaveBeenCalledWith('^GSPC');
        });

        it('getter 호출 시 시세 조회가 실패해도(non-blocking) null로 degrade하고, 분석 자체는 그대로 진행된다', async () => {
            getQuote.mockRejectedValue(new Error('FMP down'));

            const result = await runFundamentalAnalysisAction(
                'AAPL',
                MODEL_ID,
                'ko'
            );

            expect(result).toBe(DONE_RESULT);
            const callArg = mockRunFundamentalAnalysis.mock.calls[0]?.[0];
            await expect(currentPriceGetter(callArg)()).resolves.toBeNull();
        });

        it('getter 호출 시 price가 0 이하면(시세 실패를 0으로 표현) null로 degrade한다', async () => {
            getQuote.mockResolvedValue({ price: 0 });
            await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');
            let callArg = mockRunFundamentalAnalysis.mock.calls.at(-1)?.[0];
            await expect(currentPriceGetter(callArg)()).resolves.toBeNull();

            getQuote.mockResolvedValue({ price: -10 });
            await runFundamentalAnalysisAction('AAPL', MODEL_ID, 'ko');
            callArg = mockRunFundamentalAnalysis.mock.calls.at(-1)?.[0];
            await expect(currentPriceGetter(callArg)()).resolves.toBeNull();
        });
    });
});
