// vi.mock → imports 순서 (TESTING.md#TE-1)
vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    runInvestorFlowsAnalysis: vi.fn(),
}));

vi.mock(
    '@/entities/investor-flows/server/getInvestorFlowsCachedProvider',
    () => ({
        investorFlowsCachedProvider: { getInvestorFlowsSnapshot: vi.fn() },
    })
);

vi.mock('@/shared/api/finra/finraShortDataEnabled', () => ({
    isFinraShortDataEnabled: vi.fn(() => true),
}));

vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: vi.fn(() => false) }));

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
import { cookies } from 'next/headers';
import {
    runInvestorFlowsAnalysis,
    type ModelId,
    type RunInvestorFlowsAnalysisResult,
} from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { investorFlowsCachedProvider } from '@/entities/investor-flows/server/getInvestorFlowsCachedProvider';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import { E2E_FORCE_INVESTOR_FLOWS_ERROR_COOKIE } from '@/shared/api/e2eAnalysisStub';
import type { AnalysisGateError } from '@/shared/lib/types';
import { runInvestorFlowsAction } from '../actions/runInvestorFlowsAction';

const mockRun = runInvestorFlowsAnalysis as MockedFunction<
    typeof runInvestorFlowsAnalysis
>;
const mockIsE2E = isE2E as MockedFunction<typeof isE2E>;
const mockFinra = isFinraShortDataEnabled as MockedFunction<
    typeof isFinraShortDataEnabled
>;
const mockCookies = cookies as unknown as MockedFunction<
    () => Promise<{ get: (name: string) => unknown }>
>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;

const MODEL_ID = 'gemini-3.6-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-5' as ModelId;

const RESPONSE = {
    summaryKo: '기관 순매수',
    axisInterpretations: [],
    keySignalsKo: [],
    risksKo: [],
    dataNotesKo: [],
};
const CACHED: RunInvestorFlowsAnalysisResult = {
    status: 'cached',
    result: RESPONSE,
};
const NO_DATA: RunInvestorFlowsAnalysisResult = { status: 'no_data' };

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

