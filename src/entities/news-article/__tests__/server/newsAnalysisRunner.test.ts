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
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

import { runNewsAnalysis, type ModelId } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { executeNewsAnalysis } from '@/entities/news-article/server/newsAnalysisRunner';
import {
    ByokOnlyRoutingError,
    CACHE_PROBE_KEY_PLACEHOLDER,
} from '@/shared/lib/byokOnly';

const mockRun = vi.mocked(runNewsAnalysis);
const BYOK_MODEL = 'claude-opus-5' as ModelId;
const FREE_MODEL = 'gemini-3.6-flash' as ModelId;
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
            })
        );
        expect(getCurrentUser).not.toHaveBeenCalled();
    });

    it('cacheOnly는 skipEnqueueIfMiss로 전달된다', async () => {
        await executeNewsAnalysis({
            ...base,
            caller: {
                userId: 'u1',
                tier: 'member',
                userApiKey: CACHE_PROBE_KEY_PLACEHOLDER,
                byokOnly: true,
            },
            modelId: BYOK_MODEL,
            cacheOnly: true,
        });
        expect(mockRun).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it('byokOnly에서 pro tier는 core가 서버 키를 고르므로 core를 부르기 전에 거절한다', async () => {
        await expect(
            executeNewsAnalysis({
                ...base,
                caller: {
                    userId: 'u1',
                    tier: 'pro',
                    userApiKey: 'sk-user',
                    byokOnly: true,
                },
                modelId: BYOK_MODEL,
            })
        ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
        expect(mockRun).not.toHaveBeenCalled();
        expect(mockListBySymbol).not.toHaveBeenCalled();
    });

    it('byokOnly에서 free 등급 모델은 서버 키로 가므로 거절한다', async () => {
        await expect(
            executeNewsAnalysis({
                ...base,
                caller: {
                    userId: 'u1',
                    tier: 'member',
                    userApiKey: 'sk-user',
                    byokOnly: true,
                },
                modelId: FREE_MODEL,
            })
        ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
        expect(mockRun).not.toHaveBeenCalled();
    });

    it('자리표시 키로는 생성(cacheOnly: false)을 할 수 없다', async () => {
        await expect(
            executeNewsAnalysis({
                ...base,
                caller: {
                    userId: 'u1',
                    tier: 'member',
                    userApiKey: CACHE_PROBE_KEY_PLACEHOLDER,
                    byokOnly: true,
                },
                modelId: BYOK_MODEL,
                cacheOnly: false,
            })
        ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
        expect(mockRun).not.toHaveBeenCalled();
    });

    it('쿠키 액션 호출자(byokOnly 아님)는 검사를 받지 않는다 — 서버 키 정책 그대로', async () => {
        await executeNewsAnalysis({
            ...base,
            caller: { userId: 'u1', tier: 'pro' },
            modelId: FREE_MODEL,
        });
        const arg = mockRun.mock.calls[0][0];
        expect(arg).toMatchObject({ tier: 'pro', modelId: FREE_MODEL });
        expect(arg).not.toHaveProperty('userApiKey');
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
