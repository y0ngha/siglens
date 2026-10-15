vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    runOverallAnalysis: vi.fn(),
    isEtRegularSessionOpen: vi.fn(() => true),
    computeFinancialsScorecard: vi.fn(() => undefined),
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: vi.fn(() => ({})),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: vi.fn().mockImplementation(function () {
        return { listBySymbol: vi.fn(async () => []) };
    }),
}));
vi.mock('@/entities/earnings-report/api', () => ({
    getNextEarningsReport: vi.fn(async () => null),
}));
vi.mock('@/entities/economy/api/loadNewsMacroCalendar', () => ({
    loadNewsMacroCalendar: vi.fn(async () => []),
}));
vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(async () => null),
}));
vi.mock('@/shared/lib/options/openInterestStale', () => ({
    isOpenInterestSnapshotStale: vi.fn(() => false),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn(() => ({})),
}));
vi.mock('@/entities/financials-statements/lib/getFinancialsSnapshot', () => ({
    getFinancialsSnapshot: vi.fn(async () => ({})),
}));
const { mockPositionBucket } = vi.hoisted(() => ({
    mockPositionBucket: vi.fn(async () => undefined),
}));
vi.mock('@/entities/portfolio/lib/resolveHoldingPositionBucket', () => ({
    resolveHoldingPositionBucket: mockPositionBucket,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us-equity'),
}));
vi.mock('@/shared/lib/byokGate', () => ({
    resolveReasoning: vi.fn(
        (tier: string, clientReasoning?: boolean) =>
            tier !== 'free' && clientReasoning === true
    ),
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

import { runOverallAnalysis, type ModelId } from '@y0ngha/siglens-core';
import { executeOverallAnalysis } from '@/entities/analysis/server/overallAnalysisRunner';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    ByokOnlyRoutingError,
    CACHE_PROBE_KEY_PLACEHOLDER,
} from '@/shared/lib/byokOnly';

const mockRun = vi.mocked(runOverallAnalysis);
const BYOK_MODEL = 'claude-opus-5' as ModelId;
const FREE_MODEL = 'gemini-3.6-flash' as ModelId;
const base = {
    symbol: 'AAPL',
    companyName: 'Apple',
    timeframe: '1Day' as const,
    locale: 'en' as const,
};
const byokCaller = {
    userId: 'u1',
    tier: 'member' as const,
    userApiKey: 'sk-user',
    byokOnly: true,
};

beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue({ status: 'done', result: {} } as never);
});

describe('executeOverallAnalysis', () => {
    it('호출자의 tier·userApiKey·userId를 네 축에 넘기고 세션 쿠키는 읽지 않는다', async () => {
        await executeOverallAnalysis({
            ...base,
            caller: byokCaller,
            modelId: BYOK_MODEL,
        });

        expect(mockRun).toHaveBeenCalledTimes(1);
        const arg = mockRun.mock.calls[0][0];
        expect(arg).toMatchObject({
            tier: 'member',
            userApiKey: 'sk-user',
            modelId: BYOK_MODEL,
            locale: 'en',
            skipEnqueueIfMiss: false,
            technical: { tierContext: { userId: 'u1', tier: 'member' } },
        });
        // providerFallback을 켜지 않는다 — 켜면 사용자 키 DeepSeek 실패 시 서버 Gemini 키로 재시도한다.
        expect(arg).not.toHaveProperty('providerFallback');
        expect(getCurrentUser).not.toHaveBeenCalled();
        expect(mockPositionBucket).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1', tier: 'member' })
        );
    });

    it('cacheOnly 옵션은 skipEnqueueIfMiss로 전달된다', async () => {
        await executeOverallAnalysis({
            ...base,
            caller: { ...byokCaller, userApiKey: CACHE_PROBE_KEY_PLACEHOLDER },
            modelId: BYOK_MODEL,
            options: { cacheOnly: true },
        });
        expect(mockRun).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it.each([
        ['pro tier', { ...byokCaller, tier: 'pro' as const }, BYOK_MODEL],
        ['free 등급 모델', byokCaller, FREE_MODEL],
        [
            '키 없음',
            { userId: 'u1', tier: 'member' as const, byokOnly: true },
            BYOK_MODEL,
        ],
    ])(
        'byokOnly에서 %s은 입력 조립·core 호출 전에 거절한다',
        async (_l, caller, modelId) => {
            await expect(
                executeOverallAnalysis({ ...base, caller, modelId })
            ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
            expect(mockRun).not.toHaveBeenCalled();
            expect(mockPositionBucket).not.toHaveBeenCalled();
        }
    );

    it('자리표시 키로는 생성(cacheOnly 아님)을 할 수 없다', async () => {
        await expect(
            executeOverallAnalysis({
                ...base,
                caller: {
                    ...byokCaller,
                    userApiKey: CACHE_PROBE_KEY_PLACEHOLDER,
                },
                modelId: BYOK_MODEL,
            })
        ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
        expect(mockRun).not.toHaveBeenCalled();
    });

    it('쿠키 액션 호출자(byokOnly 아님)는 검사를 받지 않는다 — 서버 키 정책 그대로', async () => {
        await executeOverallAnalysis({
            ...base,
            caller: { userId: null, tier: 'free' },
            modelId: FREE_MODEL,
        });
        const arg = mockRun.mock.calls[0][0];
        expect(arg).toMatchObject({ tier: 'free', modelId: FREE_MODEL });
        expect(arg).not.toHaveProperty('userApiKey');
    });

    it('core의 예외는 삼키지 않고 던진다', async () => {
        const failure = new Error('AI_SERVER_UNSTABLE');
        mockRun.mockRejectedValue(failure);
        await expect(
            executeOverallAnalysis({
                ...base,
                caller: byokCaller,
                modelId: BYOK_MODEL,
            })
        ).rejects.toBe(failure);
    });
});
