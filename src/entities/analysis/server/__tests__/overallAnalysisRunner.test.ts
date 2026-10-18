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
vi.mock('@/entities/earnings-report/api', () => {
    const listEarningsDatesMock = vi.fn(
        async (..._args: unknown[]): Promise<readonly string[] | undefined> =>
            undefined
    );
    return {
        getNextEarningsReport: vi.fn(async () => null),
        listEarningsDates: listEarningsDatesMock,
        listEarningsDatesAfterRefresh: vi.fn(
            (refresh: Promise<unknown>, ...rest: [string, unknown]) =>
                refresh.then(
                    () => listEarningsDatesMock(...rest),
                    () => undefined
                )
        ),
        resolveEarningsDates: vi.fn(async () => undefined),
    };
});
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
vi.mock('@/entities/ticker/lib/resolveKrxTickTable', () => ({
    resolveKrxTickTable: vi.fn().mockResolvedValue('share'),
}));
const { mockFlowsScorecard } = vi.hoisted(() => ({
    mockFlowsScorecard: vi.fn(async () => undefined as unknown),
}));
vi.mock(
    '@/entities/investor-flows/server/getOverallInvestorFlowsScorecard',
    () => ({ getOverallInvestorFlowsScorecard: mockFlowsScorecard })
);
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
import { ByokOnlyRoutingError } from '@/shared/lib/byokOnly';
import { resolveKrxTickTable } from '@/entities/ticker/lib/resolveKrxTickTable';
import {
    getNextEarningsReport,
    listEarningsDates,
} from '@/entities/earnings-report/api';

const mockRun = vi.mocked(runOverallAnalysis);
const BYOK_MODEL = 'claude-opus-5' as ModelId;
const FREE_MODEL = 'gemini-3.6-flash' as ModelId;

/** 호출을 모델로 고른다(인덱스로 잡지 않는다). */
const callFor = (modelId: ModelId) =>
    mockRun.mock.calls.find(([arg]) => arg.modelId === modelId)?.[0];
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
    mockFlowsScorecard.mockResolvedValue(undefined);
    vi.mocked(listEarningsDates).mockResolvedValue(undefined);
});

describe('executeOverallAnalysis — 실적 발표일(earningsDates) 주입', () => {
    it('실적 갱신 뒤 DB에서 읽은 발표일을 technical 축 earningsDates로 넘긴다', async () => {
        const dates = ['2026-07-30', '2026-10-29'];
        vi.mocked(listEarningsDates).mockResolvedValue(dates);
        const order: string[] = [];
        vi.mocked(getNextEarningsReport).mockImplementationOnce(async () => {
            order.push('refresh');
            return null;
        });
        vi.mocked(listEarningsDates).mockImplementationOnce(async () => {
            order.push('read');
            return dates;
        });

        await executeOverallAnalysis({
            ...base,
            caller: byokCaller,
            modelId: BYOK_MODEL,
        });

        expect(order).toEqual(['refresh', 'read']);
        expect(callFor(BYOK_MODEL)?.technical?.earningsDates).toBe(dates);
    });

    it('발표일을 못 구하면(undefined) technical 축에 필드를 싣지 않고 분석은 진행된다', async () => {
        vi.mocked(listEarningsDates).mockResolvedValue(undefined);

        await executeOverallAnalysis({
            ...base,
            caller: byokCaller,
            modelId: BYOK_MODEL,
        });

        expect(callFor(BYOK_MODEL)).toBeDefined();
        expect(callFor(BYOK_MODEL)?.technical).not.toHaveProperty(
            'earningsDates'
        );
    });
});

describe('executeOverallAnalysis — 수급 점수표(investorFlowsScorecard) 주입', () => {
    it('웹 액션·공개 API가 공유하는 이 경로가 점수표를 core에 그대로 넘긴다', async () => {
        const scorecard = { composite: { score: 12 } };
        mockFlowsScorecard.mockResolvedValue(scorecard);

        await executeOverallAnalysis({
            ...base,
            caller: byokCaller,
            modelId: BYOK_MODEL,
        });

        expect(mockFlowsScorecard).toHaveBeenCalledWith('AAPL', 'us-equity');
        expect(callFor(BYOK_MODEL)).toMatchObject({
            investorFlowsScorecard: scorecard,
        });
    });

    it('데이터 없음(null)은 null로, 미통합(undefined)은 undefined로 구분해 넘긴다', async () => {
        mockFlowsScorecard.mockResolvedValue(null);
        await executeOverallAnalysis({
            ...base,
            caller: byokCaller,
            modelId: BYOK_MODEL,
        });
        expect(callFor(BYOK_MODEL)).toMatchObject({
            investorFlowsScorecard: null,
        });

        mockRun.mockClear();
        mockFlowsScorecard.mockResolvedValue(undefined);
        await executeOverallAnalysis({
            ...base,
            caller: byokCaller,
            modelId: BYOK_MODEL,
        });
        expect(callFor(BYOK_MODEL)?.investorFlowsScorecard).toBeUndefined();
    });
});