describe('runInvestorFlowsAction', () => {
    beforeEach(() => {
        mockRun.mockReset();
        mockRun.mockResolvedValue(CACHED);
        mockIsE2E.mockReturnValue(false);
        mockFinra.mockReturnValue(true);
        mockGetCurrentUser.mockReset();
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockReset();
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
    });

    describe('core 호출', () => {
        it('symbol·locale·modelId와 캐시 스냅샷 provider를 core에 넘긴다', async () => {
            await runInvestorFlowsAction('AAPL', MODEL_ID, 'ja');

            expect(mockRun).toHaveBeenCalledWith(
                expect.objectContaining({
                    symbol: 'AAPL',
                    locale: 'ja',
                    modelId: MODEL_ID,
                    dataProvider: investorFlowsCachedProvider,
                    tier: 'free',
                })
            );
        });

        it('FINRA 플래그가 켜져 있으면 includeFinraData: true를 넘긴다', async () => {
            mockFinra.mockReturnValue(true);

            await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(mockRun).toHaveBeenCalledWith(
                expect.objectContaining({ includeFinraData: true })
            );
        });

        it('FINRA 플래그가 꺼져 있으면 includeFinraData: false를 넘긴다(캐시 키가 갈린다)', async () => {
            mockFinra.mockReturnValue(false);

            await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(mockRun).toHaveBeenCalledWith(
                expect.objectContaining({ includeFinraData: false })
            );
        });

        it('abort signal을 그대로 넘긴다', async () => {
            const controller = new AbortController();

            await runInvestorFlowsAction(
                'AAPL',
                MODEL_ID,
                'ko',
                undefined,
                controller.signal
            );

            expect(mockRun).toHaveBeenCalledWith(
                expect.objectContaining({ signal: controller.signal })
            );
        });

        it('core의 no_data 결과를 그대로 반환한다(AI를 부르지 않은 정상 상태)', async () => {
            mockRun.mockResolvedValueOnce(NO_DATA);

            const result = await runInvestorFlowsAction('ZZZZ', MODEL_ID, 'ko');

            expect(result).toBe(NO_DATA);
        });

        it('core의 cached 결과를 그대로 반환한다', async () => {
            const result = await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(result).toBe(CACHED);
        });

        it('core의 fetch_failed 오류를 그대로 반환한다', async () => {
            const failed: RunInvestorFlowsAnalysisResult = {
                status: 'error',
                code: 'fetch_failed',
                error: 'db down',
            };
            mockRun.mockResolvedValueOnce(failed);

            const result = await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(result).toBe(failed);
        });
    });

    describe('cacheOnly', () => {
        it('cacheOnly가 true면 skipEnqueueIfMiss: true로 넘긴다', async () => {
            await runInvestorFlowsAction(
                'AAPL',
                MODEL_ID,
                'ko',
                undefined,
                undefined,
                true
            );

            expect(mockRun).toHaveBeenCalledWith(
                expect.objectContaining({ skipEnqueueIfMiss: true })
            );
        });

        it('생략하면 skipEnqueueIfMiss: false다(봇과 사람이 같은 본문을 생성한다)', async () => {
            await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(mockRun).toHaveBeenCalledWith(
                expect.objectContaining({ skipEnqueueIfMiss: false })
            );
        });
    });

    describe('BYOK 게이트', () => {
        it('프리미엄 모델을 키 없이 요청하면 core를 부르지 않고 차단 결과를 돌려준다', async () => {
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'blocked',
                error: gateError,
            });

            const result = await runInvestorFlowsAction(
                'AAPL',
                PREMIUM_MODEL,
                'ko'
            );

            expect(result).toEqual({ status: 'error', error: gateError });
            expect(mockRun).not.toHaveBeenCalled();
        });

        it('저장된 BYOK 키를 userApiKey로 넘긴다', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
                userApiKey: 'usr-key',
            });

            await runInvestorFlowsAction('AAPL', PREMIUM_MODEL, 'ko');

            expect(mockResolveTierAndByok).toHaveBeenCalledWith(
                'u1',
                PREMIUM_MODEL,
                'ko'
            );
            expect(mockRun).toHaveBeenCalledWith(
                expect.objectContaining({
                    userApiKey: 'usr-key',
                    tier: 'member',
                })
            );
        });

        it('키가 없으면 userApiKey 필드를 아예 넘기지 않는다', async () => {
            await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(mockRun).toHaveBeenCalledWith(
                expect.not.objectContaining({ userApiKey: expect.anything() })
            );
        });

        it('회원이 깊은 생각을 켜면 reasoning: true를 넘긴다', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
            mockResolveTierAndByok.mockResolvedValue({
                kind: 'allowed',
                tier: 'member' as never,
            });

            await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko', true);

            expect(mockRun).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: true })
            );
        });

        it('비회원이 깊은 생각을 요청해도 reasoning: false다', async () => {
            await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko', true);

            expect(mockRun).toHaveBeenCalledWith(
                expect.objectContaining({ reasoning: false })
            );
        });

        it('AI 제공자 장애는 ai_server_unstable 오류 결과로 바꾼다(던지지 않는다)', async () => {
            mockRun.mockRejectedValueOnce(new Error('AI_SERVER_UNSTABLE'));

            const result = await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(result).toMatchObject({
                status: 'error',
                error: expect.objectContaining({ code: 'ai_server_unstable' }),
            });
        });

        it('예상 못 한 예외도 unexpected_error 결과로 바꾼다', async () => {
            mockResolveTierAndByok.mockRejectedValue(new Error('db failed'));

            const result = await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(result).toMatchObject({
                status: 'error',
                error: expect.objectContaining({ code: 'unexpected_error' }),
            });
        });
    });

    describe('E2E 단락', () => {
        beforeEach(() => {
            mockIsE2E.mockReturnValue(true);
        });

        it('E2E에서는 core를 부르지 않고 고정 fixture(cached)를 돌려준다', async () => {
            mockCookies.mockResolvedValue({ get: () => undefined });

            const result = await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(result).toMatchObject({
                status: 'cached',
                result: expect.objectContaining({
                    summaryKo: expect.stringContaining('E2E'),
                }),
            });
            expect(mockRun).not.toHaveBeenCalled();
        });

        it('force-error 쿠키가 있으면 일시적 실패(fetch_failed)를 주입한다', async () => {
            mockCookies.mockResolvedValue({
                get: (name: string) =>
                    name === E2E_FORCE_INVESTOR_FLOWS_ERROR_COOKIE
                        ? { value: '1' }
                        : undefined,
            });

            const result = await runInvestorFlowsAction('AAPL', MODEL_ID, 'ko');

            expect(result).toMatchObject({
                status: 'error',
                code: 'fetch_failed',
            });
        });
    });
});
