/*
 * 실제 core `runOverallAnalysis`를 쓴다(목 없음). 질문: free/member 등급 모델(서버 키 모델)로 캐시만 확인하는
 * overall이 미스일 때 의존 축(technical·fundamental·news·options)이 서버 키 LLM을 부를 수 있는가?
 *
 * 답(core 2.17.0 소스): 없다. `skipEnqueueIfMiss`가 최상위에서 네 축에 그대로 전달되고
 * (application/overall/runOverallAnalysis.js:144 → 173·204·229·255), 각 축은 LLM 호출(`callAnalysisAi`)보다
 * **앞에서** `miss_no_trigger`로 끝난다 — technical `market/runAnalysis.js:192`(호출 267), news
 * `news/runNewsAnalysis.js:139`(호출 157), options `options/runOptionsAnalysis.js:125`(호출 169),
 * fundamental `fundamental/runFundamentalAnalysis.js:177`(호출 215). 종합 호출 자신도 `:406`(호출 507) 앞이다.
 * 축이 하나라도 미스면 `:321`에서 `miss_no_trigger`로 돌아간다. 이 테스트는 그 소스 사실을 고정한다:
 * 서버 키 env가 전부 비어 있어 서버 키 LLM 시도는 `resolveServerApiKey`가 던지고, provider로 나가는
 * 네트워크 호출도 없어야 한다.
 */
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: vi.fn(() => ({
        getProfile: vi.fn(async () => {
            throw new Error('fundamental data must not be fetched on a probe');
        }),
    })),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: vi.fn().mockImplementation(function () {
        return {
            listBySymbol: vi.fn(async () => [
                {
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
                },
            ]),
        };
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
vi.mock('@/entities/options-chain/server/optionsDataCache', () => ({
    fetchOptionsSnapshot: vi.fn(async () => null),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn(() => ({})),
}));
vi.mock('@/entities/financials-statements/lib/getFinancialsSnapshot', () => ({
    getFinancialsSnapshot: vi.fn(async () => {
        throw new Error('no financials');
    }),
}));
vi.mock('@/entities/portfolio/lib/resolveHoldingPositionBucket', () => ({
    resolveHoldingPositionBucket: vi.fn(async () => undefined),
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us-equity'),
}));
vi.mock('@/shared/lib/byokGate', () => ({
    resolveReasoning: vi.fn(() => false),
}));

import type { ModelId } from '@y0ngha/siglens-core';
import { executeOverallAnalysis } from '@/entities/analysis/server/overallAnalysisRunner';

const SERVER_KEY_ENVS = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'DEEPSEEK_API_KEY',
];

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // 서버 키가 없다 — 서버 키 LLM을 시도하면 core가 `resolveServerApiKey`에서 던진다.
    for (const name of SERVER_KEY_ENVS) vi.stubEnv(name, '');
});
afterEach(() => vi.unstubAllEnvs());

describe('executeOverallAnalysis — 서버 키 모델의 캐시 확인(cacheOnly) 미스', () => {
    it.each(['claude-haiku-5-5', 'claude-sonnet-5-5'] as const)(
        '%s: 의존 축이 생성하지 않고 miss_no_trigger로 끝난다(LLM·네트워크 호출 없음)',
        async modelId => {
            const fetchSpy = vi
                .spyOn(globalThis, 'fetch')
                .mockRejectedValue(new Error('network must not be used'));

            const result = await executeOverallAnalysis({
                caller: { userId: 'u1', tier: 'member', byokOnly: false },
                symbol: 'AAPL',
                companyName: 'Apple',
                timeframe: '1Day',
                modelId: modelId as ModelId,
                locale: 'ko',
                options: { cacheOnly: true },
            });

            expect(result).toEqual({ status: 'miss_no_trigger' });
            expect(fetchSpy).not.toHaveBeenCalled();
            fetchSpy.mockRestore();
        }
    );
});