describe('executeOverallAnalysis — KRX 호가표 주입', () => {
    it('해석된 호가표를 core에 그대로 넘긴다', async () => {
        vi.mocked(resolveKrxTickTable).mockResolvedValueOnce('etp');

        await executeOverallAnalysis({
            ...base,
            caller: byokCaller,
            modelId: BYOK_MODEL,
        });

        expect(callFor(BYOK_MODEL)).toMatchObject({ krxTickTable: 'etp' });
    });
});

describe('executeOverallAnalysis', () => {
    it('호출자의 tier·userApiKey·userId를 네 축에 넘기고 세션 쿠키는 읽지 않는다', async () => {
        await executeOverallAnalysis({
            ...base,
            caller: byokCaller,
            modelId: BYOK_MODEL,
        });

        expect(mockRun).toHaveBeenCalledTimes(1);
        const arg = callFor(BYOK_MODEL);
        expect(arg).toMatchObject({
            tier: 'member',
            userApiKey: 'sk-user',
            modelId: BYOK_MODEL,
            locale: 'en',
            skipEnqueueIfMiss: false,
            keyPolicy: 'byok-only',
            technical: { tierContext: { userId: 'u1', tier: 'member' } },
        });
        // providerFallback을 켜지 않는다 — 켜면 사용자 키 DeepSeek 실패 시 서버 Gemini 키로 재시도한다.
        expect(arg).not.toHaveProperty('providerFallback');
        expect(getCurrentUser).not.toHaveBeenCalled();
        expect(mockPositionBucket).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1', tier: 'member' })
        );
    });

    it('cacheOnly 확인 호출은 키 없이 byok-only로 보내고 skipEnqueueIfMiss를 켠다', async () => {
        await executeOverallAnalysis({
            ...base,
            caller: { userId: 'u1', tier: 'member', byokOnly: true },
            modelId: BYOK_MODEL,
            options: { cacheOnly: true },
        });
        const arg = callFor(BYOK_MODEL);
        expect(arg).toMatchObject({
            skipEnqueueIfMiss: true,
            keyPolicy: 'byok-only',
        });
        expect(arg).not.toHaveProperty('userApiKey');
    });

    it.each(['free', 'member', 'pro'] as const)(
        'byokOnly는 %s tier·free 등급 모델도 실제 tier 그대로 사용자 키와 byok-only로 보낸다',
        async tier => {
            await executeOverallAnalysis({
                ...base,
                caller: { ...byokCaller, tier },
                modelId: FREE_MODEL,
            });
            expect(callFor(FREE_MODEL)).toMatchObject({
                tier,
                userApiKey: 'sk-user',
                keyPolicy: 'byok-only',
                modelId: FREE_MODEL,
            });
        }
    );

    it('byokOnly에서 생성 호출에 키가 없으면 입력 조립·core 호출 전에 거절한다', async () => {
        await expect(
            executeOverallAnalysis({
                ...base,
                caller: { userId: 'u1', tier: 'member', byokOnly: true },
                modelId: BYOK_MODEL,
            })
        ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
        expect(mockRun).not.toHaveBeenCalled();
        expect(mockPositionBucket).not.toHaveBeenCalled();
    });

    it('쿠키 액션 호출자(byokOnly 아님)는 검사를 받지 않는다 — 서버 키 정책 그대로', async () => {
        await executeOverallAnalysis({
            ...base,
            caller: { userId: null, tier: 'free' },
            modelId: FREE_MODEL,
        });
        const arg = callFor(FREE_MODEL);
        expect(arg).toMatchObject({ tier: 'free', modelId: FREE_MODEL });
        expect(arg).not.toHaveProperty('userApiKey');
        // 웹 쿠키 경로는 기본 tier 정책 그대로다 — keyPolicy를 싣지 않는다.
        expect(arg).not.toHaveProperty('keyPolicy');
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
