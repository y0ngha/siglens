vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    runNewsAnalysis: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
const { mockListBySymbol } = vi.hoisted(() => ({ mockListBySymbol: vi.fn() }));
vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: vi.fn().mockImplementation(function () {
        return { listBySymbol: mockListBySymbol };
    }),
}));
vi.mock('@/entities/earnings-report/api', () => ({
    getNextEarningsReport: vi.fn(async () => null),
}));
vi.mock('@/entities/economy/api/loadNewsMacroCalendar', () => ({
    loadNewsMacroCalendar: vi.fn(async () => []),
}));
vi.mock('@/shared/lib/byokGate', () => ({
    resolveReasoning: vi.fn(
        (tier: string, clientReasoning?: boolean) =>
            tier !== 'free' && clientReasoning === true
    ),
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us-equity'),
}));
// 세션 쿠키를 읽는 경로는 이 파일에 없어야 한다 — 읽으면 이 목이 호출된다.
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

import { runNewsAnalysis, type ModelId } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { executeNewsAnalysis } from '@/entities/news-article/server/newsAnalysisRunner';
import { ByokOnlyRoutingError } from '@/shared/lib/byokOnly';

const mockRun = vi.mocked(runNewsAnalysis);
const BYOK_MODEL = 'claude-opus-5' as ModelId;
const FREE_MODEL = 'gemini-3.6-flash' as ModelId;

/** 호출을 모델로 고른다(인덱스로 잡지 않는다). */
const callFor = (modelId: ModelId) =>
    mockRun.mock.calls.find(([arg]) => arg.modelId === modelId)?.[0];
const ROW = {
    id: 'n1',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://reuters.com/a',
    publishedAt: '2025-07-01T10:00:00.000Z',
    titleEn: 't',
    bodyEn: 'b',
    titleKo: '제목',
    bodyKo: '본문',
    summaryKo: '요약',
    sentiment: 'bullish',
    priceImpact: 'positive',
    category: 'earnings',
    analyzedAt: new Date('2025-07-01T11:00:00.000Z'),
};

const base = {
    symbol: 'AAPL',
    companyName: 'Apple',
    locale: 'en' as const,
};

beforeEach(() => {
    vi.clearAllMocks();
    mockListBySymbol.mockResolvedValue([ROW]);
    mockRun.mockResolvedValue({ status: 'done', result: {} } as never);
});

describe('executeNewsAnalysis', () => {
    it('호출자가 정한 tier·userApiKey·modelId를 core에 넘기고 세션 쿠키는 읽지 않는다', async () => {
        await executeNewsAnalysis({
            ...base,
            caller: {
                userId: 'u1',
                tier: 'member',
                userApiKey: 'sk-user',
                byokOnly: true,
            },
            modelId: BYOK_MODEL,
        });

        expect(mockRun).toHaveBeenCalledTimes(1);
        expect(mockRun).toHaveBeenCalledWith(
            expect.objectContaining({
                tier: 'member',
                userApiKey: 'sk-user',
                modelId: BYOK_MODEL,
                locale: 'en',
                skipEnqueueIfMiss: false,
                reasoning: false,
                keyPolicy: 'byok-only',
            })
        );
        expect(getCurrentUser).not.toHaveBeenCalled();
    });

    it('cacheOnly 확인 호출은 키 없이 byok-only로 보내고 skipEnqueueIfMiss를 켠다', async () => {
        await executeNewsAnalysis({
            ...base,
            caller: { userId: 'u1', tier: 'member', byokOnly: true },
            modelId: BYOK_MODEL,
            cacheOnly: true,
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
            await executeNewsAnalysis({
                ...base,
                caller: {
                    userId: 'u1',
                    tier,
                    userApiKey: 'sk-user',
                    byokOnly: true,
                },
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

    it('byokOnly에서 생성 호출에 키가 없으면 core를 부르기 전에 거절한다', async () => {
        await expect(
            executeNewsAnalysis({
                ...base,
                caller: { userId: 'u1', tier: 'member', byokOnly: true },
                modelId: BYOK_MODEL,
                cacheOnly: false,
            })
        ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
        expect(mockRun).not.toHaveBeenCalled();
        expect(mockListBySymbol).not.toHaveBeenCalled();
    });

    it('쿠키 액션 호출자(byokOnly 아님)는 검사를 받지 않는다 — 서버 키 정책 그대로', async () => {
        await executeNewsAnalysis({
            ...base,
            caller: { userId: 'u1', tier: 'pro' },
            modelId: FREE_MODEL,
        });
        const arg = callFor(FREE_MODEL);
        expect(arg).toMatchObject({ tier: 'pro', modelId: FREE_MODEL });
        expect(arg).not.toHaveProperty('userApiKey');
        // 웹 쿠키 경로는 기본 tier 정책 그대로다 — keyPolicy를 싣지 않는다.
        expect(arg).not.toHaveProperty('keyPolicy');
    });

    it('core의 예외는 삼키지 않고 던진다(호출부가 상태 코드를 보존한다)', async () => {
        const failure = Object.assign(new Error('401'), {
            status: 401,
            headers: {},
        });
        mockRun.mockRejectedValue(failure);
        await expect(
            executeNewsAnalysis({
                ...base,
                caller: {
                    userId: 'u1',
                    tier: 'member',
                    userApiKey: 'sk-user',
                    byokOnly: true,
                },
                modelId: BYOK_MODEL,
            })
        ).rejects.toBe(failure);
    });
});
